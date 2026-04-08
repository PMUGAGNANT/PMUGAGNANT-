"use client";

import { useMemo, useState } from "react";
import { AccordionPanel } from "@/components/ui/AccordionPanel";
import { WhyThisHorse } from "@/components/ui/WhyThisHorse";
import {
  eloForBeginner,
  interpretScoreForBeginner,
  translateFactors,
} from "@/lib/beginner-labels";
import type { RaceProfile } from "@/lib/client-race-scoring";
import type { EloProfile } from "@/lib/elo-scoring";
import { getEloGlobalBadgeStyle } from "@/lib/elo-scoring";
import type { IndiceOuverture } from "@/lib/ouverture";
import { interpretScore } from "@/lib/scoring-policy";

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
  if (minutes <= 0) return "Depart";
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} h` : `${h} h ${m}`;
}

function ctaLabel(score: number): string {
  if (score >= 9) return "Ouvrir le signal";
  if (score >= 7) return "Voir la selection";
  if (score >= 5) return "Surveiller la course";
  return "Lire la course";
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
  const [openPanel, setOpenPanel] = useState<"analysis" | "ticket" | "why" | null>(
    null
  );
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

  const lines: Array<{ label: string; value: string }> = [];
  if (profile.favoriFragileNum != null) {
    lines.push({ label: "Favori fragile", value: `#${profile.favoriFragileNum}` });
  }
  if (profile.valueBetNum != null) {
    lines.push({ label: "Spot value", value: `#${profile.valueBetNum}` });
  }

  const ticketStr = profile.ticketNums.length
    ? profile.ticketNums.map((n) => `#${n}`).join(" - ")
    : "A confirmer";
  lines.push({
    label: profile.ticketNums.length > 1 ? "Selection" : "Cheval retenu",
    value: ticketStr,
  });

  const ticketSummary =
    lines.find((row) => row.label === "Selection" || row.label === "Cheval retenu")
      ?.value ?? "A confirmer";
  const whySummary =
    pickNum && translatedFactors.length > 0
      ? `${translatedFactors.length} signaux`
      : "Lecture en attente";

  return (
    <article className="app-card flex h-full w-full flex-col gap-5 p-5 text-left">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div
          className="inline-flex max-w-[78%] items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.16em]"
          style={{
            color: beginnerLabel.color,
            backgroundColor: `color-mix(in srgb, ${beginnerLabel.color} 14%, var(--pmu-surface))`,
            border: `1px solid color-mix(in srgb, ${beginnerLabel.color} 26%, transparent)`,
          }}
        >
          <span aria-hidden>{beginnerLabel.emoji}</span>
          <span>{beginnerLabel.label}</span>
        </div>

        <div
          className={`rounded-full border px-3 py-1.5 font-mono text-xs font-bold tabular-nums ${
            countdownUrgent
              ? "border-[color-mix(in_srgb,var(--pmu-red)_35%,transparent)] text-[var(--pmu-red)]"
              : "border-[var(--pmu-border)] text-[var(--pmu-text-muted)]"
          }`}
        >
          <span className="text-[var(--pmu-text)]">{timeLabel}</span>
          <span className="mx-1 opacity-60">-</span>
          <span>{formatCountdown(minutesUntilStart)}</span>
        </div>
      </div>

      <div>
        <h3 className="text-[1.45rem] font-black leading-[1.02] text-[var(--pmu-text)] md:text-[1.8rem]">
          {raceTitle}
        </h3>
        <p className="mt-2 text-sm font-medium leading-6 text-[var(--pmu-text-soft)]">
          {subtitleLine}
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="app-card-muted px-4 py-4">
          <p className="app-label">Score</p>
          <p className="mt-2 text-2xl font-black text-[var(--pmu-text)]">
            {displayScore.toFixed(1)}/10
          </p>
        </div>
        <div className="app-card-muted px-4 py-4">
          <p className="app-label">Ticket</p>
          <p className="mt-2 text-sm font-black text-[var(--pmu-text)]">
            {ticketSummary}
          </p>
        </div>
        <div className="app-card-muted px-4 py-4">
          <p className="app-label">Lecture</p>
          <p className="mt-2 text-sm font-black" style={{ color: eloBadge.color }}>
            {eloLabel.label}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <AccordionPanel
          kicker="Bloc analyse"
          title="Fiabilite du signal"
          summary={eloLabel.label}
          open={openPanel === "analysis"}
          onToggle={(next) => setOpenPanel(next ? "analysis" : null)}
        >
          <div className="rounded-[1.1rem] border border-[var(--pmu-border)] bg-[color-mix(in_srgb,var(--pmu-surface)_86%,transparent)] px-4 py-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--pmu-text-muted)]">
                Lecture du moteur
              </span>
              <span
                className="rounded-full px-2.5 py-1 text-[11px] font-black"
                style={{
                  color: eloBadge.color,
                  background:
                    "color-mix(in srgb, var(--pmu-surface-highlight) 55%, transparent)",
                }}
              >
                {eloLabel.label}
              </span>
            </div>
            <p className="mt-3 text-sm leading-6 text-[var(--pmu-text-soft)]">
              {eloLabel.tooltip}
            </p>
            {indiceOuverture ? (
              <p className="mt-3 text-xs font-semibold leading-6 text-[var(--pmu-text-muted)]">
                <span style={{ color: indiceOuverture.color }}>
                  {indiceOuverture.emoji}
                </span>{" "}
                Lisibilite {indiceOuverture.label} ({indiceOuverture.score}/10)
              </p>
            ) : null}
          </div>
        </AccordionPanel>

        <AccordionPanel
          kicker="Bloc ticket"
          title="Selection et reperes"
          summary={ticketSummary}
          open={openPanel === "ticket"}
          onToggle={(next) => setOpenPanel(next ? "ticket" : null)}
        >
          <ul className="grid gap-2 text-sm">
            {lines.map((row) => (
              <li
                key={row.label}
                className="flex justify-between gap-3 rounded-[1rem] border border-[var(--pmu-border)] bg-[color-mix(in_srgb,var(--pmu-surface)_84%,transparent)] px-4 py-3"
              >
                <span className="font-semibold text-[var(--pmu-text-muted)]">
                  {row.label}
                </span>
                <span className="font-black text-[var(--pmu-text)]">
                  {row.value}
                </span>
              </li>
            ))}
          </ul>
        </AccordionPanel>

        <AccordionPanel
          kicker="Bloc lecture"
          title={pickNum ? `Pourquoi #${pickNum} ?` : "Pourquoi ce cheval ?"}
          summary={whySummary}
          open={openPanel === "why"}
          onToggle={(next) => setOpenPanel(next ? "why" : null)}
        >
          {pickNum && translatedFactors.length > 0 ? (
            <WhyThisHorse
              horseName={pickNom ?? ""}
              horseNum={pickNum}
              topFacteurs={translatedFactors}
              confidence={pickConfidence ?? displayScore}
              betType={pickBetType}
              mode="compact"
            />
          ) : (
            <p className="text-sm leading-6 text-[var(--pmu-text-soft)]">
              Les facteurs detailles arrivent avec un ticket plus ferme ou au
              prochain signal actif.
            </p>
          )}
        </AccordionPanel>
      </div>

      <div className="space-y-2.5">
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--pmu-surface-2)_78%,transparent)]">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${progressPct}%`,
              background: `linear-gradient(90deg, ${interpreted.color}, color-mix(in srgb, ${interpreted.color} 62%, white))`,
            }}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-black tabular-nums text-[var(--pmu-text)]">
            {displayScore.toFixed(1)}/10
          </span>
          <span className="text-sm font-black" style={{ color: interpreted.color }}>
            {beginnerLabel.label} {beginnerLabel.emoji}
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={onClick}
        className="app-button-primary mt-auto w-full"
      >
        {ctaLabel(displayScore)}
      </button>
    </article>
  );
}
