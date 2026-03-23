import type { CheckResult } from "../types";

export async function checkNpm(variant: string): Promise<CheckResult> {
  try {
    // Use npm-name which handles punctuation normalization
    // (e.g., "ch-alk" blocked because "chalk" exists)
    const npmName = await import("npm-name");
    const available = await npmName.default(variant);
    return { variant, available, confidence: "confirmed" };
  } catch (err) {
    return {
      variant,
      available: null,
      confidence: "error",
      error: err instanceof Error ? err.message : "service_unavailable",
    };
  }
}
