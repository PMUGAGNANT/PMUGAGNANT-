"use client";

import {
  getFavoriteFormTrend,
  parseFavoriteForm,
  type FavoriteFormPoint,
} from "@/features/race/lib/favorite-form";

const MEDALS = {
  gold: "\u{1F947}",
  silver: "\u{1F948}",
  bronze: "\u{1F949}",
  neutral: "\u26AB",
  up: "\u2197",
  down: "\u2198",
  flat: "\u2192",
} as const;

function getMedal(point: FavoriteFormPoint) {
  const position = Number.parseInt(point.label, 10);
  if (position === 1) return MEDALS.gold;
  if (position === 2) return MEDALS.silver;
  if (position === 3) return MEDALS.bronze;
  return MEDALS.neutral;
}

export function FavoriteFormChart({ musique }: { musique?: string | null }) {
  const points = parseFavoriteForm(musique);
  const trend = getFavoriteFormTrend(points);
  const trendIcon =
    trend.direction === "up"
      ? MEDALS.up
      : trend.direction === "down"
        ? MEDALS.down
        : MEDALS.flat;

  return (
    <div className="turf-form-timeline">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="app-label">Forme du cheval</p>
          <h3 className="mt-1 text-lg font-black text-[var(--pmu-text)]">
            Les 5 derni\u00E8res sorties
          </h3>
        </div>
        <span className={`turf-trend-pill is-${trend.direction}`}>
          {trendIcon} {trend.label}
        </span>
      </div>

      <div
        className="mt-4 grid grid-cols-5 gap-2"
        aria-label="Forme recente du cheval favori"
      >
        {points.map((point, index) => (
          <div
            key={`${point.label}-${index}`}
            className="turf-form-medal"
            data-tone={point.tone}
          >
            <span aria-hidden>{getMedal(point)}</span>
            <strong>{point.label}</strong>
          </div>
        ))}
      </div>

      <p className="mt-3 text-xs leading-5 text-[var(--pmu-text-soft)]">
        M\u00E9dailles = podium r\u00E9cent. Pastilles noires = sortie moins convaincante.
      </p>
    </div>
  );
}
