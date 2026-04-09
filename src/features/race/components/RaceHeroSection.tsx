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

import { RaceStatusPill } from "@/features/race/components/RaceStatusPill";

export function RaceHeroSection({
  courseInfo,
  selectedDate,
  minutesUntilStart,
  paywallRequired,
  isFinished,
  refreshPriority,
}: {
  courseInfo: RaceCourseInfo;
  selectedDate: string | null;
  minutesUntilStart?: number | null;
  paywallRequired: boolean;
  isFinished: boolean;
  refreshPriority?: RacePriorityBadge | null;
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
