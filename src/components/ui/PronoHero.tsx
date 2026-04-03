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
      className="relative w-full overflow-hidden rounded-[2rem] border"
      style={{
        borderColor: `${scoreLabel.color}44`,
        background: `linear-gradient(168deg, ${scoreLabel.color}0A 0%, var(--pmu-surface) 50%, var(--pmu-surface) 100%)`,
        boxShadow: `0 24px 64px ${scoreLabel.color}18, var(--pmu-card-inset)`,
      }}
    >
      {/* Top badge */}
      <div className="flex items-center justify-between px-6 pt-6">
        <span
          className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-black uppercase tracking-wider"
          style={{
            background: `${scoreLabel.color}18`,
            color: scoreLabel.color,
            border: `1px solid ${scoreLabel.color}44`,
          }}
        >
          {scoreLabel.emoji} {scoreLabel.label}
        </span>
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold"
          style={{
            background: "var(--pmu-surface-2)",
            color: "var(--pmu-text-muted)",
          }}
        >
          {lisLabel.emoji} {lisLabel.label}
        </span>
      </div>

      {/* Prono principal */}
      <div className="px-6 pb-2 pt-5 text-center">
        <p className="text-sm font-bold uppercase tracking-wide text-[var(--pmu-text-muted)]">
          Prono du jour
        </p>
        <h2
          className="mt-3 text-3xl font-black tracking-tight md:text-4xl"
          style={{ color: "var(--pmu-text)" }}
        >
          N°{horseNum}{" "}
          <span style={{ color: scoreLabel.color }}>
            {horseName}
          </span>
        </h2>
        <p className="mt-2 text-sm font-semibold text-[var(--pmu-text-soft)]">
          {hippodrome} • R{reunion}C{course} • {heureDepart}
        </p>
        <p className="mt-2 text-sm text-[var(--pmu-text-muted)]">{courseName}</p>
      </div>

      {/* Barre de confiance */}
      <div className="mx-auto max-w-sm px-6 pt-4">
        <div className="flex items-center justify-between text-sm">
          <span className="font-bold text-[var(--pmu-text-muted)]">
            Notre confiance
          </span>
          <span
            className="font-black tabular-nums"
            style={{ color: scoreLabel.color }}
          >
            {Math.round(confidence * 10) / 10}/10
          </span>
        </div>
        <div className="mt-2 h-3.5 w-full overflow-hidden rounded-full bg-[var(--pmu-surface-2)]">
          <div
            className="h-full rounded-full transition-all duration-1000"
            style={{
              width: `${barPct}%`,
              background: `linear-gradient(90deg, ${scoreLabel.color}CC, ${scoreLabel.color})`,
            }}
          />
        </div>
      </div>

      {/* Infos clés */}
      <div className="mx-auto mt-5 grid max-w-sm gap-3 px-6 sm:grid-cols-2">
        <div
          className="rounded-xl px-4 py-3 text-center"
          style={{ background: "var(--pmu-surface-2)" }}
        >
          <p className="text-[11px] font-black uppercase tracking-wider text-[var(--pmu-text-muted)]">
            Conseil
          </p>
          <p className="mt-1 text-lg font-black text-[var(--pmu-text)]">
            {betLabel.label}
          </p>
          <p className="mt-0.5 text-[11px] text-[var(--pmu-text-muted)]">
            {betLabel.tooltip}
          </p>
        </div>
        <div
          className="rounded-xl px-4 py-3 text-center"
          style={{ background: "var(--pmu-surface-2)" }}
        >
          <p className="text-[11px] font-black uppercase tracking-wider text-[var(--pmu-text-muted)]">
            {cote ? "Cote actuelle" : "Mise conseillée"}
          </p>
          <p className="mt-1 text-lg font-black text-[var(--pmu-text)]">
            {cote ? `${cote}` : "5€"}
          </p>
          {gainPotentiel && (
            <p
              className="mt-0.5 text-[11px] font-bold"
              style={{ color: "var(--pmu-primary)" }}
            >
              Gain potentiel ≈ {gainPotentiel}€
            </p>
          )}
        </div>
      </div>

      {/* Pourquoi lui ? */}
      {topFacteurs.length > 0 && (
        <div className="mx-auto mt-4 max-w-sm px-6">
          <p className="text-[11px] font-black uppercase tracking-wider text-[var(--pmu-text-muted)]">
            Pourquoi lui ?
          </p>
          <ul className="mt-2 space-y-1.5">
            {topFacteurs.slice(0, 3).map((f, i) => (
              <li
                key={i}
                className="flex items-start gap-2 text-sm text-[var(--pmu-text-soft)]"
              >
                <span style={{ color: scoreLabel.color }}>→</span>
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* CTA */}
      <div className="flex justify-center px-6 pb-6 pt-5">
        <button
          type="button"
          onClick={onClick}
          className="app-button-primary w-full max-w-sm py-4 text-base font-black"
        >
          Voir le détail complet →
        </button>
      </div>

      {/* Disclaimer */}
      <div className="border-t border-[var(--pmu-border)] px-6 py-3 text-center text-[11px] text-[var(--pmu-text-muted)]">
        ⚠️ Les paris comportent des risques. Ne misez que ce que vous êtes prêt
        à perdre.
      </div>
    </section>
  );
}
