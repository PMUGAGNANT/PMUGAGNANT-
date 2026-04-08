"use client";

import { useMemo } from "react";
import {
  interpretScoreForBeginner,
  lisibiliteForBeginner,
  betTypeForBeginner,
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
  const scoreLabel = useMemo(() => interpretScoreForBeginner(confidence), [confidence]);
  const lisLabel = useMemo(() => lisibiliteForBeginner(lisibilite ?? "COMPLEXE"), [lisibilite]);
  const betLabel = useMemo(() => betTypeForBeginner(betType), [betType]);
  const barPct = Math.min(100, Math.max(0, (confidence / 10) * 100));
  const gainPotentiel = cote && cote > 0 ? Math.round(cote * 5 * 100) / 100 : null;

  return (
    <section className="app-page-hero p-5 md:p-7">
      <div className="relative z-[1] grid gap-5 xl:grid-cols-[1.1fr,0.9fr] xl:items-end">
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.16em]"
              style={{
                background: `color-mix(in srgb, ${scoreLabel.color} 16%, var(--pmu-surface))`,
                color: scoreLabel.color,
                border: `1px solid color-mix(in srgb, ${scoreLabel.color} 28%, transparent)`,
              }}
            >
              {scoreLabel.emoji} Cheval du jour
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-[var(--pmu-border)] bg-[color-mix(in_srgb,var(--pmu-surface-2)_84%,transparent)] px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--pmu-text-muted)]">
              {lisLabel.emoji} {lisLabel.label}
            </span>
          </div>

          <div>
            <p className="app-kicker">Selection du moment</p>
            <h2 className="mt-3 text-4xl font-black leading-[0.95] text-[var(--pmu-text)] md:text-6xl">
              N°{horseNum}{" "}
              <span style={{ color: scoreLabel.color }}>{horseName}</span>
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--pmu-text-soft)] md:text-base">
              {hippodrome} · R{reunion}C{course} · {heureDepart}. Le moteur pousse ce ticket en tete du board avec une lecture suffisamment propre pour passer a l&apos;action.
            </p>
            <p className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--pmu-text-muted)]">
              {courseName}
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="app-stat-card px-4 py-4">
              <p className="app-label">Confiance</p>
              <p className="mt-2 text-3xl font-black" style={{ color: scoreLabel.color }}>
                {Math.round(confidence * 10) / 10}/10
              </p>
            </div>
            <div className="app-stat-card px-4 py-4">
              <p className="app-label">Pari conseille</p>
              <p className="mt-2 text-lg font-black text-[var(--pmu-text)]">{betLabel.label}</p>
            </div>
            <div className="app-stat-card px-4 py-4">
              <p className="app-label">{cote ? "Cote" : "Mise repere"}</p>
              <p className="mt-2 text-lg font-black text-[var(--pmu-text)]">{cote ? `${cote}` : "5 EUR"}</p>
              {gainPotentiel ? (
                <p className="mt-1 text-xs font-semibold text-[var(--pmu-text-soft)]">Gain potentiel env. {gainPotentiel} EUR</p>
              ) : null}
            </div>
          </div>
        </div>

        <div className="app-card-muted p-5">
          <div className="flex items-center justify-between gap-3">
            <p className="app-kicker text-[10px]">Lecture rapide</p>
            <span className="text-sm font-black" style={{ color: scoreLabel.color }}>
              {scoreLabel.label}
            </span>
          </div>

          <div className="mt-4 h-3 w-full overflow-hidden rounded-full bg-[var(--pmu-bg)]">
            <div
              className="h-full rounded-full transition-all duration-1000"
              style={{
                width: `${barPct}%`,
                background: `linear-gradient(90deg, ${scoreLabel.color}CC, ${scoreLabel.color})`,
              }}
            />
          </div>

          <div className="mt-5 space-y-3">
            {topFacteurs.slice(0, 3).map((factor, index) => (
              <div
                key={`${factor}-${index}`}
                className="rounded-[1rem] border border-[var(--pmu-border)] bg-[color-mix(in_srgb,var(--pmu-surface)_75%,transparent)] px-4 py-3 text-sm leading-6 text-[var(--pmu-text-soft)]"
              >
                <span className="mr-2 font-black" style={{ color: scoreLabel.color }}>
                  0{index + 1}
                </span>
                {factor}
              </div>
            ))}
          </div>

          <button type="button" onClick={onClick} className="app-button-primary mt-5 w-full">
            Voir l&apos;analyse complete
          </button>
        </div>
      </div>
    </section>
  );
}
