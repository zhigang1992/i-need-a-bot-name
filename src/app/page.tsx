"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import type { CheckResult } from "@/lib/types";

function AvailabilityIcon({ result }: { result: CheckResult }) {
  if (result.confidence === "error") {
    return (
      <span className="text-[var(--error)]" title={result.error || "Couldn't check"}>
        &#x26A0;
      </span>
    );
  }
  if (result.available) {
    return <span className="text-[var(--accent)]">&#x2713;</span>;
  }
  return <span className="text-[var(--taken)]">&mdash;</span>;
}

function SpinnerDot() {
  return (
    <span className="inline-block w-3 h-3 rounded-full border-2 border-[var(--border)] border-t-[var(--text-tertiary)] animate-spin" />
  );
}

interface StreamingName {
  name: string;
  relevance: number;
  availability: Record<string, CheckResult>;
  score?: number;
}

function SkeletonRows() {
  return (
    <>
      {[1, 2, 3].map((i) => (
        <div key={i} className="grid grid-cols-[1fr_auto_repeat(4,40px)] items-center min-h-[44px] border-b border-[var(--border)]">
          <span className="px-2 py-2.5">
            <div className="skeleton h-4" style={{ width: 80 + i * 20 }} />
          </span>
          <span className="px-2 py-2.5">
            <div className="skeleton h-4 w-8" />
          </span>
          {["a", "b", "c", "d"].map((p) => (
            <span key={p} className="flex justify-center py-2.5">
              <div className="skeleton h-4 w-4 rounded-full" />
            </span>
          ))}
        </div>
      ))}
    </>
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

      // Abort previous request
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
          body: JSON.stringify({ description: description.trim(), count: 5 }),
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
      setNames(incoming.map((n) => ({ name: n.name, relevance: n.relevance, availability: {} })));
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
      // Update scores and set final order
      setNames((prev) =>
        prev.map((n) => {
          const final = suggestions.find((s) => s.name === n.name);
          return final ? { ...n, score: final.score, availability: final.availability } : n;
        })
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
  const platformHeaders: Record<string, string> = {
    domain: ".com",
    npm: "npm",
    github: "github",
    telegram: "telegram",
  };

  const platformLinks: Record<string, (v: string) => string> = {
    domain: (v) => `https://www.namecheap.com/domains/registration/results/?domain=${v}`,
    npm: (v) => `https://www.npmjs.com/package/${v}`,
    github: () => `https://github.com/organizations/new?plan=free`,
    telegram: () => `https://t.me/BotFather`,
  };

  const platformLabels: Record<string, (v: string) => string> = {
    domain: (v) => v,
    npm: (v) => `npm: ${v}`,
    github: (v) => `github.com/${v}`,
    telegram: (v) => `@${v}`,
  };

  // Sort names by final ranking order if available, otherwise show as-is
  const displayNames = finalOrder
    ? finalOrder.map((n) => names.find((x) => x.name === n)).filter(Boolean) as StreamingName[]
    : names;

  const isLoading = phase === "generating" || phase === "checking";

  return (
    <main className="flex-1 flex flex-col">
      <div className="w-full max-w-[720px] mx-auto px-6 py-12 flex-1">
        {/* Header */}
        <div className="flex items-baseline gap-2 mb-8">
          <h1 className="text-xl font-semibold font-[family-name:var(--font-geist-sans)]">needaname</h1>
          <span className="text-sm text-[var(--text-secondary)]">
            find a name that&apos;s available everywhere
          </span>
        </div>

        {/* Search */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            search(query);
          }}
          className="flex gap-2 mb-8 max-md:flex-col"
        >
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="an AI coding assistant"
            autoFocus
            className="flex-1 bg-[var(--surface)] border border-[var(--border)] rounded-[4px] px-3.5 py-2.5 text-sm text-[var(--text-primary)] font-[family-name:var(--font-geist-sans)] placeholder:font-[family-name:var(--font-geist-mono)] placeholder:text-[var(--text-tertiary)] placeholder:text-xs outline-none focus:border-[var(--accent)] transition-colors"
          />
          <button
            type="submit"
            disabled={isLoading || !query.trim()}
            className="bg-[var(--accent)] text-[var(--bg)] font-[family-name:var(--font-geist-mono)] text-sm font-semibold px-5 py-2.5 rounded-[4px] hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap max-md:w-full"
          >
            {phase === "generating" ? "Thinking..." : phase === "checking" ? "Checking..." : "Find Names"}
          </button>
        </form>

        {/* Error */}
        {error && (
          <div className="bg-[#450a0a] border-l-[3px] border-[#ef4444] text-[#fca5a5] text-sm px-3.5 py-2.5 rounded-[4px] mb-6">
            {error}
            <button onClick={() => search(query)} className="ml-2 underline hover:no-underline">
              Try again
            </button>
          </div>
        )}

        {/* Results */}
        {(isLoading || displayNames.length > 0) && (
          <div className="w-full">
            {/* Header row — uses same grid as data rows for alignment */}
            <div className="grid grid-cols-[1fr_auto_repeat(4,40px)] items-center border-b border-[var(--border)]">
              <span className="font-[family-name:var(--font-geist-mono)] text-[11px] font-medium text-[var(--text-tertiary)] uppercase tracking-[0.05em] text-left px-2 py-1.5">
                name
              </span>
              <span className="font-[family-name:var(--font-geist-mono)] text-[11px] font-medium text-[var(--text-tertiary)] uppercase tracking-[0.05em] text-left px-2 py-1.5">
                score
              </span>
              {platforms.map((p) => (
                <span
                  key={p}
                  className="font-[family-name:var(--font-geist-mono)] text-[11px] font-medium text-[var(--text-tertiary)] uppercase tracking-[0.05em] text-center px-2 py-1.5"
                >
                  {platformHeaders[p]}
                </span>
              ))}
            </div>
            <div>
              {phase === "generating" && displayNames.length === 0 ? (
                <SkeletonRows />
              ) : (
                displayNames.map((s) => (
                  <div key={s.name} className="border-b border-[var(--border)] last:border-b-0">
                      <button
                        onClick={() =>
                          setExpandedName(expandedName === s.name ? null : s.name)
                        }
                        className="w-full text-left hover:bg-[var(--surface)] transition-colors"
                        aria-label={`${s.name}: ${platforms
                          .map((p) => {
                            const r = s.availability[p];
                            if (!r) return "checking";
                            return r.available ? `available on ${p}` : `not available on ${p}`;
                          })
                          .join(", ")}`}
                      >
                        <div className="grid grid-cols-[1fr_auto_repeat(4,40px)] items-center min-h-[44px]">
                          <span className="font-[family-name:var(--font-geist-mono)] text-sm font-medium px-2 py-2.5">
                            {s.name}
                          </span>
                          <span className="font-[family-name:var(--font-geist-mono)] text-xs text-[var(--text-secondary)] px-2 py-2.5">
                            {s.score !== undefined ? s.score.toFixed(2) : (
                              <span className="text-[var(--text-tertiary)]">···</span>
                            )}
                          </span>
                          {platforms.map((p) => (
                            <span key={p} className="text-center text-sm py-2.5">
                              {s.availability[p] ? (
                                <AvailabilityIcon result={s.availability[p]} />
                              ) : (
                                <SpinnerDot />
                              )}
                            </span>
                          ))}
                        </div>
                      </button>
                      {expandedName === s.name && (
                        <div className="flex flex-wrap gap-2 items-center px-2 py-3 bg-[var(--surface)] rounded-[6px] mt-1 mb-2 max-md:flex-col max-md:items-stretch">
                          {platforms.map((platform) => {
                            const result = s.availability[platform];
                            if (!result) {
                              return (
                                <span
                                  key={platform}
                                  className="font-[family-name:var(--font-geist-mono)] text-xs text-[var(--text-tertiary)] px-2.5 py-1 border border-[var(--border)] rounded-[4px]"
                                >
                                  checking {platformHeaders[platform]}...
                                </span>
                              );
                            }
                            const isAvailable = result.available === true;
                            const linkFn = platformLinks[platform];
                            const labelFn = platformLabels[platform];
                            return (
                              <a
                                key={platform}
                                href={isAvailable ? linkFn(result.variant) : undefined}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`font-[family-name:var(--font-geist-mono)] text-xs px-2.5 py-1 rounded-[4px] border transition-colors ${
                                  isAvailable
                                    ? "text-[var(--accent)] border-[var(--accent-dim)] hover:bg-[var(--accent-dim)]"
                                    : "text-[var(--taken)] border-[var(--border)] pointer-events-none"
                                }`}
                              >
                                {labelFn(result.variant)} {isAvailable ? "→" : ""}
                              </a>
                            );
                          })}
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(s.name);
                              setCopiedName(s.name);
                              setTimeout(() => setCopiedName(null), 2000);
                            }}
                            className="font-[family-name:var(--font-geist-mono)] text-xs text-[var(--text-secondary)] border border-[var(--border)] px-2.5 py-1 rounded-[4px] hover:text-[var(--text-primary)] hover:border-[var(--text-tertiary)] transition-colors md:ml-auto"
                          >
                            {copiedName === s.name ? "copied!" : "copy name"}
                          </button>
                        </div>
                      )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="w-full max-w-[720px] mx-auto px-6 py-6 border-t border-[var(--border)] font-[family-name:var(--font-geist-mono)] text-[11px] text-[var(--text-tertiary)] flex gap-4">
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
