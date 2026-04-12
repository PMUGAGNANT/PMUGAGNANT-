import {
  formatDateLabel,
  formatDiscipline,
  formatEuros,
  formatMinutesLabel,
  type RaceCourseInfo,
} from "@/features/race/lib/race-page-model";
import {
  getPriorityToneColor,
  type RacePriorityBadge,
} from "@/lib/race-priority";
import type { MeteoData } from "@/lib/meteo";

import { RaceStatusPill } from "@/features/race/components/RaceStatusPill";

export function RaceHeroSection({
  courseInfo,
  selectedDate,
  minutesUntilStart,
  paywallRequired,
  isFinished,
  refreshPriority,
  meteo,
}: {
  courseInfo: RaceCourseInfo;
  selectedDate: string | null;
  minutesUntilStart?: number | null;
  paywallRequired: boolean;
  isFinished: boolean;
  refreshPriority?: RacePriorityBadge | null;
  meteo?: MeteoData | null;
}) {
  const titlePrefix = `R${courseInfo.reunion ?? ""}C${courseInfo.course ?? ""}`;
  const dateLabel = formatDateLabel(selectedDate ?? courseInfo.dateStr ?? null);
  const statusTone = isFinished
    ? "neutral"
    : paywallRequired
      ? "warning"
      : "primary";
  const statusLabel = isFinished
    ? "Resultat officiel"
    : paywallRequired
      ? "Ticket premium"
      : "Signal disponible";

  const pills = [
    formatDiscipline(courseInfo.discipline),
    courseInfo.distance ? `${courseInfo.distance} m` : null,
    courseInfo.nombrePartants ? `${courseInfo.nombrePartants} partants` : null,
    courseInfo.terrain || null,
    courseInfo.meteo || null,
  ].filter(Boolean) as string[];
  const weatherIcon =
    meteo?.description.toLowerCase().includes("pluie")
      ? "🌧️"
      : meteo?.description.toLowerCase().includes("nuage")
        ? "⛅"
        : "☀️";
  const impactTone =
    meteo?.terrain_impact === "FAVORABLE"
      ? "text-green-700 bg-green-100 border-green-300"
      : meteo?.terrain_impact === "DEFAVORABLE"
        ? "text-red-700 bg-red-100 border-red-300"
        : "text-slate-700 bg-slate-100 border-slate-300";

  return (
    <section className="app-page-hero p-6 md:p-8">
      <div className="relative z-[1] grid gap-6 xl:grid-cols-[1.15fr,0.85fr] xl:items-end">
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <RaceStatusPill label={statusLabel} tone={statusTone} />
            {dateLabel ? <span className="app-pill text-xs">{dateLabel}</span> : null}
            {refreshPriority ? (
              <span
                className="rounded-full border px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.14em]"
                style={{
                  color: getPriorityToneColor(refreshPriority.tone),
                  borderColor: `color-mix(in srgb, ${getPriorityToneColor(
                    refreshPriority.tone
                  )} 24%, transparent)`,
                  background: `color-mix(in srgb, ${getPriorityToneColor(
                    refreshPriority.tone
                  )} 10%, var(--pmu-surface))`,
                }}
              >
                {refreshPriority.label} - {refreshPriority.detail}
              </span>
            ) : null}
          </div>

          <div>
            <p className="app-kicker">
              {titlePrefix} - {(courseInfo.hippodrome || "Programme").toUpperCase()}
            </p>
            <h1 className="mt-2 max-w-4xl text-4xl font-black leading-[0.93] text-[var(--pmu-text)] md:text-6xl">
              {courseInfo.nomCourse || `Course ${courseInfo.course ?? ""}`}
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--pmu-text-soft)] md:text-base">
              La fiche course sert de poste de lecture unique : ticket, contexte
              PMU, tableau des partants et resultat officiel restent dans le meme
              flux.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {pills.map((pill) => (
              <span key={pill} className="app-pill text-xs">
                {pill}
              </span>
            ))}
          </div>

          {meteo ? (
            <div className="rounded-lg border border-[var(--pmu-border)] bg-[var(--pmu-surface)] p-4">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-xl" aria-hidden>
                  {weatherIcon}
                </span>
                <span className="font-semibold text-[var(--pmu-text)]">
                  {meteo.description} - {meteo.temperature}°C - Vent {meteo.vent_kmh} km/h
                </span>
                <span className={`rounded-lg border px-2 py-1 text-xs font-semibold ${impactTone}`}>
                  Terrain {meteo.terrain_impact.toLowerCase()}
                </span>
              </div>
              {meteo.alerte ? (
                <p className="mt-3 rounded-lg border border-orange-300 bg-orange-100 px-3 py-2 text-sm font-semibold text-orange-800">
                  ⚠️ Alerte terrain - {meteo.alerte}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="app-stat-card px-5 py-4">
            <p className="app-label">Depart</p>
            <p className="mt-2 text-2xl font-black text-[var(--pmu-text)]">
              {courseInfo.heureDepart || "--"}
            </p>
          </div>
          <div className="app-stat-card px-5 py-4">
            <p className="app-label">Fenetre</p>
            <p className="mt-2 text-2xl font-black text-[var(--pmu-text)]">
              {formatMinutesLabel(minutesUntilStart)}
            </p>
          </div>
          <div className="app-stat-card px-5 py-4">
            <p className="app-label">Allocation</p>
            <p className="mt-2 text-2xl font-black text-[var(--pmu-text)]">
              {formatEuros(courseInfo.allocation) || "--"}
            </p>
          </div>
          <div className="app-stat-card px-5 py-4">
            <p className="app-label">Acces</p>
            <p className="mt-2 text-lg font-black text-[var(--pmu-text)]">
              {paywallRequired ? "Preview public" : "Lecture complete"}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
