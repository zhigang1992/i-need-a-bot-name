import type { CheckResult, NameSuggestion } from "./types";

const FILLER_WORDS = [
  "my", "the", "get", "app", "real", "official", "best", "pro", "ai",
];

function brevityScore(name: string): number {
  return Math.max(0, 1 - name.length / 30);
}

function readabilityScore(name: string): number {
  let violations = 0;

  // 3+ consecutive consonants
  if (/[^aeiou]{3,}/i.test(name)) violations++;

  // Leading/trailing special chars (after derivation, unlikely but safe)
  if (/^[^a-z0-9]/i.test(name) || /[^a-z0-9]$/i.test(name)) violations++;

  // Very long base name
  if (name.length > 15) violations++;

  return Math.max(0, 1 - 0.15 * violations);
}

function cleanlinessScore(name: string): number {
  let fillerCount = 0;
  const lower = name.toLowerCase();

  for (const filler of FILLER_WORDS) {
    if (lower.startsWith(filler) || lower.endsWith(filler)) {
      fillerCount++;
    }
  }

  // Trailing digits
  if (/\d+$/.test(name)) fillerCount++;

  return Math.max(0, 1 - 0.2 * fillerCount);
}

function coverageScore(availability: Record<string, CheckResult>): number {
  const entries = Object.values(availability);
  const checked = entries.filter((r) => r.confidence !== "error");
  if (checked.length === 0) return 0;
  const available = checked.filter((r) => r.available === true).length;
  return available / checked.length;
}

export function rankSuggestions(
  suggestions: Omit<NameSuggestion, "score">[]
): NameSuggestion[] {
  const scored = suggestions.map((s) => {
    const brevity = brevityScore(s.name);
    const relevance = (s as unknown as { relevance?: number }).relevance ?? 0.5;
    const coverage = coverageScore(s.availability);
    const readability = readabilityScore(s.name);
    const cleanliness = cleanlinessScore(s.name);

    const score =
      0.3 * brevity +
      0.25 * relevance +
      0.2 * coverage +
      0.15 * readability +
      0.1 * cleanliness;

    return { ...s, score: Math.round(score * 100) / 100 };
  });

  // Sort descending by score, alphabetical for ties
  scored.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));

  return scored;
}
