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
  lisibilite,
}: {
  courseInfo: RaceCourseInfo;
  selectedDate: string | null;
  minutesUntilStart?: number | null;
  paywallRequired: boolean;
  isFinished: boolean;
  refreshPriority?: RacePriorityBadge | null;
  meteo?: MeteoData | null;
  lisibilite?: string | null;
}) {
  const titlePrefix = `R${courseInfo.reunion ?? ""}C${courseInfo.course ?? ""}`;
  const dateLabel = formatDateLabel(selectedDate ?? courseInfo.dateStr ?? null);
  const statusTone = isFinished
    ? "neutral"
    : paywallRequired
      ? "warning"
      : "primary";
  const statusLabel = isFinished
    ? "Résultat officiel"
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
      ? "text-[var(--pmu-primary)] bg-[var(--pmu-primary-soft)] border-[var(--pmu-primary)]"
      : meteo?.terrain_impact === "DEFAVORABLE"
        ? "text-[var(--pmu-red)] bg-[var(--pmu-earth-light)] border-[var(--pmu-red)]"
        : "text-[var(--pmu-text-soft)] bg-[var(--pmu-surface-2)] border-[var(--pmu-border)]";
  const impactLabel =
    meteo?.terrain_impact === "FAVORABLE"
      ? "favorable"
      : meteo?.terrain_impact === "DEFAVORABLE"
        ? "défavorable"
        : "neutre";

  return (
    <section className="app-page-hero p-6 md:p-8">
      <div className="relative z-[1] grid gap-6 xl:grid-cols-[1.15fr,0.85fr] xl:items-end">
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <RaceStatusPill label={statusLabel} tone={statusTone} />
            {dateLabel ? <span className="app-pill text-xs">{dateLabel}</span> : null}
            {lisibilite ? <span className="app-pill text-xs">{lisibilite}</span> : null}
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
              PMU, tableau des partants et résultat officiel restent dans le même
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
                  Terrain {impactLabel}
                </span>
              </div>
              {meteo.alerte ? (
                <p className="mt-3 rounded-lg border border-[var(--pmu-orange)] bg-[var(--pmu-earth-light)] px-3 py-2 text-sm font-semibold text-[var(--pmu-orange)]">
                  ⚠️ Alerte terrain - {meteo.alerte}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4 xl:mt-0">
          <div className="app-card-muted px-4 py-3">
            <p className="app-label">Départ</p>
            <p className="mt-1 font-[family-name:var(--font-display)] text-xl font-bold text-[var(--pmu-text)]">
              {courseInfo.heureDepart || "--"}
            </p>
          </div>
          <div className="app-card-muted px-4 py-3">
            <p className="app-label">Fenêtre</p>
            <p className="mt-1 font-[family-name:var(--font-display)] text-xl font-bold text-[var(--pmu-text)]">
              {formatMinutesLabel(minutesUntilStart)}
            </p>
          </div>
          <div className="app-card-muted px-4 py-3">
            <p className="app-label">Distance</p>
            <p className="mt-1 font-[family-name:var(--font-display)] text-xl font-bold text-[var(--pmu-text)]">
              {courseInfo.distance ? `${courseInfo.distance} m` : "--"}
            </p>
          </div>
          <div className="app-card-muted px-4 py-3">
            <p className="app-label">Dotation</p>
            <p className="mt-1 font-[family-name:var(--font-display)] text-xl font-bold text-[var(--pmu-text)]">
              {formatEuros(courseInfo.allocation) || "--"}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
