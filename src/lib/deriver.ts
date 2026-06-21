const PLATFORM_RULES: Record<
  string,
  { derive: (name: string) => string | null; validate: (variant: string) => boolean }
> = {
  domain: {
    derive: (name) => {
      const clean = name.toLowerCase().replace(/[^a-z0-9-]/g, "");
      if (!clean || clean.length > 63) return null;
      return `${clean}.com`;
    },
    validate: (v) => /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.com$/.test(v),
  },
  npm: {
    derive: (name) => {
      const clean = name.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
      if (!clean || clean.length > 214) return null;
      return clean;
    },
    validate: (v) => v.length >= 1 && v.length <= 214 && /^[a-z0-9][a-z0-9._-]*$/.test(v),
  },
  github: {
    derive: (name) => {
      const clean = name.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
      if (!clean || clean.length > 39) return null;
      return clean;
    },
    validate: (v) => v.length >= 1 && v.length <= 39 && /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(v),
  },
  telegram: {
    derive: (name) => {
      const clean = name.toLowerCase().replace(/[^a-z0-9_]/g, "");
      if (!clean) return null;
      // Don't double-suffix "bot"
      const variant = clean.endsWith("bot") ? clean : `${clean}bot`;
      if (variant.length < 5 || variant.length > 32) return null;
      return variant;
    },
    validate: (v) =>
      v.length >= 5 &&
      v.length <= 32 &&
      /^[a-z][a-z0-9_]*bot$/i.test(v),
  },
  youtube: {
    // YouTube handles: 3–30 chars, letters/digits/underscore/hyphen/period.
    derive: (name) => {
      const clean = name.toLowerCase().replace(/[^a-z0-9._-]/g, "");
      if (clean.length < 3 || clean.length > 30) return null;
      return clean;
    },
    validate: (v) => v.length >= 3 && v.length <= 30 && /^[a-z0-9._-]+$/.test(v),
  },
};

export function deriveVariant(
  baseName: string,
  platform: string
): string | null {
  const rules = PLATFORM_RULES[platform];
  if (!rules) return null;

  const variant = rules.derive(baseName);
  if (!variant) return null;

  return rules.validate(variant) ? variant : null;
}

export function deriveAllVariants(
  baseName: string,
  platforms: string[]
): Record<string, string | null> {
  const result: Record<string, string | null> = {};
  for (const platform of platforms) {
    result[platform] = deriveVariant(baseName, platform);
  }
  return result;
}
