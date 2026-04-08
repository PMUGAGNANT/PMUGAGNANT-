"use client";

import { useMemo } from "react";
import {
  betTypeForBeginner,
  interpretScoreForBeginner,
  lisibiliteForBeginner,
} from "@/lib/beginner-labels";

export interface PronoHeroProps {
  horseName: string;
  horseNum: number;
  confidence: number;
  hippodrome: string;
  heureDepart: string;
  courseName: string;
  reunion: number;
  course: number;
  betType?: string | null;
  cote?: number | null;
  topFacteurs: string[];
  lisibilite?: string;
  onClick: () => void;
}

export function PronoHero({
  horseName,
  horseNum,
  confidence,
  hippodrome,
  heureDepart,
  courseName,
  reunion,
  course,
  betType,
  cote,
  topFacteurs,
  lisibilite,
  onClick,
}: PronoHeroProps) {
  const scoreLabel = useMemo(
    () => interpretScoreForBeginner(confidence),
    [confidence]
  );
  const lisLabel = useMemo(
    () => lisibiliteForBeginner(lisibilite ?? "COMPLEXE"),
    [lisibilite]
  );
  const betLabel = useMemo(() => betTypeForBeginner(betType), [betType]);
  const barPct = Math.min(100, Math.max(0, (confidence / 10) * 100));

  return (
    <section className="app-card p-5 md:p-6">
      <div className="grid gap-5 xl:grid-cols-[1.15fr,0.85fr] xl:items-stretch">
        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.16em]"
              style={{
                background: `color-mix(in srgb, ${scoreLabel.color} 14%, var(--pmu-surface))`,
                color: scoreLabel.color,
                border: `1px solid color-mix(in srgb, ${scoreLabel.color} 26%, transparent)`,
              }}
            >
              {scoreLabel.emoji} Signal principal
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-[var(--pmu-border)] bg-[color-mix(in_srgb,var(--pmu-surface)_86%,transparent)] px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--pmu-text-muted)]">
              {lisLabel.emoji} {lisLabel.label}
            </span>
          </div>

          <div>
            <p className="app-kicker">Decision prioritaire</p>
            <h2 className="mt-3 text-[2.4rem] font-black leading-[0.92] text-[var(--pmu-text)] md:text-[4.3rem]">
              #{horseNum}{" "}
              <span style={{ color: scoreLabel.color }}>{horseName}</span>
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--pmu-text-soft)] md:text-base">
              {hippodrome} - R{reunion}C{course} - {heureDepart}. Le moteur
              place ce cheval en tete du board avec une lecture assez nette
              pour passer a l&apos;action.
            </p>
            <p className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--pmu-text-muted)]">
              {courseName}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="app-pill text-xs">Pari {betLabel.label}</span>
            <span className="app-pill text-xs">Confiance {confidence.toFixed(1)}/10</span>
            <span className="app-pill text-xs">
              {cote ? `Cote ${cote}` : "Lecture premium"}
            </span>
          </div>

          {topFacteurs.length > 0 ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {topFacteurs.slice(0, 4).map((factor, index) => (
                <div
                  key={`${factor}-${index}`}
                  className="rounded-[1rem] border border-[var(--pmu-border)] bg-[color-mix(in_srgb,var(--pmu-surface)_82%,transparent)] px-4 py-3 text-sm leading-6 text-[var(--pmu-text-soft)]"
                >
                  <span
                    className="mr-2 text-xs font-black uppercase tracking-[0.14em]"
                    style={{ color: scoreLabel.color }}
                  >
                    0{index + 1}
                  </span>
                  {factor}
                </div>
              ))}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={onClick}
              className="app-button-primary"
            >
              Ouvrir la course
            </button>
            <span className="inline-flex items-center rounded-[1rem] border border-[var(--pmu-border)] bg-[color-mix(in_srgb,var(--pmu-surface)_84%,transparent)] px-4 py-3 text-sm font-semibold text-[var(--pmu-text-soft)]">
              Signal moteur {scoreLabel.label.toLowerCase()}
            </span>
          </div>
        </div>

        <div className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
            <div className="app-card-muted px-4 py-4">
              <p className="app-label">Confiance</p>
              <p
                className="mt-2 text-3xl font-black"
                style={{ color: scoreLabel.color }}
              >
                {confidence.toFixed(1)}/10
              </p>
            </div>
            <div className="app-card-muted px-4 py-4">
              <p className="app-label">Pari</p>
              <p className="mt-2 text-lg font-black text-[var(--pmu-text)]">
                {betLabel.label}
              </p>
            </div>
            <div className="app-card-muted px-4 py-4">
              <p className="app-label">Course</p>
              <p className="mt-2 text-lg font-black text-[var(--pmu-text)]">
                R{reunion}C{course}
              </p>
            </div>
          </div>

          <div className="rounded-[1.35rem] border border-[var(--pmu-border)] bg-[color-mix(in_srgb,var(--pmu-surface)_84%,transparent)] p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="app-kicker text-[10px]">Lecture moteur</p>
              <span
                className="text-sm font-black"
                style={{ color: scoreLabel.color }}
              >
                {scoreLabel.label}
              </span>
            </div>

            <div className="mt-4 h-3 w-full overflow-hidden rounded-full bg-[var(--pmu-bg)]">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${barPct}%`,
                  background: `linear-gradient(90deg, ${scoreLabel.color}CC, ${scoreLabel.color})`,
                }}
              />
            </div>

            <p className="mt-4 text-sm leading-6 text-[var(--pmu-text-soft)]">
              Le board pousse d&apos;abord ce cheval pour sa qualite globale, sa
              lisibilite et son potentiel d&apos;execution rapide.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
