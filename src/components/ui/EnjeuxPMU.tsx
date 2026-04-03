"use client";

import { useMemo } from "react";

export type EnjeuxRunner = {
  numPmu: number;
  nom: string;
  cote: number | null;
  /** Score IA 0–10 si connu */
  iaScore?: number | null;
};

function impliedWeights(runners: EnjeuxRunner[]): number[] {
  return runners.map((r) => {
    const c = r.cote;
    if (c == null || !Number.isFinite(c) || c < 1.05) return 0;
    return 1 / c;
  });
}

function normalizePct(weights: number[]): number[] {
  const s = weights.reduce((a, b) => a + b, 0);
  if (s <= 0) {
    const n = weights.length || 1;
    return weights.map(() => 100 / n);
  }
  return weights.map((w) => (w / s) * 100);
}

export type EnjeuxPMUProps = {
  title?: string;
  runners: EnjeuxRunner[];
  /** Volume fictif pour l’affichage € (proxy marché) */
  volumeNominalEuro?: number;
};

export function EnjeuxPMU({
  title = "Lecture du marché",
  runners,
  volumeNominalEuro = 17_742,
}: EnjeuxPMUProps) {
  const rows = useMemo(() => {
    const list = runners.filter((r) => r.nom && !r.nom.startsWith("NP"));
    const w = impliedWeights(list);
    const pct = normalizePct(w);
    return list
      .map((r, i) => ({
        ...r,
        pct: pct[i] ?? 0,
        euros: (volumeNominalEuro * (pct[i] ?? 0)) / 100,
      }))
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 8);
  }, [runners, volumeNominalEuro]);

  const badges = useMemo(() => {
    const out: Record<number, "value" | "fauxf"> = {};
    for (const r of rows) {
      const ia = r.iaScore;
      if (ia != null && ia > 7 && r.pct < 15) out[r.numPmu] = "value";
      if (ia != null && ia < 6 && r.pct > 40) out[r.numPmu] = "fauxf";
    }
    return out;
  }, [rows]);

  if (rows.length === 0) {
    return (
      <section className="rounded-2xl border border-[var(--pmu-border)] bg-[var(--pmu-surface-2)] p-4 text-sm text-[var(--pmu-text-muted)]">
        Lecture du marché indisponible : cotes non disponibles pour cette course.
      </section>
    );
  }

  const maxPct = Math.max(...rows.map((r) => r.pct), 1);

  return (
    <section className="rounded-2xl border border-[var(--pmu-border)] bg-[var(--pmu-surface-2)] p-4">
      <p className="text-xs font-black uppercase tracking-wider text-[var(--pmu-primary)]">Marché PMU</p>
      <p className="mt-1 text-[11px] text-[var(--pmu-text-soft)]">
        {title} à partir des cotes PMU.
      </p>
      <ul className="mt-4 space-y-3">
        {rows.map((r) => {
          const tag = badges[r.numPmu];
          const barW = (r.pct / maxPct) * 100;
          return (
            <li key={r.numPmu} className="space-y-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-bold text-[var(--pmu-text)]">
                  N°{r.numPmu} — {r.nom}
                </span>
                {tag === "value" ? (
                  <span className="rounded-full bg-[color-mix(in_srgb,#00c853_22%,transparent)] px-2 py-0.5 text-[10px] font-black text-[#00c853]">
                    💎 OPPORTUNITÉ VALUE
                  </span>
                ) : tag === "fauxf" ? (
                  <span className="rounded-full bg-[color-mix(in_srgb,#ff9800_22%,transparent)] px-2 py-0.5 text-[10px] font-black text-[#ff9800]">
                    ⚠️ FAUX FAVORI
                  </span>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-[var(--pmu-surface)]">
                  <div
                    className="h-full rounded-full bg-[var(--pmu-primary)]"
                    style={{ width: `${barW}%` }}
                  />
                </div>
                <span className="shrink-0 text-xs font-black tabular-nums text-[var(--pmu-text)]">
                  {r.pct.toFixed(1)}% —{" "}
                  {new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(r.euros)} €
                </span>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="mt-4 text-xs font-semibold text-[var(--pmu-text-muted)]">
        Volume indicatif affiché :{" "}
        {new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(volumeNominalEuro)} €
      </p>
    </section>
  );
}
