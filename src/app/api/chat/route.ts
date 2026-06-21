import {
  streamText,
  tool,
  stepCountIs,
  convertToModelMessages,
  type UIMessage,
} from "ai";
import { z } from "zod";
import { anthropic, MODEL_ID } from "@/lib/llm";
import { suggest } from "@/lib/suggest";
import { activePlatformIds } from "@/lib/platforms";

// Name generation + availability checks can take a little time; give the
// streamed response room. (Route Handlers are not cached for POST.)
export const maxDuration = 60;

const SYSTEM = `You are Vacant, a naming assistant. You help people find a product name that is actually available across domains (.com), npm, GitHub, and YouTube.

When the user describes what they're building — or asks to refine earlier suggestions ("shorter", "more playful", "one word", "avoid medical terms") — call the findNames tool. Build the tool's "description" argument by combining the conversation so far so it captures the user's full intent including refinements.

Rules:
- ALWAYS use the findNames tool to produce names. NEVER invent, list, or repeat names yourself in prose — the interface renders the tool's results as interactive availability cards, and any names you type would not match.
- Keep your own text to ONE short sentence: a lead-in such as "Here's what's available:" or, for a refinement, "Shorter options coming up:".
- If a message isn't a naming request (a greeting, a thanks, a general question), reply briefly in one or two sentences and ask what they're building. Don't call the tool.`;

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const result = streamText({
    model: anthropic(MODEL_ID),
    system: SYSTEM,
    messages: await convertToModelMessages(messages),
    // Allow: tool call -> tool result -> short lead-in sentence.
    stopWhen: stepCountIs(3),
    tools: {
      findNames: tool({
        description:
          "Generate brandable product names and check their real availability across domain (.com), npm, GitHub, and YouTube. Returns ranked suggestions with per-platform availability.",
        inputSchema: z.object({
          description: z
            .string()
            .describe(
              "A concise description of the product, incorporating any refinement instructions from the conversation."
            ),
          count: z
            .number()
            .min(1)
            .max(8)
            .describe("How many names to return (default 5)."),
        }),
        execute: async ({ description, count }) => {
          const platforms = activePlatformIds();
          const { suggestions } = await suggest(
            description,
            platforms,
            count ?? 5
          );
          return { platforms, suggestions };
        },
      }),
    },
  });

  return result.toUIMessageStreamResponse();
}
