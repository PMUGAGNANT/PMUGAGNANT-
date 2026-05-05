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
  const n = (description ?? "").toLowerCase();
  if (n.includes("pluie")) return <span>🌧</span>;
  if (n.includes("nuage")) return <span>⛅</span>;
  return <span>☀️</span>;
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
  const hippodrome = courseInfo.hippodrome?.toUpperCase() ?? "";
  const dateLabel = formatDateLabel(selectedDate ?? courseInfo.dateStr ?? null);

  const statusLabel = isFinished
    ? "Arrivée définitive"
    : `${courseInfo.heureDepart || "--:--"} – ${formatMinutesLabel(minutesUntilStart)}`;

  const statusColor = isFinished
    ? "var(--pmu-text-muted)"
    : typeof minutesUntilStart === "number" && minutesUntilStart <= 20
    ? "var(--pmu-red)"
    : "var(--pmu-primary)";

  const lisv = (lisibilite ?? "").toUpperCase();
  const lisCfg = lisv === "LISIBLE"
    ? { bg: "rgba(42,77,18,.08)", color: "var(--pmu-primary)", text: "Lisible" }
    : lisv === "COMPLEXE"
    ? { bg: "rgba(140,109,47,.08)", color: "var(--pmu-gold)", text: "Complexe" }
    : null;

  const stats = [
    { label: "Départ", value: courseInfo.heureDepart || "--" },
    { label: "Distance", value: courseInfo.distance ? `${courseInfo.distance} m` : "--" },
    { label: "Partants", value: courseInfo.nombrePartants ? String(courseInfo.nombrePartants) : "--" },
    { label: "Dotation", value: formatEuros(courseInfo.allocation) || "--" },
  ];

  return (
    <section
      className="app-page-hero"
      style={{ padding: "24px 28px 22px" }}
    >
      {/* Kicker */}
      <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--pmu-primary)", marginBottom: 8 }}>
        {titlePrefix} – {hippodrome}
      </p>

      {/* Titre + statut badge */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14, flexWrap: "wrap", marginBottom: 12 }}>
        <h1 style={{
          fontFamily: "var(--font-display)",
          fontSize: "clamp(1.75rem, 4vw, 2.5rem)",
          fontWeight: 900,
          lineHeight: 1,
          color: "var(--pmu-text)",
          letterSpacing: "-.02em",
          textTransform: "uppercase",
          flex: 1,
          minWidth: 0,
        }}>
          {courseInfo.nomCourse || `Course ${courseInfo.course ?? ""}`}
        </h1>
        <div style={{ padding: "10px 16px", borderRadius: 10, border: "1px solid var(--pmu-border)", background: "var(--pmu-surface-2)", flexShrink: 0, textAlign: "right", minWidth: 160 }}>
          <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--pmu-text-muted)", marginBottom: 4 }}>Statut course</p>
          <p style={{ fontSize: 16, fontWeight: 800, color: statusColor }}>{statusLabel}</p>
        </div>
      </div>

      {/* Discipline */}
      <p style={{ fontSize: 13, color: "var(--pmu-text-soft)", marginBottom: 14, lineHeight: 1.5 }}>
        {[
          formatDiscipline(courseInfo.discipline),
          courseInfo.distance ? `${courseInfo.distance} m` : null,
          formatEuros(courseInfo.allocation) || null,
        ].filter(Boolean).join(" · ")}
      </p>

      {/* Tags */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 18 }}>
        {dateLabel && <span className="app-pill" style={{ fontSize: 11 }}>{dateLabel}</span>}
        {lisCfg && (
          <span style={{ padding: "3px 10px", borderRadius: 5, fontSize: 11, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", background: lisCfg.bg, color: lisCfg.color }}>
            {lisCfg.text}
          </span>
        )}
        <span className="app-pill" style={{ fontSize: 11, color: statusColor, fontWeight: 700 }}>{statusLabel}</span>
        {refreshPriority && <span className="app-pill" style={{ fontSize: 11 }}>{refreshPriority.label}</span>}
      </div>

      {/* 4 stats grid — identique PMU.fr */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
        {stats.map((s) => (
          <div
            key={s.label}
            className="result-chip"
            style={{ padding: "12px 16px" }}
          >
            <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--pmu-text-muted)", marginBottom: 6 }}>
              {s.label}
            </p>
            <p style={{ fontFamily: "var(--font-display)", fontSize: "1.35rem", fontWeight: 800, color: "var(--pmu-text)", lineHeight: 1 }}>
              {s.value}
            </p>
          </div>
        ))}
      </div>

      {/* Météo */}
      {meteo ? (
        <div style={{ marginTop: 10, padding: "10px 14px", borderRadius: 8, border: "1px solid var(--pmu-border)", background: "var(--pmu-surface-2)", display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "var(--pmu-text-soft)" }}>
          <WeatherIcon description={meteo.description} />
          <span>{meteo.description} · {meteo.temperature}°C · Vent {meteo.vent_kmh} km/h</span>
          {meteo.terrain_impact === "DEFAVORABLE" && (
            <span style={{ marginLeft: "auto", padding: "2px 8px", borderRadius: 5, fontSize: 10, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", background: "rgba(220,50,47,.1)", color: "var(--pmu-red)", border: "1px solid rgba(220,50,47,.2)" }}>
              Terrain défavorable
            </span>
          )}
        </div>
      ) : null}
    </section>
  );
}
