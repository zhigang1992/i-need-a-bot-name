export interface CheckResult {
  variant: string;
  available: boolean | null;
  confidence: "confirmed" | "likely" | "error";
  error?: string;
}

export interface PlatformChecker {
  platform: string;
  deriveVariant(baseName: string): string | null;
  checkAvailability(variant: string): Promise<CheckResult>;
}

export interface NameCandidate {
  name: string;
  relevance: number;
}

export interface NameSuggestion {
  name: string;
  score: number;
  availability: Record<string, CheckResult>;
}

export interface SuggestRequest {
  description: string;
  platforms?: string[];
  count?: number;
}

export interface SuggestResponse {
  suggestions: NameSuggestion[];
  checked_at: string;
  note: string;
}

export interface SuggestError {
  error: string;
  message: string;
  retry_after?: number;
}
