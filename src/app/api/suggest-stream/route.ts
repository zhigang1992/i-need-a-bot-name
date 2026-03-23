import { NextRequest } from "next/server";
import { generateNames } from "@/lib/generator";
import { deriveAllVariants } from "@/lib/deriver";
import { checkAvailability } from "@/lib/checkers";
import { rankSuggestions } from "@/lib/ranker";

const VALID_PLATFORMS = ["domain", "npm", "github", "telegram"];

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { description, platforms, count } = body;

  // Validate
  if (!description || typeof description !== "string" || description.trim().length === 0) {
    return new Response(JSON.stringify({ error: "invalid_input", message: "Description is required." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  if (description.length > 500) {
    return new Response(JSON.stringify({ error: "invalid_input", message: "Description must be 500 characters or less." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const resolvedPlatforms: string[] = platforms ?? VALID_PLATFORMS;
  const resolvedCount = count ?? 5;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      try {
        // Phase 1: Generate names via LLM
        const candidates = await generateNames(description.trim(), resolvedCount);
        send("names", { names: candidates });

        // Phase 2: Check availability — stream each result as it completes
        const allResults: Array<{
          name: string;
          relevance: number;
          availability: Record<string, Awaited<ReturnType<typeof checkAvailability>>>;
        }> = candidates.map((c) => ({
          name: c.name,
          relevance: c.relevance,
          availability: {},
        }));

        // Fire off all checks in parallel, stream each as it resolves
        const checkPromises: Promise<void>[] = [];

        for (let i = 0; i < candidates.length; i++) {
          const candidate = candidates[i];
          const variants = deriveAllVariants(candidate.name, resolvedPlatforms);

          for (const platform of resolvedPlatforms) {
            const variant = variants[platform];
            const promise = (async () => {
              let result: Awaited<ReturnType<typeof checkAvailability>>;
              if (!variant) {
                result = { variant: "", available: null, confidence: "error" as const, error: "invalid_derivation" };
              } else {
                result = await checkAvailability(variant, platform);
              }
              allResults[i].availability[platform] = result;
              send("check", { name: candidate.name, platform, result });
            })();
            checkPromises.push(promise);
          }
        }

        await Promise.all(checkPromises);

        // Phase 3: Rank and send final order
        const ranked = rankSuggestions(allResults);
        const topResults = ranked.slice(0, resolvedCount).map(({ name, score, availability }) => ({
          name,
          score,
          availability,
        }));

        send("done", {
          suggestions: topResults,
          checked_at: new Date().toISOString(),
          note: "Telegram availability is inferred, not guaranteed. Domain/npm/GitHub availability is confirmed.",
        });

        controller.close();
      } catch (err) {
        const message = err instanceof Error ? err.message : "An unexpected error occurred.";
        send("error", { error: message });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
