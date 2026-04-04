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

  const gainPotentiel =
    cote && cote > 0 ? Math.round(cote * 5 * 100) / 100 : null;

  return (
    <section
      className="relative w-full overflow-hidden rounded-2xl border"
      style={{
        borderColor: "var(--pmu-border)",
        background: `linear-gradient(168deg, ${scoreLabel.color}08 0%, var(--pmu-surface) 46%, var(--pmu-surface) 100%)`,
        boxShadow: "0 6px 18px rgba(0, 0, 0, 0.28)",
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 px-5 pb-1 pt-3">
        <span
          className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-black uppercase tracking-[0.12em]"
          style={{
            background: `${scoreLabel.color}14`,
            color: scoreLabel.color,
            border: `1px solid ${scoreLabel.color}26`,
          }}
        >
          {scoreLabel.emoji} {scoreLabel.label}
        </span>
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold"
          style={{
            background: "var(--pmu-surface-2)",
            color: "var(--pmu-text-muted)",
          }}
        >
          {lisLabel.emoji} {lisLabel.label}
        </span>
      </div>

      <div className="px-5 pb-1 text-center">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--pmu-text-muted)]">
          Cheval du jour
        </p>
        <h2
          className="mt-1 text-2xl font-black tracking-tight md:text-3xl"
          style={{ color: "var(--pmu-text)" }}
        >
          N°{horseNum} <span style={{ color: scoreLabel.color }}>{horseName}</span>
        </h2>
        <p className="mt-1 text-sm font-semibold text-[var(--pmu-text-soft)]">
          {hippodrome} • R{reunion}C{course} • {heureDepart}
        </p>
        <p className="mt-1 text-xs text-[var(--pmu-text-muted)]">{courseName}</p>
      </div>

      <div className="mx-auto max-w-sm px-5 pt-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-bold text-[var(--pmu-text-muted)]">
            Confiance du moteur
          </span>
          <span
            className="font-black tabular-nums"
            style={{ color: scoreLabel.color }}
          >
            {Math.round(confidence * 10) / 10}/10
          </span>
        </div>
        <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-[var(--pmu-surface-2)]">
          <div
            className="h-full rounded-full transition-all duration-1000"
            style={{
              width: `${barPct}%`,
              background: `linear-gradient(90deg, ${scoreLabel.color}CC, ${scoreLabel.color})`,
            }}
          />
        </div>
      </div>

      <div className="mx-auto mt-3 grid max-w-sm gap-2 px-5 sm:grid-cols-2">
        <div
          className="rounded-lg px-3 py-2 text-center"
          style={{ background: "var(--pmu-surface-2)" }}
        >
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[var(--pmu-text-muted)]">
            Pari conseillé
          </p>
          <p className="mt-1 text-base font-black text-[var(--pmu-text)]">
            {betLabel.label}
          </p>
          <p className="mt-0.5 text-[10px] text-[var(--pmu-text-muted)]">
            {betLabel.tooltip}
          </p>
        </div>
        <div
          className="rounded-lg px-3 py-2 text-center"
          style={{ background: "var(--pmu-surface-2)" }}
        >
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[var(--pmu-text-muted)]">
            {cote ? "Cote actuelle" : "Mise conseillée"}
          </p>
          <p className="mt-1 text-base font-black text-[var(--pmu-text)]">
            {cote ? `${cote}` : "5€"}
          </p>
          {gainPotentiel && (
            <p
              className="mt-0.5 text-[10px] font-bold"
              style={{ color: "var(--pmu-primary)" }}
            >
              Gain potentiel ≈ {gainPotentiel}€
            </p>
          )}
        </div>
      </div>

      {topFacteurs.length > 0 && (
        <div className="mx-auto mt-2 max-w-sm px-5">
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[var(--pmu-text-muted)]">
            Pourquoi lui ?
          </p>
          <ul className="mt-1.5 space-y-1">
            {topFacteurs.slice(0, 3).map((factor, index) => (
              <li
                key={index}
                className="flex items-start gap-2 text-xs text-[var(--pmu-text-soft)]"
              >
                <span style={{ color: scoreLabel.color }}>•</span>
                <span>{factor}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex justify-center px-5 pb-4 pt-3">
        <button
          type="button"
          onClick={onClick}
          className="app-button-primary w-full max-w-xs rounded-lg py-3 text-sm font-black"
        >
          Voir l’analyse complète →
        </button>
      </div>

      <div className="border-t border-[var(--pmu-border)] px-5 py-2 text-center text-[10px] text-[var(--pmu-text-muted)]">
        Les paris comportent des risques. Ne misez que ce que vous êtes prêt à
        perdre.
      </div>
    </section>
  );
}
