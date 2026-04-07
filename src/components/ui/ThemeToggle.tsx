"use client";

import { useTheme } from "./ThemeProvider";

type ThemeToggleProps = {
  /** Variante compacte pour la barre du bas mobile */
  compact?: boolean;
  className?: string;
};

export function ThemeToggle({ compact = false, className = "" }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();
  const isWarm = theme === "warm";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`inline-flex items-center justify-center gap-2 rounded-2xl border border-[var(--pmu-border-strong)] bg-[var(--pmu-surface-2)] font-bold transition hover:border-[var(--pmu-primary)] hover:opacity-95 ${
        compact ? "mx-auto px-3 py-2 text-[11px]" : "w-full px-4 py-3 text-sm"
      } ${className}`}
      style={{ color: "var(--pmu-text)" }}
      aria-pressed={isWarm}
      aria-label={isWarm ? "Passer au mode nuit" : "Passer au mode clair"}
      title={isWarm ? "Mode nuit" : "Mode clair"}
    >
      <span className="text-base leading-none" aria-hidden>
        {isWarm ? "🌙" : "☀️"}
      </span>
      <span className="text-[var(--pmu-text-soft)]">{compact ? (isWarm ? "Nuit" : "Clair") : isWarm ? "Mode nuit" : "Mode clair"}</span>
    </button>
  );
}
