// Canonical platform registry — the single source of truth for which platforms
// we check and how each is presented and claimed. Previously this list was
// duplicated across the API routes, the orchestrator, and the page component.

export interface PlatformMeta {
  id: string;
  /** Short label shown on availability badges. */
  label: string;
  /** Human-readable display form of a derived variant (e.g. "name.com", "@name"). */
  format: (variant: string) => string;
  /** Verb used in the "claim it" action (e.g. "Register", "Claim"). */
  claimVerb: string;
  /** Where to go to actually claim the name (opens in a new tab). */
  claimUrl: (variant: string) => string;
}

export const PLATFORMS: PlatformMeta[] = [
  {
    id: "domain",
    label: ".com",
    format: (v) => v, // already ends in .com
    claimVerb: "Register",
    claimUrl: (v) =>
      `https://www.namecheap.com/domains/registration/results/?domain=${v}`,
  },
  {
    id: "npm",
    label: "npm",
    format: (v) => v,
    claimVerb: "Claim",
    claimUrl: (v) => `https://www.npmjs.com/package/${v}`,
  },
  {
    id: "github",
    label: "GitHub",
    format: (v) => v,
    claimVerb: "Create org",
    claimUrl: () => `https://github.com/organizations/new?plan=free`,
  },
  {
    id: "youtube",
    label: "YouTube",
    format: (v) => `@${v}`,
    claimVerb: "Grab",
    claimUrl: () => `https://www.youtube.com/account`,
  },
  {
    id: "telegram",
    label: "Telegram",
    format: (v) => `@${v}`,
    claimVerb: "Set up",
    claimUrl: () => `https://t.me/BotFather`,
  },
];

const PLATFORM_BY_ID: Record<string, PlatformMeta> = Object.fromEntries(
  PLATFORMS.map((p) => [p.id, p])
);

export function getPlatform(id: string): PlatformMeta | undefined {
  return PLATFORM_BY_ID[id];
}

// Platforms that work with the current configuration. Domain/npm/GitHub/YouTube
// need no credentials. Telegram needs a bot token, so we only include it when
// one is set — otherwise every card would show a permanent "not configured"
// badge, which reads as broken.
export function activePlatformIds(): string[] {
  const ids = ["domain", "npm", "github", "youtube"];
  if (process.env.TELEGRAM_BOT_TOKEN) ids.push("telegram");
  return ids;
}
