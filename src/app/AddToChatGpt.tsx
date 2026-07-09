"use client";

import { useEffect, useId, useRef, useState } from "react";

const STEPS = [
  <>
    In ChatGPT, open <strong className="font-semibold">Settings → Apps &amp; Connectors</strong> and
    turn on <strong className="font-semibold">Developer mode</strong>.
  </>,
  <>
    Choose <strong className="font-semibold">Create</strong>, then paste the connector URL below.
  </>,
  <>
    Authorize WishlistGPT. Now, whenever ChatGPT shows you a product, say{" "}
    <strong className="font-semibold">&ldquo;save this&rdquo;</strong>.
  </>,
];

export function AddToChatGpt({ mcpUrl }: { mcpUrl: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(resetTimer.current), []);

  // Dismiss the popover the way a popover is expected to dismiss.
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(mcpUrl);
    } catch {
      return; // Clipboard blocked (insecure origin, denied permission) — the URL is still selectable.
    }
    setCopied(true);
    clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        className="rounded-button border border-border dark:border-border-dark px-7 py-3 font-semibold inline-flex items-center gap-2 hover:bg-background-light dark:hover:bg-background-dark-light transition-colors"
      >
        Add to ChatGPT
        <svg
          viewBox="0 0 12 12"
          aria-hidden="true"
          className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path
            d="M2.5 4.5 6 8l3.5-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open ? (
        // Absolute so expanding never nudges the primary CTA beside it.
        <div
          id={panelId}
          className="absolute z-20 top-full left-1/2 -translate-x-1/2 mt-3 w-[min(28rem,calc(100vw-2.5rem))] rounded-card border border-border dark:border-border-dark bg-background-light dark:bg-background-dark-light shadow-card dark:shadow-card-dark p-5 text-left"
        >
          <ol className="flex flex-col gap-3">
            {STEPS.map((step, i) => (
              <li key={i} className="flex gap-3">
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-accent text-accent-fg text-[10px] font-bold">
                  {i + 1}
                </span>
                <span className="text-sm leading-relaxed text-secondary dark:text-secondary-dark">
                  {step}
                </span>
              </li>
            ))}
          </ol>

          <div className="mt-4 flex items-center gap-2 rounded-button border border-border dark:border-border-dark bg-sunken dark:bg-sunken-dark p-1.5 pl-3">
            <code className="flex-1 truncate font-mono text-xs">{mcpUrl}</code>
            <button
              type="button"
              onClick={copy}
              className="shrink-0 rounded-[6px] bg-accent text-accent-fg px-3 py-1.5 text-xs font-semibold hover:bg-accent/90 transition-colors"
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <span aria-live="polite" className="sr-only">
            {copied ? "Connector URL copied to clipboard" : ""}
          </span>

          <p className="mt-3 text-xs text-secondary dark:text-secondary-dark">
            Developer mode requires a paid ChatGPT plan. We&apos;re working on a one-tap install via
            the ChatGPT app directory.
          </p>
        </div>
      ) : null}
    </div>
  );
}
