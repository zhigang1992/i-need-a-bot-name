import Anthropic from "@anthropic-ai/sdk";
import type { NameCandidate } from "./types";

const SYSTEM_PROMPT = `You are a product naming expert. Given a description of what someone is building, generate short, brandable names that could work as a product name across multiple platforms (domain, npm, GitHub, Telegram bot).

NAMING PRINCIPLES:
- Brevity is king. 4-8 characters is ideal. Never exceed 15.
- Brandable > descriptive. "Stripe" is better than "OnlinePaymentProcessor".
- Pronounceable. If you can't say it out loud easily, skip it.
- No filler words: my, the, get, app, real, official, best, pro, x, ai.
- No trailing numbers. "code2" is lazy naming.
- Avoid existing well-known brand names or trademarks.
- Mix strategies: compound words (codeweaver), portmanteaus (devtool), metaphors (lighthouse), invented words (vercel).

OUTPUT FORMAT:
Return a JSON array of objects. Each object has:
- name: the base name (lowercase, alphanumeric only, no spaces/hyphens/underscores)
- relevance: 0-1 float indicating how well the name conveys the product's purpose (1 = immediately obvious, 0 = no connection)

Generate exactly {count} candidates. Aim for variety — mix obvious names with creative/unexpected ones.`;

const FEW_SHOT_EXAMPLES = [
  {
    role: "user" as const,
    content: "a tool that helps developers write better commit messages",
  },
  {
    role: "assistant" as const,
    content: JSON.stringify([
      { name: "committo", relevance: 0.9 },
      { name: "gitquill", relevance: 0.8 },
      { name: "logcraft", relevance: 0.7 },
      { name: "scribe", relevance: 0.5 },
      { name: "penmark", relevance: 0.4 },
    ]),
  },
  {
    role: "user" as const,
    content: "a service that monitors website uptime and alerts you",
  },
  {
    role: "assistant" as const,
    content: JSON.stringify([
      { name: "pingu", relevance: 0.7 },
      { name: "upward", relevance: 0.6 },
      { name: "sentinel", relevance: 0.5 },
      { name: "watchfire", relevance: 0.8 },
      { name: "heartbeat", relevance: 0.9 },
    ]),
  },
];

const VALID_NAME_RE = /^[a-z0-9]+$/;

export async function generateNames(
  description: string,
  count: number,
  _retryCount = 0
): Promise<NameCandidate[]> {
  const client = new Anthropic({
    apiKey: process.env.SDK_ANTHROPIC_API_KEY,
    baseURL: process.env.SDK_ANTHROPIC_BASE_URL || undefined,
  });
  // Use 2x multiplier to balance quality vs latency (glm-5 is slow with thinking)
  const candidateCount = count * 2;

  const response = await client.messages.create({
    model: process.env.SDK_ANTHROPIC_MODEL || "claude-haiku-4-5-20251001",
    max_tokens: 2048,
    system: SYSTEM_PROMPT.replace("{count}", String(candidateCount)),
    messages: [
      ...FEW_SHOT_EXAMPLES,
      { role: "user", content: description },
    ],
  });

  // Extract text from response — glm-5 returns thinking + text blocks
  const textBlock = response.content.find((block) => block.type === "text");
  const text = textBlock && "text" in textBlock ? textBlock.text : "";

  let parsed: unknown[];
  try {
    // Extract JSON array from response (handle markdown code blocks, nested arrays, etc.)
    // Try increasingly aggressive extraction patterns
    let jsonStr: string | null = null;

    // Pattern 1: Match outermost JSON array
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) jsonStr = jsonMatch[0];

    // Pattern 2: If the whole text is JSON (no wrapping)
    if (!jsonStr && text.trim().startsWith("[")) jsonStr = text.trim();

    if (!jsonStr) {
      console.error("[generator] No JSON array found in LLM output:", text.slice(0, 500));
      throw new Error("No JSON array found");
    }

    parsed = JSON.parse(jsonStr);
  } catch (e) {
    console.error("[generator] Failed to parse LLM output:", text.slice(0, 500));
    throw new Error("generation_failed: could not parse LLM output");
  }

  const candidates: NameCandidate[] = [];
  for (const item of parsed) {
    if (
      typeof item === "object" &&
      item !== null &&
      "name" in item
    ) {
      const { name, relevance } = item as { name: string; relevance: unknown };
      // Validate name: lowercase alphanumeric only, 2-15 chars
      if (
        typeof name === "string" &&
        VALID_NAME_RE.test(name) &&
        name.length >= 2 &&
        name.length <= 15
      ) {
        const numRelevance = Number(relevance);
        candidates.push({
          name,
          relevance: Math.max(0, Math.min(1, isNaN(numRelevance) ? 0.5 : numRelevance)),
        });
      }
    }
  }

  if (candidates.length === 0) {
    // Log what we got so we can debug
    console.error("[generator] No valid candidates after filtering. Parsed items:", JSON.stringify(parsed).slice(0, 500));

    // Retry once
    if (_retryCount < 1) {
      console.log("[generator] Retrying generation (attempt 2)...");
      return generateNames(description, count, _retryCount + 1);
    }

    throw new Error("no_names_generated: LLM returned no valid candidates");
  }

  return candidates;
}
