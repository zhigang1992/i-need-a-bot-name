import type { NameSuggestion, CheckResult, SuggestResponse } from "./types";
import { generateNames } from "./generator";
import { deriveAllVariants } from "./deriver";
import { checkAvailability } from "./checkers";
import { rankSuggestions } from "./ranker";
import { activePlatformIds } from "./platforms";

export async function suggest(
  description: string,
  platforms: string[] = activePlatformIds(),
  count: number = 5
): Promise<SuggestResponse> {
  // 1. Generate base name candidates via LLM
  const candidates = await generateNames(description, count);

  // 2. Derive platform-specific variants + check availability in parallel
  const suggestionsWithRelevance = await Promise.all(
    candidates.map(async (candidate) => {
      const variants = deriveAllVariants(candidate.name, platforms);

      // Check all platforms in parallel for this candidate
      const availability: Record<string, CheckResult> = {};
      await Promise.all(
        platforms.map(async (platform) => {
          const variant = variants[platform];
          if (!variant) {
            availability[platform] = {
              variant: "",
              available: null,
              confidence: "error",
              error: "invalid_derivation",
            };
            return;
          }
          availability[platform] = await checkAvailability(variant, platform);
        })
      );

      return {
        name: candidate.name,
        relevance: candidate.relevance,
        availability,
      };
    })
  );

  // 3. Rank and return top `count`
  const ranked = rankSuggestions(suggestionsWithRelevance);
  const topResults = ranked.slice(0, count);

  // Strip internal `relevance` field from output
  const suggestions: NameSuggestion[] = topResults.map(
    ({ name, score, availability }) => ({ name, score, availability })
  );

  return {
    suggestions,
    checked_at: new Date().toISOString(),
    note: "Domain/npm/GitHub/YouTube availability is confirmed at check time. Telegram (when enabled) is inferred.",
  };
}
