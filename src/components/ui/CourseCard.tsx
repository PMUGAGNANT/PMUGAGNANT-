"use client";

import { useState } from "react";
import { ConfidenceRing } from "./ConfidenceRing";
import { StatutBadge } from "./StatutBadge";

type CourseCardProps = {
  timeLabel: string;
  hippodrome: string;
  raceTitle: string;
  raceMeta: string;
  horseLabel: string;
  betTypeLabel: string;
  confidence: number;
  status: "jouable" | "surveillance" | "passer" | "resultat";
  noteLabel?: string;
  allocationLabel?: string;
  summary: string;
  onClick: () => void;
};

export function CourseCard({
  timeLabel,
  hippodrome,
  raceTitle,
  raceMeta,
  horseLabel,
  betTypeLabel,
  confidence,
  status,
  noteLabel,
  allocationLabel,
  summary,
  onClick,
}: CourseCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className="group app-card flex h-full w-full flex-col gap-4 p-5 text-left transition-[border-color,box-shadow] duration-300 ease-out hover:border-[var(--pmu-primary)] hover:shadow-[var(--pmu-glow)]"
    >
      {/* Bloc variable en flex-1 : pousse « Voir la fiche complète » en bas (aligné entre colonnes) */}
      <div className="flex min-h-0 flex-1 flex-col gap-4">
        {/* 3 colonnes : Heure+Lieu | Cheval+Type | Score+Badge */}
        <div className="grid gap-5 md:grid-cols-[minmax(0,0.95fr)_minmax(0,1.35fr)_auto] md:items-start">
          <div className="space-y-1.5">
            <p className="font-mono text-3xl font-black leading-none tracking-tight text-[var(--pmu-text)]">{timeLabel}</p>
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[var(--pmu-primary)]">{hippodrome}</p>
            <p className="text-sm leading-6 text-[var(--pmu-text-muted)]">{raceMeta}</p>
          </div>

          <div className="space-y-3">
            <h3 className="text-xl font-black leading-tight tracking-tight text-[var(--pmu-text)] md:text-2xl">{raceTitle}</h3>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-[color-mix(in_srgb,var(--pmu-primary)_35%,transparent)] bg-[var(--pmu-primary-fade)] px-3 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-[var(--pmu-primary)]">
                {betTypeLabel}
              </span>
              <span className="text-sm font-bold text-[var(--pmu-text)]">{horseLabel}</span>
            </div>
          </div>

          <div className="flex flex-col items-start gap-3 md:items-end">
            <StatutBadge type={status} />
            <ConfidenceRing score={confidence} />
            <div className="flex flex-wrap gap-2 md:justify-end">
              {noteLabel ? (
                <span className="rounded-full border border-[var(--pmu-border-strong)] bg-transparent px-3 py-1 text-xs font-semibold text-[var(--pmu-text-muted)]">
                  {noteLabel}
                </span>
              ) : null}
              {allocationLabel ? (
                <span className="rounded-full border border-[var(--pmu-border-strong)] bg-transparent px-3 py-1 text-xs font-semibold text-[var(--pmu-text-muted)]">
                  {allocationLabel}
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <button
          type="button"
          className="flex w-full shrink-0 items-center justify-center gap-2 rounded-xl border border-[var(--pmu-border-strong)] py-2.5 text-xs font-bold uppercase tracking-[0.14em] text-[var(--pmu-text-muted)] transition hover:border-[color-mix(in_srgb,var(--pmu-primary)_50%,transparent)] hover:text-[var(--pmu-primary)]"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
        >
          {expanded ? "Masquer le détail ticket" : "Détail ticket"}
          <span className={`inline-block transition-transform duration-300 ${expanded ? "rotate-180" : ""}`}>▼</span>
        </button>

        <div
          className={`overflow-hidden transition-all duration-300 ease-out ${expanded ? "max-h-96 opacity-100" : "max-h-0 opacity-0"}`}
        >
          <div className="border-t border-[var(--pmu-border)] pt-4">
            <p className="text-sm leading-7 text-[var(--pmu-text-muted)]">{summary}</p>
            <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-[var(--pmu-text-soft)]">
              Cheval repère · {horseLabel}
            </p>
          </div>
        </div>
      </div>

      <button type="button" onClick={onClick} className="app-button-primary w-full shrink-0">
        Voir la fiche complète
      </button>
    </div>
  );
}
