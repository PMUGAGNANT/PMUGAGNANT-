"use client";

import { parseFavoriteForm } from "@/features/race/lib/favorite-form";

const TONE_CLASS = {
  strong: "bg-emerald-600",
  good: "bg-lime-500",
  neutral: "bg-amber-300",
  weak: "bg-rose-400",
} as const;

export function FavoriteFormChart({ musique }: { musique?: string | null }) {
  const points = parseFavoriteForm(musique);

  return (
    <div className="result-chip px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="app-label">Forme recente</p>
          <h3 className="mt-1 text-lg font-black text-[var(--pmu-text)]">
            5 dernieres courses
          </h3>
        </div>
        <span className="rounded-full bg-[var(--pmu-primary-fade)] px-3 py-1 text-xs font-black text-[var(--pmu-primary)]">
          favori
        </span>
      </div>

      <div className="mt-5 flex h-28 items-end gap-2">
        {points.map((point, index) => (
          <div key={`${point.label}-${index}`} className="flex flex-1 flex-col items-center gap-2">
            <div className="flex h-20 w-full items-end rounded-[8px] bg-white/70 p-1">
              <span
                className={`block w-full rounded-[6px] ${TONE_CLASS[point.tone]}`}
                style={{ height: `${Math.max(12, point.score)}%` }}
                aria-label={`${point.label} score forme ${point.score}`}
              />
            </div>
            <span className="text-[0.7rem] font-black text-[var(--pmu-text-soft)]">
              {point.label}
            </span>
          </div>
        ))}
      </div>

      <p className="mt-3 text-xs leading-5 text-[var(--pmu-text-soft)]">
        Plus la barre est haute, plus la derniere performance renforce le pronostic.
      </p>
    </div>
  );
}
