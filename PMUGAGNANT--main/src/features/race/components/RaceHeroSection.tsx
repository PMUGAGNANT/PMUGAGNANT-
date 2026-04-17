import {
  formatDateLabel,
  formatDiscipline,
  formatEuros,
  formatMinutesLabel,
  type RaceCourseInfo,
} from "@/features/race/lib/race-page-model";
import type { MeteoData } from "@/lib/meteo";
import type { RacePriorityBadge } from "@/lib/race-priority";

function WeatherIcon({ description }: { description?: string | null }) {
  const normalized = (description ?? "").toLowerCase();

  if (normalized.includes("pluie")) return <span className="app-pill text-xs">Pluie</span>;
  if (normalized.includes("nuage")) return <span className="app-pill text-xs">Nuageux</span>;
  return <span className="app-pill text-xs">Temps clair</span>;
}

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
  const statusLabel = isFinished
    ? "Course terminee"
    : paywallRequired
      ? "Ticket premium"
      : `${courseInfo.heureDepart || "Depart"} - ${formatMinutesLabel(minutesUntilStart)}`;
  const stats = [
    { label: "Depart", value: courseInfo.heureDepart || "--" },
    {
      label: "Distance",
      value: courseInfo.distance ? `${courseInfo.distance} m` : "--",
    },
    {
      label: "Partants",
      value: courseInfo.nombrePartants ? String(courseInfo.nombrePartants) : "--",
    },
    { label: "Dotation", value: formatEuros(courseInfo.allocation) || "--" },
  ];

  return (
    <section className="app-page-hero p-5 md:p-7">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="app-kicker">
            {titlePrefix} - {(courseInfo.hippodrome || "Programme").toUpperCase()}
          </p>

          <h1 className="mt-2 text-[2rem] font-black leading-tight text-[var(--pmu-text)] md:text-[2.65rem]">
            {courseInfo.nomCourse || `Course ${courseInfo.course ?? ""}`}
          </h1>

          <p className="mt-3 text-sm leading-6 text-[var(--pmu-text-soft)]">
            {formatDiscipline(courseInfo.discipline)} -{" "}
            {courseInfo.distance ? `${courseInfo.distance} m` : "Distance a confirmer"} -{" "}
            {formatEuros(courseInfo.allocation) || "Allocation a confirmer"}
          </p>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--pmu-text-soft)]">
            Lis cette fiche dans l&apos;ordre : decision, cheval conseille, mise,
            gain potentiel, puis details.
          </p>
        </div>

        <div className="stake-chip px-4 py-3 lg:min-w-[14rem]">
          <p className="text-[0.72rem] font-bold uppercase text-[var(--pmu-gold)]">
            Statut course
          </p>
          <p className="mt-1 text-lg font-black text-[var(--pmu-text)]">
            {statusLabel}
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {dateLabel ? (
          <span className="app-pill text-xs">
            {dateLabel}
          </span>
        ) : null}
        {lisibilite ? (
          <span className="app-pill text-xs">
            {lisibilite}
          </span>
        ) : null}
        <span className={isFinished ? "app-pill text-xs text-[var(--pmu-gold)]" : "app-pill text-xs"}>
          {statusLabel}
        </span>
        {refreshPriority ? (
          <span className="app-pill text-xs">
            {refreshPriority.label}
          </span>
        ) : null}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="result-chip px-4 py-3"
          >
            <p className="app-label">
              {stat.label}
            </p>
            <p className="mt-1 font-[family-name:var(--font-display)] text-[1.45rem] font-bold text-[var(--pmu-text)]">
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {meteo ? (
        <div
          className="result-chip mt-3 flex flex-wrap items-center gap-2 px-4 py-3 text-sm"
        >
          <WeatherIcon description={meteo.description} />
          <span className="text-[var(--pmu-text-soft)]">
            {meteo.description} - {meteo.temperature} C - Vent {meteo.vent_kmh} km/h
          </span>
          {meteo.terrain_impact === "DEFAVORABLE" ? (
            <span className="ml-auto rounded-lg bg-[color-mix(in_srgb,var(--pmu-red)_12%,white)] px-2 py-0.5 text-[0.72rem] font-bold uppercase text-[var(--pmu-red)]">
              Terrain defavorable
            </span>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
