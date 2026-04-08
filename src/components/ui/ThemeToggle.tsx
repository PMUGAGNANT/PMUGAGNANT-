"use client";

import { useTheme } from "./ThemeProvider";

type ThemeToggleProps = {
  compact?: boolean;
  className?: string;
};

export function ThemeToggle({ compact = false, className = "" }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();
  const isWarm = theme === "warm";
  const label = isWarm ? "Clair" : "Nuit";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`inline-flex items-center justify-center gap-3 rounded-full border border-[var(--pmu-border-strong)] bg-[color-mix(in_srgb,var(--pmu-surface-2)_84%,transparent)] font-bold transition hover:-translate-y-px hover:border-[var(--pmu-primary)] ${
        compact ? "mx-auto px-3 py-2 text-[11px]" : "w-full px-4 py-3 text-sm"
      } ${className}`}
      style={{ color: "var(--pmu-text)", boxShadow: "var(--pmu-shadow-sm)" }}
      aria-pressed={isWarm}
      aria-label={isWarm ? "Passer au mode nuit" : "Passer au mode clair"}
      title={isWarm ? "Mode nuit" : "Mode clair"}
    >
      <span
        className="relative inline-flex h-6 w-11 items-center rounded-full border border-[var(--pmu-border)] bg-[var(--pmu-bg)] px-1"
        aria-hidden
      >
        <span
          className={`h-4 w-4 rounded-full transition-all duration-300 ${
            isWarm ? "translate-x-5 bg-[var(--pmu-primary)]" : "translate-x-0 bg-[var(--pmu-accent-violet)]"
          }`}
        />
      </span>
      <span className="text-[var(--pmu-text-soft)]">{compact ? label : `Theme ${label}`}</span>
    </button>
  );
}
