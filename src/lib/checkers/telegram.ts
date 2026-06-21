import type { CheckResult } from "../types";
import { fetchWithProxy } from "../proxy";

export async function checkTelegram(variant: string): Promise<CheckResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    // Not an error — the check is simply not set up. The UI shows this as a
    // neutral "not configured" state rather than a scary red error badge.
    return {
      variant,
      available: null,
      confidence: "unconfigured",
      error: "no_bot_token",
    };
  }

  try {
    const res = await fetchWithProxy(
      `https://api.telegram.org/bot${token}/getChat?chat_id=@${variant}`,
      { signal: AbortSignal.timeout(5000) }
    );

    const data = await res.json();

    if (res.ok && data.ok) {
      // Chat exists — name is taken
      return { variant, available: false, confidence: "confirmed" };
    }

    if (!data.ok && data.description?.includes("chat not found")) {
      // Likely available
      return { variant, available: true, confidence: "likely" };
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
      error: data.description || `http_${res.status}`,
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
