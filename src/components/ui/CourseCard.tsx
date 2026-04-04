"use client";

import { useMemo } from "react";
import type { RaceProfile } from "@/lib/client-race-scoring";
import type { EloProfile } from "@/lib/elo-scoring";
import { getEloGlobalBadgeStyle } from "@/lib/elo-scoring";
import type { IndiceOuverture } from "@/lib/ouverture";
import { interpretScore } from "@/lib/scoring-policy";
import {
  interpretScoreForBeginner,
  eloForBeginner,
  translateFactors,
} from "@/lib/beginner-labels";
import { WhyThisHorse } from "@/components/ui/WhyThisHorse";

export type CourseCardProps = {
  raceTitle: string;
  subtitleLine: string;
  timeLabel: string;
  minutesUntilStart: number;
  displayScore: number;
  profile: RaceProfile;
  eloProfile: EloProfile;
  onClick: () => void;
  indiceOuverture?: IndiceOuverture | null;
  pickNum?: number | null;
  pickNom?: string | null;
  pickConfidence?: number | null;
  pickBetType?: string | null;
  topFacteurs?: string[];
};

function formatCountdown(minutes: number): string {
  if (minutes <= 0) return "Départ";
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} h` : `${h} h ${m}`;
}

function ctaLabel(score: number): string {
  if (score >= 9) return "Voir le détail du signal";
  if (score >= 7) return "Voir la sélection";
  if (score >= 5) return "Surveiller la course";
  return "Course à éviter";
}

export function CourseCard({
  raceTitle,
  subtitleLine,
  timeLabel,
  minutesUntilStart,
  displayScore,
  profile,
  eloProfile,
  onClick,
  indiceOuverture = null,
  pickNum,
  pickNom,
  pickConfidence,
  pickBetType,
  topFacteurs,
}: CourseCardProps) {
  const interpreted = useMemo(() => interpretScore(displayScore), [displayScore]);
  const beginnerLabel = useMemo(
    () => interpretScoreForBeginner(displayScore),
    [displayScore]
  );
  const eloLabel = useMemo(
    () => eloForBeginner(eloProfile.eloGlobal),
    [eloProfile.eloGlobal]
  );
  const eloBadge = useMemo(
    () => getEloGlobalBadgeStyle(eloProfile.eloGlobal),
    [eloProfile.eloGlobal]
  );
  const progressPct = Math.min(100, Math.max(0, (displayScore / 10) * 100));
  const countdownUrgent = minutesUntilStart > 0 && minutesUntilStart < 30;

  const translatedFactors = useMemo(
    () => translateFactors(topFacteurs ?? []),
    [topFacteurs]
  );

  const lines: Array<{ label: string; value: string; tooltip?: string }> = [];
  if (profile.favoriFragileNum != null) {
    lines.push({
      label: "Favori fragile",
      value: `N°${profile.favoriFragileNum}`,
      tooltip: "Ce favori semble surévalué par le marché.",
    });
  }
  if (profile.valueBetNum != null) {
    lines.push({
      label: "Bonne affaire",
      value: `N°${profile.valueBetNum}`,
      tooltip: "Une cote plus haute que la valeur estimée.",
    });
  }
  const ticketStr = profile.ticketNums.length
    ? profile.ticketNums.map((n) => `N°${n}`).join(" · ")
    : "—";
  lines.push({
    label: profile.ticketNums.length > 1 ? "Sélection" : "Cheval retenu",
    value: ticketStr,
  });

  const buttonStyle =
    displayScore >= 9
      ? { background: "#00FF88", color: "#0a1628" }
      : displayScore >= 7
        ? { background: "#00CC66", color: "#06210f" }
        : displayScore >= 5
          ? { background: "#FFB800", color: "#1a1200" }
          : { background: "#64748b", color: "#f8fafc" };

  return (
    <article className="app-card flex w-full flex-col gap-3 overflow-hidden rounded-xl p-4 text-left hover:border-[var(--pmu-border-strong)]">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div
          className="inline-flex max-w-[72%] items-center gap-2 rounded-full px-2.5 py-1.5 text-[11px] font-black uppercase tracking-[0.12em]"
          style={{
            color: beginnerLabel.color,
            backgroundColor: `${beginnerLabel.color}14`,
            border: `1px solid ${beginnerLabel.color}26`,
          }}
        >
          <span aria-hidden>{beginnerLabel.emoji}</span>
          <span>{beginnerLabel.label}</span>
        </div>
        <div
          className={`font-mono text-xs font-bold tabular-nums ${countdownUrgent ? "text-red-500" : "text-[var(--pmu-text-muted)]"}`}
        >
          <span className="text-[var(--pmu-text)]">{timeLabel}</span>
          <span className="mx-1 opacity-60">•</span>
          <span>{formatCountdown(minutesUntilStart)}</span>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-black leading-tight tracking-tight text-[var(--pmu-text)] md:text-xl">
          {raceTitle}
        </h3>
        <p className="mt-1 text-sm font-medium text-[var(--pmu-text-soft)]">
          {subtitleLine}
        </p>
      </div>

      <div
        className="rounded-lg border px-2.5 py-1.5"
        style={{
          borderColor: "var(--pmu-border)",
          background:
            "color-mix(in srgb, var(--pmu-surface-2) 78%, transparent)",
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[10px] font-black uppercase tracking-[0.12em] text-[var(--pmu-text-muted)]">
            Fiabilité de l’analyse
          </span>
          <span
            className="rounded-full px-2 py-0.5 text-[11px] font-black"
            style={{
              color: eloBadge.color,
              background: "color-mix(in srgb, white 8%, transparent)",
            }}
          >
            {eloLabel.label}
          </span>
        </div>
        <p className="mt-1 text-[10px] font-medium text-[var(--pmu-text-soft)]">
          {eloLabel.tooltip}
        </p>
      </div>

      <ul className="grid gap-1 text-sm">
        {lines.map((row) => (
          <li
            key={row.label}
            className="flex justify-between gap-3 rounded-lg bg-[var(--pmu-surface-2)] px-3 py-1.5"
          >
            <span className="font-semibold text-[var(--pmu-text-muted)]">
              {row.label}
            </span>
            <span className="font-black text-[var(--pmu-text)]">{row.value}</span>
          </li>
        ))}
      </ul>

      {pickNum && translatedFactors.length > 0 ? (
        <WhyThisHorse
          horseName={pickNom ?? ""}
          horseNum={pickNum}
          topFacteurs={translatedFactors}
          confidence={pickConfidence ?? displayScore}
          betType={pickBetType}
          mode="compact"
        />
      ) : null}

      <div className="space-y-2">
        <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--pmu-surface-2)]">
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
            {beginnerLabel.label} {beginnerLabel.emoji}
          </span>
        </div>
        {indiceOuverture ? (
          <p className="text-[10px] font-medium leading-snug text-[var(--pmu-text-soft)]">
            <span style={{ color: indiceOuverture.color }}>
              {indiceOuverture.emoji}
            </span>{" "}
            <span className="uppercase tracking-[0.08em] text-[var(--pmu-text-muted)]">
              Lisibilité
            </span>{" "}
            · {indiceOuverture.label} ({indiceOuverture.score}/10)
          </p>
        ) : null}
      </div>

      <button
        type="button"
        onClick={onClick}
        className="w-full shrink-0 rounded-lg py-2.5 text-center text-sm font-bold transition hover:opacity-92"
        style={buttonStyle}
      >
        {ctaLabel(displayScore)}
      </button>
    </article>
  );
}
