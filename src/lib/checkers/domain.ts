import { resolve } from "dns/promises";
import type { CheckResult } from "../types";
import { fetchWithProxy } from "../proxy";

export async function checkDomain(variant: string): Promise<CheckResult> {
  const domain = variant; // e.g., "codeweaver.com"

  try {
    // Step 1: DNS check — quick signal
    let dnsResolved = false;
    try {
      await resolve(domain);
      dnsResolved = true;
    } catch {
      // No DNS records — might be available
    }

    // Step 2: RDAP check — authoritative for .com
    const name = domain.replace(/\.com$/, "");
    const rdapUrl = `https://rdap.verisign.com/com/v1/domain/${name}.com`;
    const rdapRes = await fetchWithProxy(rdapUrl, {
      signal: AbortSignal.timeout(5000),
    });

    if (rdapRes.status === 404) {
      // Not in registry — available
      return { variant, available: true, confidence: "confirmed" };
    }

    if (rdapRes.ok) {
      // Registered
      return { variant, available: false, confidence: "confirmed" };
    }

    // RDAP returned unexpected status — fall back to DNS-only
    return {
      variant,
      available: !dnsResolved,
      confidence: dnsResolved ? "confirmed" : "likely",
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
