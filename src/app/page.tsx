"use client";

import { useState, useRef, useEffect } from "react";
import { useChat } from "@ai-sdk/react";
import type { CheckResult } from "@/lib/types";
import { PLATFORMS, getPlatform } from "@/lib/platforms";

const EXAMPLES = [
  "a CLI that writes my git commit messages",
  "a calm meditation app for developers",
  "an open-source alternative to Notion",
  "a tool that turns voice memos into structured notes",
];

interface Suggestion {
  name: string;
  score: number;
  availability: Record<string, CheckResult>;
}
interface FindNamesOutput {
  platforms: string[];
  suggestions: Suggestion[];
}

function confirmedAvailable(r?: CheckResult): boolean {
  return r?.available === true;
}

function AvailabilityBadge({
  platformId,
  result,
}: {
  platformId: string;
  result?: CheckResult;
}) {
  const meta = getPlatform(platformId);
  const label = meta?.label ?? platformId;

  // Taken / unknown — quiet, non-clickable.
  if (!result || result.available !== true) {
    const isError = result?.confidence === "error";
    return (
      <span
        title={isError ? `Couldn't check (${result?.error})` : "Taken"}
        className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md border ${
          isError
            ? "border-[var(--error)]/30 text-[var(--error)] bg-[var(--error)]/5"
            : "border-[var(--border)] text-[var(--text-tertiary)] line-through decoration-[var(--text-tertiary)]/40"
        }`}
      >
        {label}
      </span>
    );
  }

  // Available — green, and a direct link to claim it.
  const href = meta?.claimUrl(result.variant);
  const likely = result.confidence === "likely";
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={`${meta?.claimVerb ?? "Claim"} ${meta?.format(result.variant) ?? result.variant}${
        likely ? " (likely available — not guaranteed)" : ""
      }`}
      className="group inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md border border-[var(--accent)]/40 bg-[var(--accent)]/10 text-[#86efac] hover:bg-[var(--accent)]/20 transition-colors"
    >
      <span className="text-[10px]">{likely ? "~" : "✓"}</span>
      {label}
    </a>
  );
}

function ResultCard({
  suggestion,
  platforms,
}: {
  suggestion: Suggestion;
  platforms: string[];
}) {
  const [copied, setCopied] = useState(false);
  const checkable = platforms.filter(
    (p) => suggestion.availability[p]?.confidence !== "error"
  );
  const availableCount = checkable.filter((p) =>
    confirmedAvailable(suggestion.availability[p])
  ).length;
  const allAvailable =
    checkable.length > 0 && availableCount === checkable.length;

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)]/40 p-4 hover:border-[var(--text-tertiary)] transition-colors">
      <div className="flex items-center justify-between gap-3 mb-3">
        <button
          onClick={() => {
            navigator.clipboard.writeText(suggestion.name);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="font-[family-name:var(--font-geist-mono)] text-lg font-medium hover:text-[var(--accent)] transition-colors"
          title="Copy name"
        >
          {suggestion.name}
        </button>
        <span className="text-xs whitespace-nowrap">
          {copied ? (
            <span className="text-[var(--accent)]">Copied!</span>
          ) : allAvailable ? (
            <span className="text-[var(--accent)]">Available everywhere</span>
          ) : (
            <span className="text-[var(--text-tertiary)]">
              {availableCount}/{checkable.length} free
            </span>
          )}
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {platforms.map((p) => (
          <AvailabilityBadge
            key={p}
            platformId={p}
            result={suggestion.availability[p]}
          />
        ))}
      </div>
    </div>
  );
}

function SearchingIndicator() {
  return (
    <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)] py-2">
      <span className="inline-block w-3.5 h-3.5 rounded-full border-2 border-[var(--border)] border-t-[var(--accent)] animate-spin" />
      Generating names &amp; checking availability…
    </div>
  );
}

export default function Home() {
  const { messages, sendMessage, status } = useChat();
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const hasConversation = messages.length > 0;
  const busy = status === "submitted" || status === "streaming";

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, status]);

  function submit(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    sendMessage({ text: trimmed });
    setInput("");
  }

  // Show a thinking indicator after the user sends, before the first tool part
  // streams back.
  const lastMessage = messages[messages.length - 1];
  const awaitingFirstResponse =
    busy && lastMessage?.role === "user";

  return (
    <main className="flex-1 flex flex-col w-full max-w-[720px] mx-auto px-5">
      {/* Header */}
      <header className="pt-8 pb-4 flex items-baseline gap-3">
        <h1 className="text-lg font-semibold tracking-tight">Vacant</h1>
        <p className="text-sm text-[var(--text-tertiary)]">
          Find a name that&apos;s actually free.
        </p>
      </header>

      {/* Empty-state hero */}
      {!hasConversation && (
        <div className="flex-1 flex flex-col justify-center pb-24">
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight mb-2">
            What are you building?
          </h2>
          <p className="text-[var(--text-secondary)] mb-6 max-w-md">
            Describe it in a sentence. I&apos;ll suggest brandable names and check
            the <span className="text-[var(--text-primary)]">.com</span>, npm,
            GitHub, and YouTube handle for each — live.
          </p>
          <ComposerForm
            input={input}
            setInput={setInput}
            onSubmit={submit}
            busy={busy}
            autoFocus
          />
          <div className="flex flex-wrap gap-2 mt-4">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                onClick={() => submit(ex)}
                disabled={busy}
                className="text-xs text-[var(--text-secondary)] border border-[var(--border)] rounded-full px-3 py-1.5 hover:border-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-50"
              >
                {ex}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Conversation */}
      {hasConversation && (
        <div className="flex-1 space-y-6 py-4">
          {messages.map((message) => (
            <div key={message.id}>
              {message.parts.map((part, i) => {
                if (part.type === "text") {
                  if (!part.text.trim()) return null;
                  return message.role === "user" ? (
                    <div key={i} className="flex justify-end">
                      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl rounded-br-sm px-4 py-2 text-sm max-w-[85%]">
                        {part.text}
                      </div>
                    </div>
                  ) : (
                    <p
                      key={i}
                      className="text-sm text-[var(--text-secondary)]"
                    >
                      {part.text}
                    </p>
                  );
                }

                if (part.type === "tool-findNames") {
                  if (
                    part.state === "input-streaming" ||
                    part.state === "input-available"
                  ) {
                    return <SearchingIndicator key={i} />;
                  }
                  if (part.state === "output-error") {
                    return (
                      <div
                        key={i}
                        className="text-sm text-[var(--error)] py-2"
                      >
                        Something went wrong finding names. Try rephrasing?
                      </div>
                    );
                  }
                  if (part.state === "output-available") {
                    const out = part.output as FindNamesOutput;
                    if (!out?.suggestions?.length) {
                      return (
                        <p
                          key={i}
                          className="text-sm text-[var(--text-secondary)] py-2"
                        >
                          Couldn&apos;t find good candidates — try adding a bit
                          more detail.
                        </p>
                      );
                    }
                    return (
                      <div
                        key={i}
                        className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3"
                      >
                        {out.suggestions.map((s) => (
                          <ResultCard
                            key={s.name}
                            suggestion={s}
                            platforms={out.platforms}
                          />
                        ))}
                      </div>
                    );
                  }
                }
                return null;
              })}
            </div>
          ))}
          {awaitingFirstResponse && <SearchingIndicator />}
          <div ref={scrollRef} />
        </div>
      )}

      {/* Sticky composer once chatting */}
      {hasConversation && (
        <div className="sticky bottom-0 bg-gradient-to-t from-[var(--bg)] via-[var(--bg)] to-transparent pt-4 pb-5">
          <ComposerForm
            input={input}
            setInput={setInput}
            onSubmit={submit}
            busy={busy}
            placeholder="Refine (e.g. “shorter”, “more playful”) or describe something new…"
          />
        </div>
      )}
    </main>
  );
}

function ComposerForm({
  input,
  setInput,
  onSubmit,
  busy,
  placeholder = "Describe what you're building…",
  autoFocus = false,
}: {
  input: string;
  setInput: (v: string) => void;
  onSubmit: (text: string) => void;
  busy: boolean;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(input);
      }}
      className="flex gap-2"
    >
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="flex-1 bg-[var(--surface)] border border-[var(--border)] rounded-lg px-4 py-3 text-sm placeholder:text-[var(--text-tertiary)] outline-none focus:border-[var(--accent)] transition-colors"
      />
      <button
        type="submit"
        disabled={busy || !input.trim()}
        className="bg-[var(--accent)] text-[var(--bg)] text-sm font-semibold px-5 py-3 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
      >
        {busy ? "…" : "Find names"}
      </button>
    </form>
  );
}
