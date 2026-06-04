import type { CheckResult } from "../types";
import { fetchWithProxy } from "../proxy";

// RDAP is the authoritative registry protocol (the structured successor to
// WHOIS). For .com we query Verisign directly. A 404 means the domain is not
// in the registry (available); a 200 means it is registered (taken).
//
// We deliberately do NOT fall back to a DNS lookup: many resolvers hijack
// NXDOMAIN and return an IP for names that don't exist, which made the old
// fallback report free names as "taken — confirmed" (the one verdict this
// product must never get wrong). If RDAP can't give an authoritative answer,
// we say so honestly with an "error" result rather than guessing.

export async function checkDomain(variant: string): Promise<CheckResult> {
  const name = variant.replace(/\.com$/, "");
  const rdapUrl = `https://rdap.verisign.com/com/v1/domain/${name}.com`;

  try {
    const rdapRes = await fetchWithProxy(rdapUrl, {
      headers: { Accept: "application/rdap+json" },
      signal: AbortSignal.timeout(5000),
    });

    if (rdapRes.status === 404) {
      // Not in the registry — available.
      return { variant, available: true, confidence: "confirmed" };
    }

    if (rdapRes.ok) {
      // Registered — taken.
      return { variant, available: false, confidence: "confirmed" };
    }

    if (rdapRes.status === 429) {
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
      error: `http_${rdapRes.status}`,
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
