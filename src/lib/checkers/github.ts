import type { CheckResult } from "../types";
import { fetchWithProxy } from "../proxy";

export async function checkGithub(variant: string): Promise<CheckResult> {
  try {
    const headers: Record<string, string> = {
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "needaname-checker",
    };

    // Use PAT if available for higher rate limits
    const pat = process.env.GITHUB_PAT;
    if (pat) {
      headers.Authorization = `Bearer ${pat}`;
    }

    const res = await fetchWithProxy(
      `https://api.github.com/users/${encodeURIComponent(variant)}`,
      { headers, signal: AbortSignal.timeout(5000) }
    );

    if (res.status === 404) {
      return { variant, available: true, confidence: "confirmed" };
    }

    if (res.ok) {
      return { variant, available: false, confidence: "confirmed" };
    }

    if (res.status === 403 || res.status === 429) {
      return {
        variant,
        available: null,
        confidence: "error",
        error: "rate_limited",
      };
    }

    return {
      variant,
      available: null,
      confidence: "error",
      error: `http_${res.status}`,
    };
  } catch (err) {
    return {
      variant,
      available: null,
      confidence: "error",
      error: err instanceof Error ? err.message : "service_unavailable",
    };
  }
}
