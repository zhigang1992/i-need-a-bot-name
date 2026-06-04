import type { CheckResult } from "../types";
import { checkDomain } from "./domain";
import { checkNpm } from "./npm";
import { checkGithub } from "./github";
import { checkTelegram } from "./telegram";
import { checkYouTube } from "./youtube";

type CheckerFn = (variant: string) => Promise<CheckResult>;

const CHECKERS: Record<string, CheckerFn> = {
  domain: checkDomain,
  npm: checkNpm,
  github: checkGithub,
  telegram: checkTelegram,
  youtube: checkYouTube,
};

export async function checkAvailability(
  variant: string,
  platform: string
): Promise<CheckResult> {
  const checker = CHECKERS[platform];
  if (!checker) {
    return {
      variant,
      available: null,
      confidence: "error",
      error: `unknown_platform: ${platform}`,
    };
  }
  return checker(variant);
}

export { CHECKERS };
