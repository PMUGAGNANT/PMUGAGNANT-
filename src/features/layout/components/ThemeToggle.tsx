"use client";

import { useTheme } from "@/components/ui/ThemeProvider";

type ThemeToggleProps = {
  compact?: boolean;
  className?: string;
};

function SunIcon() {
  return (
    <svg
      className="h-4 w-4"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      aria-hidden
    >
      <circle cx="10" cy="10" r="3.2" />
      <path d="M10 1.8v2.1M10 16.1v2.1M18.2 10h-2.1M3.9 10H1.8M15.8 4.2l-1.5 1.5M5.7 14.3l-1.5 1.5M15.8 15.8l-1.5-1.5M5.7 5.7L4.2 4.2" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      className="h-4 w-4"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      aria-hidden
    >
      <path d="M14.7 12.9A6.6 6.6 0 017 5.3a6.9 6.9 0 108.7 8.7z" />
    </svg>
  );
}

export function ThemeToggle({
  compact = false,
  className = "",
}: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();
  const isWarm = theme === "warm";
  const title = isWarm ? "Basculer en mode nuit" : "Basculer en mode clair";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`inline-flex items-center gap-3 rounded-[1.1rem] border border-[var(--pmu-border)] bg-[color-mix(in_srgb,var(--pmu-surface)_88%,transparent)] text-left text-[var(--pmu-text)] shadow-[var(--pmu-shadow-sm)] transition hover:-translate-y-px hover:border-[var(--pmu-border-strong)] ${
        compact ? "px-3 py-2.5" : "w-full px-4 py-3.5"
      } ${className}`}
      aria-pressed={isWarm}
      aria-label={title}
      title={title}
    >
      <span
        className={`inline-flex items-center gap-1 rounded-full border border-[var(--pmu-border)] bg-[var(--pmu-bg)] p-1 ${
          compact ? "text-[var(--pmu-text-muted)]" : "text-[var(--pmu-text-soft)]"
        }`}
        aria-hidden
      >
        <span
          className={`flex h-7 w-7 items-center justify-center rounded-full transition ${
            isWarm
              ? "bg-[var(--pmu-primary)] text-[var(--pmu-on-primary)] shadow-[var(--pmu-shadow-sm)]"
              : "text-[var(--pmu-text-soft)]"
          }`}
        >
          <SunIcon />
        </span>
        <span
          className={`flex h-7 w-7 items-center justify-center rounded-full transition ${
            !isWarm
              ? "bg-[var(--pmu-surface-highlight)] text-[var(--pmu-text)] shadow-[var(--pmu-shadow-sm)]"
              : "text-[var(--pmu-text-soft)]"
          }`}
        >
          <MoonIcon />
        </span>
      </span>

      <span className="min-w-0 flex-1">
        <span className="block text-sm font-extrabold">
          {isWarm ? "Mode clair" : "Mode nuit"}
        </span>
        {!compact ? (
          <span className="mt-0.5 block text-xs font-medium text-[var(--pmu-text-muted)]">
            {isWarm
              ? "Canvas lumineux, contrastes propres"
              : "Lecture dense et plus technique"}
          </span>
        ) : null}
      </span>
    </button>
  );
}
