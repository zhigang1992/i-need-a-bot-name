import { createAnthropic } from "@ai-sdk/anthropic";

// Shared Anthropic-compatible provider. The raw Anthropic SDK appended
// `/v1/messages` to the base URL; the AI SDK provider appends only `/messages`
// to its baseURL, so we normalize to a `/v1` suffix. This keeps the configured
// proxy (e.g. DeepSeek's Anthropic-compatible endpoint) working unchanged.
function resolveBaseURL(): string | undefined {
  const base = process.env.SDK_ANTHROPIC_BASE_URL?.replace(/\/+$/, "");
  if (!base) return undefined; // falls back to api.anthropic.com
  return /\/v1$/.test(base) ? base : `${base}/v1`;
}

export const anthropic = createAnthropic({
  apiKey: process.env.SDK_ANTHROPIC_API_KEY,
  baseURL: resolveBaseURL(),
});

export const MODEL_ID =
  process.env.SDK_ANTHROPIC_MODEL || "claude-haiku-4-5-20251001";
