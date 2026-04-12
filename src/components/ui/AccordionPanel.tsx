"use client";

import { useId, useState, type ReactNode } from "react";

type AccordionPanelProps = {
  title: string;
  kicker?: string;
  summary?: string;
  children: ReactNode;
  defaultOpen?: boolean;
  open?: boolean;
  onToggle?: (next: boolean) => void;
  bodyClassName?: string;
};

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      className={`h-4 w-4 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M5.5 7.5L10 12l4.5-4.5" />
    </svg>
  );
}

export function AccordionPanel({
  title,
  kicker,
  summary,
  children,
  defaultOpen = false,
  open,
  onToggle,
  bodyClassName = "",
}: AccordionPanelProps) {
  const panelId = useId();
  const isControlled = typeof open === "boolean";
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isOpen = isControlled ? open : internalOpen;

  function handleToggle() {
    const next = !isOpen;
    if (!isControlled) {
      setInternalOpen(next);
    }
    onToggle?.(next);
  }

  return (
    <section className="overflow-hidden rounded-[1.25rem] border border-[var(--pmu-border)] bg-[color-mix(in_srgb,var(--pmu-surface-2)_88%,transparent)]">
      <button
        type="button"
        onClick={handleToggle}
        aria-expanded={isOpen}
        aria-controls={panelId}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-[color-mix(in_srgb,var(--pmu-surface-highlight)_22%,var(--pmu-surface-2)_78%)]"
      >
        <div className="min-w-0 flex-1">
          {kicker ? <p className="app-kicker text-[10px]">{kicker}</p> : null}
          <div className="mt-1 flex items-center gap-2">
            <p className="min-w-0 flex-1 truncate text-sm font-black text-[var(--pmu-text)]">{title}</p>
            {summary ? (
              <span className="rounded-full border border-[var(--pmu-border)] bg-[var(--pmu-surface)] px-2.5 py-1 text-[10px] font-bold text-[var(--pmu-text-soft)]">
                {summary}
              </span>
            ) : null}
          </div>
        </div>
        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--pmu-border)] bg-[var(--pmu-surface)] text-[var(--pmu-text-soft)]">
          <Chevron open={isOpen} />
        </span>
      </button>

      {isOpen ? (
        <div id={panelId} className={`border-t border-[var(--pmu-border)] px-4 py-4 ${bodyClassName}`}>
          {children}
        </div>
      ) : null}
    </section>
  );
}
