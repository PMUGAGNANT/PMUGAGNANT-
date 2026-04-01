"use client";

import { useMemo } from "react";
import type { RaceProfile } from "@/lib/client-race-scoring";
import { interpretScore } from "@/lib/scoring-policy";

export type CourseCardProps = {
  raceTitle: string;
  subtitleLine: string;
  timeLabel: string;
  minutesUntilStart: number;
  displayScore: number;
  profile: RaceProfile;
  onClick: () => void;
};

function formatCountdown(minutes: number): string {
  if (minutes <= 0) return "Départ";
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} h` : `${h} h ${m}`;
}

function ctaLabel(score: number, action: string): string {
  if (score >= 9) return `${action} 🔥`;
  if (score >= 7) return "VOIR QUOI JOUER →";
  if (score >= 5) return "ANALYSER ⚠️";
  return "PASSER ❌";
}

export function CourseCard({
  raceTitle,
  subtitleLine,
  timeLabel,
  minutesUntilStart,
  displayScore,
  profile,
  onClick,
}: CourseCardProps) {
  const interpreted = useMemo(() => interpretScore(displayScore), [displayScore]);
  const progressPct = Math.min(100, Math.max(0, (displayScore / 10) * 100));
  const countdownUrgent = minutesUntilStart > 0 && minutesUntilStart < 30;

  const lines: Array<{ label: string; value: string }> = [];
  if (profile.favoriFragileNum != null) {
    lines.push({ label: "FAVORI FRAGILE", value: String(profile.favoriFragileNum) });
  }
  if (profile.valueBetNum != null) {
    lines.push({ label: "VALUE BET", value: String(profile.valueBetNum) });
  }
  const ticketStr = profile.ticketNums.length ? profile.ticketNums.join(" - ") : "—";
  lines.push({ label: "TICKET", value: ticketStr });

  const buttonStyle =
    displayScore >= 9
      ? { background: "#00FF88", color: "#0a1628" }
      : displayScore >= 7
        ? { background: "#00CC66", color: "#06210f" }
        : displayScore >= 5
          ? { background: "#FFB800", color: "#1a1200" }
          : { background: "#64748b", color: "#f8fafc" };

  return (
    <article className="app-card flex w-full flex-col gap-4 overflow-hidden p-5 text-left transition-[border-color,box-shadow] duration-300 ease-out hover:border-[color-mix(in_srgb,var(--pmu-primary)_50%,transparent)] hover:shadow-[var(--pmu-glow)]">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div
          className="inline-flex max-w-[70%] items-center gap-2 rounded-full px-3 py-1.5 text-xs font-black uppercase tracking-wide"
          style={{
            color: profile.color,
            backgroundColor: `${profile.color}22`,
            border: `1px solid ${profile.color}55`,
          }}
        >
          <span aria-hidden>{profile.emoji}</span>
          <span>{profile.label}</span>
        </div>
        <div
          className={`font-mono text-sm font-black tabular-nums ${countdownUrgent ? "text-red-500" : "text-[var(--pmu-text-muted)]"}`}
        >
          <span className="text-[var(--pmu-text)]">{timeLabel}</span>
          <span className="mx-1 opacity-60">•</span>
          <span>{formatCountdown(minutesUntilStart)}</span>
        </div>
      </div>

      <div>
        <h3 className="text-xl font-black leading-tight tracking-tight text-[var(--pmu-text)] md:text-2xl">{raceTitle}</h3>
        <p className="mt-1 text-sm font-semibold text-[var(--pmu-text-soft)]">{subtitleLine}</p>
      </div>

      <ul className="grid gap-1.5 text-sm">
        {lines.map((row) => (
          <li key={row.label} className="flex justify-between gap-3">
            <span className="font-bold uppercase tracking-wider text-[var(--pmu-text-muted)]">{row.label}</span>
            <span className="font-black text-[var(--pmu-text)]">{row.value}</span>
          </li>
        ))}
      </ul>

      <div className="space-y-2">
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-[var(--pmu-surface-2)]">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${progressPct}%`,
              background: interpreted.color,
            }}
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-black tabular-nums text-[var(--pmu-text)]">
            {Math.round(displayScore * 10) / 10}/10
          </span>
          <span className="text-sm font-black" style={{ color: interpreted.color }}>
            {interpreted.label} {interpreted.emoji}
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={onClick}
        className="w-full shrink-0 rounded-xl py-3.5 text-center text-sm font-black uppercase tracking-wide transition hover:opacity-92"
        style={buttonStyle}
      >
        {ctaLabel(displayScore, interpreted.action)}
      </button>
    </article>
  );
}
