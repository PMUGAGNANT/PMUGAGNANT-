"use client";

import { useMemo, useState } from "react";
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
import { AccordionPanel } from "@/components/ui/AccordionPanel";
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
  return "Lire quand meme";
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
  const [openPanel, setOpenPanel] = useState<"analysis" | "ticket" | "why" | null>(null);
  const interpreted = useMemo(() => interpretScore(displayScore), [displayScore]);
  const beginnerLabel = useMemo(() => interpretScoreForBeginner(displayScore), [displayScore]);
  const eloLabel = useMemo(() => eloForBeginner(eloProfile.eloGlobal), [eloProfile.eloGlobal]);
  const eloBadge = useMemo(() => getEloGlobalBadgeStyle(eloProfile.eloGlobal), [eloProfile.eloGlobal]);
  const progressPct = Math.min(100, Math.max(0, (displayScore / 10) * 100));
  const countdownUrgent = minutesUntilStart > 0 && minutesUntilStart < 30;

  const translatedFactors = useMemo(() => translateFactors(topFacteurs ?? []), [topFacteurs]);

  const lines: Array<{ label: string; value: string }> = [];
  if (profile.favoriFragileNum != null) {
    lines.push({ label: "Favori fragile", value: `N°${profile.favoriFragileNum}` });
  }
  if (profile.valueBetNum != null) {
    lines.push({ label: "Spot value", value: `N°${profile.valueBetNum}` });
  }

  const ticketStr = profile.ticketNums.length ? profile.ticketNums.map((n) => `N°${n}`).join(" · ") : "—";
  lines.push({
    label: profile.ticketNums.length > 1 ? "Selection" : "Cheval retenu",
    value: ticketStr,
  });
  const ticketSummary = lines.find((row) => row.label === "Selection" || row.label === "Cheval retenu")?.value ?? "â€”";
  const whySummary =
    pickNum && translatedFactors.length > 0 ? `${translatedFactors.length} signaux` : "En attente";

  const buttonStyle =
    displayScore >= 9
      ? {
          background: "linear-gradient(135deg, var(--pmu-primary), var(--pmu-primary-bright))",
          color: "var(--pmu-on-primary)",
        }
      : displayScore >= 7
        ? {
            background:
              "linear-gradient(135deg, color-mix(in srgb, var(--pmu-primary) 88%, #0f766e), var(--pmu-primary))",
            color: "var(--pmu-on-primary)",
          }
        : displayScore >= 5
          ? {
              background:
                "linear-gradient(135deg, var(--pmu-orange), color-mix(in srgb, var(--pmu-orange) 70%, white))",
              color: "#1f1610",
            }
          : {
              background: "color-mix(in srgb, var(--pmu-surface-2) 92%, transparent)",
              color: "var(--pmu-text)",
            };

  return (
    <article className="app-card flex w-full flex-col gap-4 p-5 text-left hover:border-[var(--pmu-border-strong)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div
          className="inline-flex max-w-[72%] items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.18em]"
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
          className={`rounded-full border px-3 py-1 font-mono text-xs font-bold tabular-nums ${
            countdownUrgent
              ? "border-[color-mix(in_srgb,var(--pmu-red)_35%,transparent)] text-[var(--pmu-red)]"
              : "border-[var(--pmu-border)] text-[var(--pmu-text-muted)]"
          }`}
        >
          <span className="text-[var(--pmu-text)]">{timeLabel}</span>
          <span className="mx-1 opacity-60">•</span>
          <span>{formatCountdown(minutesUntilStart)}</span>
        </div>
      </div>

      <div>
        <h3 className="text-xl font-black leading-tight text-[var(--pmu-text)] md:text-[1.65rem]">{raceTitle}</h3>
        <p className="mt-2 text-sm font-medium leading-6 text-[var(--pmu-text-soft)]">{subtitleLine}</p>
      </div>

      <div className="space-y-2.5">
        <AccordionPanel
          kicker="Bloc analyse"
          title="Fiabilite de l'analyse"
          summary={eloLabel.label}
          open={openPanel === "analysis"}
          onToggle={(next) => setOpenPanel(next ? "analysis" : null)}
        >
          <div className="rounded-[1.1rem] border border-[var(--pmu-border)] bg-[color-mix(in_srgb,var(--pmu-surface)_86%,transparent)] px-3 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--pmu-text-muted)]">
                Lecture du moteur
              </span>
              <span
                className="rounded-full px-2.5 py-1 text-[11px] font-black"
                style={{
                  color: eloBadge.color,
                  background: "color-mix(in srgb, var(--pmu-surface-highlight) 55%, transparent)",
                }}
              >
                {eloLabel.label}
              </span>
            </div>
            <p className="mt-2 text-[11px] leading-5 text-[var(--pmu-text-soft)]">{eloLabel.tooltip}</p>
          </div>
        </AccordionPanel>

        <AccordionPanel
          kicker="Bloc ticket"
          title="Cheval retenu et reperes"
          summary={ticketSummary}
          open={openPanel === "ticket"}
          onToggle={(next) => setOpenPanel(next ? "ticket" : null)}
        >
          <ul className="grid gap-2 text-sm">
            {lines.map((row) => (
              <li
                key={row.label}
                className="flex justify-between gap-3 rounded-[1rem] border border-[var(--pmu-border)] bg-[color-mix(in_srgb,var(--pmu-surface)_84%,transparent)] px-3 py-2"
              >
                <span className="font-semibold text-[var(--pmu-text-muted)]">{row.label}</span>
                <span className="font-black text-[var(--pmu-text)]">{row.value}</span>
              </li>
            ))}
          </ul>
        </AccordionPanel>

        <AccordionPanel
          kicker="Bloc lecture"
          title={pickNum ? `Pourquoi NÂ°${pickNum} ?` : "Pourquoi ce cheval ?"}
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
              Les facteurs detailles arrivent avec un ticket plus ferme ou au prochain signal actif.
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
            {Math.round(displayScore * 10) / 10}/10
          </span>
          <span className="text-sm font-black" style={{ color: interpreted.color }}>
            {beginnerLabel.label} {beginnerLabel.emoji}
          </span>
        </div>

        {indiceOuverture ? (
          <p className="text-[10px] font-medium leading-snug text-[var(--pmu-text-soft)]">
            <span style={{ color: indiceOuverture.color }}>{indiceOuverture.emoji}</span>{" "}
            <span className="uppercase tracking-[0.08em] text-[var(--pmu-text-muted)]">Lisibilite</span> ·{" "}
            {indiceOuverture.label} ({indiceOuverture.score}/10)
          </p>
        ) : null}
      </div>

      <button
        type="button"
        onClick={onClick}
        className="w-full shrink-0 rounded-full border px-4 py-3 text-center text-sm font-bold transition hover:-translate-y-px"
        style={{
          ...buttonStyle,
          borderColor: "color-mix(in srgb, var(--pmu-border-strong) 55%, transparent)",
          boxShadow: "var(--pmu-shadow-sm)",
        }}
      >
        {ctaLabel(displayScore)}
      </button>
    </article>
  );
}
