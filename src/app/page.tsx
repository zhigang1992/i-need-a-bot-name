"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import type { CheckResult } from "@/lib/types";

const RESULT_COUNT = 5;

function AvailabilityBadge({ platform, result }: { platform: string; result?: CheckResult }) {
  const labels: Record<string, string> = {
    domain: ".com",
    npm: "npm",
    github: "GitHub",
    telegram: "Telegram",
  };
  const label = labels[platform] || platform;

  if (!result) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full bg-[var(--surface)] text-[var(--text-tertiary)] border border-[var(--border)]">
        <span className="inline-block w-2 h-2 rounded-full border border-[var(--text-tertiary)] border-t-transparent animate-spin" />
        {label}
      </span>
    );
  }

  if (result.confidence === "error") {
    return (
      <span
        className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-[#451a03]/50 text-[var(--error)] border border-[var(--error)]/30"
        title={result.error || "Couldn't check"}
      >
        {label}
      </span>
    );
  }

  if (result.available) {
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-[#052e16]/60 text-[#86efac] border border-[var(--accent)]/30">
        <span className="text-[10px]">✓</span>
        {label}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-[var(--surface)] text-[var(--text-tertiary)] border border-[var(--border)]">
      {label}
    </span>
  );
}

interface StreamingName {
  name: string;
  relevance: number;
  availability: Record<string, CheckResult>;
  score?: number;
}

function SkeletonCards() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-lg border border-[var(--border)] p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="skeleton h-5 rounded" style={{ width: 80 + i * 20 }} />
            <div className="skeleton h-4 w-10 rounded" />
          </div>
          <div className="flex gap-2">
            {[1, 2, 3, 4].map((j) => (
              <div key={j} className="skeleton h-6 w-16 rounded-full" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function SearchPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialQuery = searchParams.get("q") || "";

  const [query, setQuery] = useState(initialQuery);
  const [names, setNames] = useState<StreamingName[]>([]);
  const [phase, setPhase] = useState<"idle" | "generating" | "checking" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const [expandedName, setExpandedName] = useState<string | null>(null);
  const [copiedName, setCopiedName] = useState<string | null>(null);
  const [finalOrder, setFinalOrder] = useState<string[] | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const search = useCallback(
    async (description: string) => {
      if (!description.trim()) return;

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setPhase("generating");
      setError(null);
      setNames([]);
      setExpandedName(null);
      setFinalOrder(null);

      router.push(`/?q=${encodeURIComponent(description)}`, { scroll: false });

      try {
        const res = await fetch("/api/suggest-stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ description: description.trim(), count: RESULT_COUNT }),
          signal: controller.signal,
        });

        if (!res.ok) {
          const data = await res.json();
          setError(data.message || "Something went wrong. Try again.");
          setPhase("idle");
          return;
        }

        const reader = res.body?.getReader();
        if (!reader) {
          setError("Streaming not supported.");
          setPhase("idle");
          return;
        }

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          let currentEvent = "";
          for (const line of lines) {
            if (line.startsWith("event: ")) {
              currentEvent = line.slice(7);
            } else if (line.startsWith("data: ") && currentEvent) {
              try {
                const data = JSON.parse(line.slice(6));
                handleSSEEvent(currentEvent, data);
              } catch {
                // skip malformed JSON
              }
              currentEvent = "";
            }
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        setError("Something went wrong. Try again.");
        setPhase("idle");
      }
    },
    [router]
  );

  const handleSSEEvent = useCallback((event: string, data: unknown) => {
    if (event === "names") {
      const { names: incoming } = data as { names: Array<{ name: string; relevance: number }> };
      // Only show up to RESULT_COUNT during streaming (LLM generates more candidates internally)
      const limited = incoming.slice(0, RESULT_COUNT);
      setNames(limited.map((n) => ({ name: n.name, relevance: n.relevance, availability: {} })));
      setPhase("checking");
    } else if (event === "check") {
      const { name, platform, result } = data as { name: string; platform: string; result: CheckResult };
      setNames((prev) =>
        prev.map((n) =>
          n.name === name ? { ...n, availability: { ...n.availability, [platform]: result } } : n
        )
      );
    } else if (event === "done") {
      const { suggestions } = data as { suggestions: Array<{ name: string; score: number; availability: Record<string, CheckResult> }> };
      setNames(
        suggestions.map((s) => ({
          name: s.name,
          relevance: 0,
          score: s.score,
          availability: s.availability,
        }))
      );
      setFinalOrder(suggestions.map((s) => s.name));
      setPhase("done");
    } else if (event === "error") {
      const { error: msg } = data as { error: string };
      setError(msg);
      setPhase("idle");
    }
  }, []);

  useEffect(() => {
    if (initialQuery) search(initialQuery);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const platforms = ["domain", "npm", "github", "telegram"];

  const platformLinks: Record<string, (v: string) => string> = {
    domain: (v) => `https://www.namecheap.com/domains/registration/results/?domain=${v}`,
    npm: (v) => `https://www.npmjs.com/package/${v}`,
    github: () => `https://github.com/organizations/new?plan=free`,
    telegram: () => `https://t.me/BotFather`,
  };

  const platformActionLabels: Record<string, (v: string) => string> = {
    domain: (v) => `Register ${v}`,
    npm: (v) => `Claim ${v} on npm`,
    github: (v) => `Create ${v} on GitHub`,
    telegram: (v) => `Set up @${v} with BotFather`,
  };

  // Show final ranked order or streaming order
  const displayNames = finalOrder
    ? finalOrder.map((n) => names.find((x) => x.name === n)).filter(Boolean) as StreamingName[]
    : names;

  const isLoading = phase === "generating" || phase === "checking";

  return (
    <main className="flex-1 flex flex-col">
      <div className="w-full max-w-[640px] mx-auto px-5 py-16 flex-1">
        {/* Header */}
        <div className="mb-10 text-center">
          <h1 className="text-2xl font-semibold font-[family-name:var(--font-geist-sans)] mb-1">needaname</h1>
          <p className="text-sm text-[var(--text-secondary)]">
            Find a name that&apos;s available everywhere
          </p>
        </div>

        {/* Search */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            search(query);
          }}
          className="flex gap-2 mb-10 max-md:flex-col"
        >
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Describe what you're building..."
            autoFocus
            className="flex-1 bg-[var(--surface)] border border-[var(--border)] rounded-lg px-4 py-3 text-sm text-[var(--text-primary)] font-[family-name:var(--font-geist-sans)] placeholder:text-[var(--text-tertiary)] outline-none focus:border-[var(--accent)] transition-colors"
          />
          <button
            type="submit"
            disabled={isLoading || !query.trim()}
            className="bg-[var(--accent)] text-[var(--bg)] font-[family-name:var(--font-geist-sans)] text-sm font-semibold px-6 py-3 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap max-md:w-full"
          >
            {phase === "generating" ? "Thinking..." : phase === "checking" ? "Checking..." : "Find Names"}
          </button>
        </form>

        {/* Error */}
        {error && (
          <div className="bg-[#450a0a] border border-[#ef4444]/30 text-[#fca5a5] text-sm px-4 py-3 rounded-lg mb-6">
            {error}
            <button onClick={() => search(query)} className="ml-2 underline hover:no-underline">
              Try again
            </button>
          </div>
        )}

        {/* Results */}
        {phase === "generating" && displayNames.length === 0 && <SkeletonCards />}

        {displayNames.length > 0 && (
          <div className="space-y-3">
            {displayNames.map((s) => {
              const isExpanded = expandedName === s.name;
              const availableCount = Object.values(s.availability).filter((r) => r.available).length;
              const checkedCount = Object.keys(s.availability).length;
              const totalPlatforms = platforms.length;

              return (
                <div
                  key={s.name}
                  className={`rounded-lg border transition-colors ${
                    isExpanded
                      ? "border-[var(--accent)]/40 bg-[var(--surface)]"
                      : "border-[var(--border)] hover:border-[var(--text-tertiary)]"
                  }`}
                >
                  <button
                    onClick={() => setExpandedName(isExpanded ? null : s.name)}
                    className="w-full text-left p-4"
                    aria-label={`${s.name}: ${availableCount} of ${totalPlatforms} platforms available`}
                  >
                    {/* Name + score row */}
                    <div className="flex items-center justify-between mb-2.5">
                      <span className="font-[family-name:var(--font-geist-mono)] text-base font-medium">
                        {s.name}
                      </span>
                      <span className="text-xs text-[var(--text-tertiary)]">
                        {checkedCount === totalPlatforms ? (
                          availableCount === totalPlatforms ? (
                            <span className="text-[var(--accent)]">Available everywhere!</span>
                          ) : (
                            `${availableCount}/${totalPlatforms} available`
                          )
                        ) : (
                          "Checking..."
                        )}
                      </span>
                    </div>

                    {/* Platform badges */}
                    <div className="flex flex-wrap gap-1.5">
                      {platforms.map((p) => (
                        <AvailabilityBadge key={p} platform={p} result={s.availability[p]} />
                      ))}
                    </div>
                  </button>

                  {/* Expanded: action links */}
                  {isExpanded && (
                    <div className="px-4 pb-4 pt-1 border-t border-[var(--border)]">
                      <div className="space-y-2 mt-3">
                        {platforms.map((platform) => {
                          const result = s.availability[platform];
                          if (!result) return null;
                          const isAvailable = result.available === true;
                          const linkFn = platformLinks[platform];
                          const labelFn = platformActionLabels[platform];
                          return (
                            <div key={platform} className="flex items-center justify-between text-sm">
                              <span className={isAvailable ? "text-[var(--text-primary)]" : "text-[var(--text-tertiary)]"}>
                                {labelFn(result.variant)}
                              </span>
                              {isAvailable ? (
                                <a
                                  href={linkFn(result.variant)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-[var(--accent)] hover:underline"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  Go →
                                </a>
                              ) : result.confidence === "error" ? (
                                <span className="text-xs text-[var(--error)]">Error</span>
                              ) : (
                                <span className="text-xs text-[var(--text-tertiary)]">Taken</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigator.clipboard.writeText(s.name);
                          setCopiedName(s.name);
                          setTimeout(() => setCopiedName(null), 2000);
                        }}
                        className="mt-3 w-full text-center text-xs text-[var(--text-secondary)] border border-[var(--border)] py-1.5 rounded-md hover:text-[var(--text-primary)] hover:border-[var(--text-tertiary)] transition-colors"
                      >
                        {copiedName === s.name ? "Copied!" : "Copy name"}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="w-full max-w-[640px] mx-auto px-5 py-6 border-t border-[var(--border)] text-xs text-[var(--text-tertiary)] flex gap-4">
        <a href="/api/suggest" target="_blank" rel="noopener noreferrer" className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors no-underline">API</a>
        <span>Telegram Bot</span>
        <span>MCP</span>
      </footer>
    </main>
  );
}

export default function Home() {
  return (
    <Suspense>
      <SearchPage />
    </Suspense>
  );
}
