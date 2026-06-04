import type { CheckResult } from "../types";
import { fetchWithProxy } from "../proxy";

// GitHub reserves a set of system words (account routes, marketing pages, etc.).
// These return 404 from the /users endpoint exactly like a free name would, so
// without this guard we'd report them as "available" when they can never be
// registered. Users and organizations share one namespace, so a 200 for either
// already means "taken" — no special handling needed there.
const RESERVED = new Set([
  "about", "access", "account", "accounts", "admin", "administrator", "api",
  "app", "apps", "billing", "blog", "business", "contact", "dashboard",
  "developer", "docs", "downloads", "edu", "enterprise", "events", "explore",
  "features", "gist", "gists", "help", "home", "hosting", "integrations",
  "issues", "jobs", "join", "login", "logout", "marketplace", "mobile", "new",
  "news", "notifications", "oauth", "orgs", "organizations", "payments",
  "plans", "pricing", "privacy", "pulls", "raw", "readme", "register",
  "search", "security", "sessions", "settings", "setup", "signin", "signup",
  "site", "sponsors", "stars", "status", "support", "teams", "topics", "tos",
  "training", "trending", "user", "users", "watching", "wiki", "www",
]);

export async function checkGithub(variant: string): Promise<CheckResult> {
  if (RESERVED.has(variant.toLowerCase())) {
    return { variant, available: false, confidence: "confirmed" };
  }

  try {
    const headers: Record<string, string> = {
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "needaname-checker",
    };

    // Use a PAT if available: lifts the rate limit from 60/hr to 5,000/hr.
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
