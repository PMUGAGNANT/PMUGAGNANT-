import { FilterPills } from "@/features/home/components/FilterPills";
import {
  SORT_OPTIONS,
  formatDisplayDate,
  normalizeDateParam,
  type FeaturedRace,
  type SortMode,
} from "@/features/home/lib/home-page-model";
import { toIsoDate } from "@/lib/date-utils";
import type { HomeStats } from "@/features/home/components/home-page-types";

export function HomeControlBar({
  selectedDate,
  sortMode,
  stats,
  focusRace,
  onPrevDay,
  onToday,
  onNextDay,
  onDateChange,
  onSortChange,
}: {
  selectedDate: string;
  sortMode: SortMode;
  stats: HomeStats;
  focusRace: FeaturedRace | null;
  onPrevDay: () => void;
  onToday: () => void;
  onNextDay: () => void;
  onDateChange: (next: string) => void;
  onSortChange: (next: SortMode) => void;
}) {
  const dayScore = focusRace
    ? Math.max(0, Math.min(100, Math.round(focusRace.scoreValue * 10)))
    : 0;
  const alertCount = Math.max(0, stats.active - stats.playable);

  return (
    <section className="turf-home-header">
      <div className="turf-day-strip">
        <h1>{formatDisplayDate(selectedDate)}</h1>
        <div className="turf-day-strip__pills">
          <span>{stats.total} courses</span>
          <span>{stats.playable} validees</span>
          <span>{alertCount} alertes T-10</span>
        </div>
        <p>
          Score journee <strong>{dayScore || "--"} / 100</strong>
        </p>
      </div>

      <div className="turf-control-row">
        <div className="turf-signature-banner">
          <span className="turf-monogram" aria-hidden>
            P
          </span>
          <div className="turf-signature-banner__copy">
            <p className="turf-signature-banner__eyebrow">Signature TurfEdge</p>
            <p className="turf-signature-banner__title">L&apos;intelligence du terrain</p>
            <p className="turf-signature-banner__meta">ALGO V9.2 - lecture bankroll</p>
          </div>
          <blockquote className="turf-devise">
            <p>Jouer juste, jouer rare, jouer fort</p>
            <cite>TurfEdge</cite>
          </blockquote>
        </div>

        <div className="turf-date-tools">
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={onPrevDay} className="app-button-secondary !px-4 !py-3">
              Jour precedent
            </button>
            <button type="button" onClick={onToday} className="app-button-secondary !px-4 !py-3">
              Aujourd&apos;hui
            </button>
            <button type="button" onClick={onNextDay} className="app-button-secondary !px-4 !py-3">
              Jour suivant
            </button>
          </div>

          <label className="block">
            <span className="sr-only">Choisir une date</span>
            <input
              type="date"
              className="app-input"
              value={toIsoDate(selectedDate)}
              onChange={(event) =>
                onDateChange(normalizeDateParam(event.target.value.replaceAll("-", "")))
              }
            />
          </label>

          <FilterPills options={SORT_OPTIONS} value={sortMode} onChange={onSortChange} />
        </div>
      </div>

      <div className="turf-kpi-grid">
        <div className="app-card-muted">
          <p className="app-label">Validees</p>
          <p>{stats.playable}</p>
          <span>sur {stats.total} courses</span>
        </div>
        <div className="app-card-muted">
          <p className="app-label">Confiance moy.</p>
          <p>{focusRace ? focusRace.scoreValue.toFixed(1) : "--"}</p>
          <span>/ 10</span>
        </div>
        <div className="app-card-muted">
          <p className="app-label">Alertes T-10</p>
          <p>{alertCount || "--"}</p>
          <span>{stats.active} courses actives</span>
        </div>
        <div className="app-card-muted">
          <p className="app-label">Réunions</p>
          <p>{stats.meetings || "--"}</p>
          <span>hippodrome{stats.meetings > 1 ? "s" : ""} aujourd&apos;hui</span>
        </div>
      </div>
    </section>
  );
}
