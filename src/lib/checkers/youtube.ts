import type { CheckResult } from "../types";
import { fetchWithProxy } from "../proxy";

// YouTube has no availability API, but the public handle URL is a clean,
// reliable signal from a server IP: youtube.com/@handle returns 200 when the
// handle is claimed and 404 when it's free. (Verified live.)

export async function checkYouTube(variant: string): Promise<CheckResult> {
  try {
    const res = await fetchWithProxy(
      `https://www.youtube.com/@${encodeURIComponent(variant)}`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; needaname/1.0)",
          Accept: "text/html",
        },
        redirect: "manual",
        signal: AbortSignal.timeout(6000),
      }
    );

    if (res.status === 404) {
      return { variant, available: true, confidence: "confirmed" };
    }

    // 200 (channel page) or a 3xx redirect to one means the handle is claimed.
    if (res.ok || (res.status >= 300 && res.status < 400)) {
      return { variant, available: false, confidence: "confirmed" };
    }

    if (res.status === 429) {
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
