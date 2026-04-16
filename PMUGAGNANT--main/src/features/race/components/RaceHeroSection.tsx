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

  if (normalized.includes("pluie")) return <span aria-hidden>🌧️</span>;
  if (normalized.includes("nuage")) return <span aria-hidden>⛅</span>;
  return <span aria-hidden>☀️</span>;
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
    ? "Course terminée"
    : paywallRequired
      ? "Ticket premium"
      : `${courseInfo.heureDepart || "Départ"} · ${formatMinutesLabel(minutesUntilStart)}`;
  const stats = [
    { label: "Départ", value: courseInfo.heureDepart || "--" },
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
    <section
      style={{
        background: "var(--pmu-primary)",
        borderRadius: "8px",
        padding: "1.5rem 2rem",
        color: "var(--pmu-on-primary)",
      }}
    >
      <p
        style={{
          fontSize: "0.65rem",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.12em",
          opacity: 0.72,
          marginBottom: "0.4rem",
        }}
      >
        {titlePrefix} · {(courseInfo.hippodrome || "Programme").toUpperCase()}
      </p>

      <h1
        style={{
          fontFamily: "var(--font-display), Georgia, serif",
          fontSize: "clamp(1.6rem, 3vw, 2.2rem)",
          fontWeight: 700,
          fontStyle: "italic",
          lineHeight: 1.05,
          color: "var(--pmu-on-primary)",
        }}
      >
        {courseInfo.nomCourse || `Course ${courseInfo.course ?? ""}`}
      </h1>

      <p style={{ fontSize: "0.78rem", opacity: 0.76, marginTop: "0.45rem" }}>
        {formatDiscipline(courseInfo.discipline)} ·{" "}
        {courseInfo.distance ? `${courseInfo.distance} m` : "Distance à confirmer"} ·{" "}
        {formatEuros(courseInfo.allocation) || "Allocation à confirmer"}
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        {dateLabel ? (
          <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[0.65rem] font-bold uppercase tracking-[0.08em] text-[var(--pmu-on-primary)]">
            {dateLabel}
          </span>
        ) : null}
        {lisibilite ? (
          <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[0.65rem] font-bold uppercase tracking-[0.08em] text-[var(--pmu-on-primary)]">
            {lisibilite}
          </span>
        ) : null}
        <span
          className="rounded-full border px-3 py-1 text-[0.65rem] font-bold uppercase tracking-[0.08em]"
          style={{
            borderColor: isFinished
              ? "rgba(255,232,163,0.32)"
              : "rgba(253,252,249,0.2)",
            background: isFinished
              ? "rgba(140,109,47,0.45)"
              : "rgba(253,252,249,0.1)",
            color: isFinished ? "#FFE8A3" : "var(--pmu-on-primary)",
          }}
        >
          {statusLabel}
        </span>
        {refreshPriority ? (
          <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[0.65rem] font-bold uppercase tracking-[0.08em] text-[var(--pmu-on-primary)]">
            {refreshPriority.label}
          </span>
        ) : null}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            style={{
              background: "rgba(253,252,249,0.1)",
              border: "1px solid rgba(253,252,249,0.15)",
              borderRadius: "6px",
              padding: "0.6rem 0.75rem",
            }}
          >
            <p
              style={{
                fontSize: "0.6rem",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                opacity: 0.68,
                marginBottom: "0.3rem",
              }}
            >
              {stat.label}
            </p>
            <p
              style={{
                fontFamily: "var(--font-display), Georgia, serif",
                fontSize: "1.2rem",
                fontWeight: 700,
                color: "var(--pmu-on-primary)",
              }}
            >
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {meteo ? (
        <div
          className="mt-3 flex flex-wrap items-center gap-2"
          style={{
            background: "rgba(253,252,249,0.08)",
            borderRadius: "6px",
            padding: "0.5rem 0.75rem",
            fontSize: "0.75rem",
          }}
        >
          <WeatherIcon description={meteo.description} />
          <span style={{ opacity: 0.86 }}>
            {meteo.description} · {meteo.temperature}°C · Vent {meteo.vent_kmh} km/h
          </span>
          {meteo.terrain_impact === "DEFAVORABLE" ? (
            <span className="ml-auto rounded-full bg-[rgba(184,80,48,0.25)] px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-[0.08em] text-[#FFB299]">
              Terrain défavorable
            </span>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
