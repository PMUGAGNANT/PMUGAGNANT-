"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";

interface RaceSummary {
  dateStr: string;
  reunion: number;
  course: number;
  hippodrome: string;
  pays: string;
  nomCourse: string;
  heureDepart: string;
  discipline: string;
  estTrot: boolean;
  estPlat: boolean;
  estQuinte: boolean;
  allocation: number;
  distance: number;
  nombrePartants: number;
}

type RaceStatus = "upcoming" | "prono_available" | "finished";
type HomeSortMode =
  | "time_asc"
  | "confidence_desc"
  | "confidence_asc"
  | "opportunity"
  | "allocation_desc";

function getMinutesUntilStart(heureDepart: string): number {
  const [hours, minutes] = heureDepart.split(":").map(Number);
  const now = new Date();
  const parisNow = new Date(
    now.toLocaleString("en-US", { timeZone: "Europe/Paris" })
  );
  const parisTarget = new Date(parisNow);
  parisTarget.setHours(hours, minutes, 0, 0);
  const diffMs = parisTarget.getTime() - parisNow.getTime();
  return diffMs / 60000;
}

function getRaceStatus(heureDepart: string): RaceStatus {
  const min = getMinutesUntilStart(heureDepart);
  if (min < -10) return "finished";
  if (min <= 30) return "prono_available";
  return "upcoming";
}

function getSecondsUntilStart(heureDepart: string): number {
  const [hours, minutes] = heureDepart.split(":").map(Number);
  const now = new Date();
  const parisNow = new Date(
    now.toLocaleString("en-US", { timeZone: "Europe/Paris" })
  );
  const parisTarget = new Date(parisNow);
  parisTarget.setHours(hours, minutes, 0, 0);
  return Math.round((parisTarget.getTime() - parisNow.getTime()) / 1000);
}

function formatCountdown(totalSeconds: number): string {
  if (totalSeconds <= 0) return "";
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) {
    return `Dans ${h}h${String(m).padStart(2, "0")}`;
  }
  return `Dans ${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function formatDiscipline(d: string): string {
  if (d.includes("TROT_ATTELE")) return "Trot Attelé";
  if (d.includes("TROT_MONTE")) return "Trot Monté";
  if (d === "PLAT") return "Plat";
  if (d.includes("OBSTACLE") || d.includes("HAIES") || d.includes("STEEPLE"))
    return "Obstacle";
  return d;
}

function getSortLabel(mode: HomeSortMode): string {
  switch (mode) {
    case "confidence_desc":
      return "Note forte";
    case "confidence_asc":
      return "Note faible";
    case "opportunity":
      return "Opportunites";
    case "allocation_desc":
      return "Allocation";
    default:
      return "Heure";
  }
}

function getRaceMinutes(heureDepart: string): number {
  const [hours, minutes] = heureDepart.split(":").map(Number);
  return hours * 60 + minutes;
}

function getFrenchDate(): string {
  const days = [
    "Dimanche",
    "Lundi",
    "Mardi",
    "Mercredi",
    "Jeudi",
    "Vendredi",
    "Samedi",
  ];
  const months = [
    "Janvier",
    "Février",
    "Mars",
    "Avril",
    "Mai",
    "Juin",
    "Juillet",
    "Août",
    "Septembre",
    "Octobre",
    "Novembre",
    "Décembre",
  ];
  const now = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Europe/Paris" })
  );
  return `${days[now.getDay()]} ${now.getDate()} ${months[now.getMonth()]}`;
}

// Skeleton shimmer keyframes injected once
const shimmerCSS = `
@keyframes shimmer {
  0% { background-position: -200px 0; }
  100% { background-position: 200px 0; }
}
`;

export default function Home() {
  const router = useRouter();
  const [races, setRaces] = useState<RaceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const styleInjected = useRef(false);

  // Confidence filter (persisted in localStorage)
  const [minConfiance, setMinConfiance] = useState<number>(0);
  const [showFilter, setShowFilter] = useState(false);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [scoresLoading, setScoresLoading] = useState(false);
  const scoresLoaded = useRef(false);
  const [sortMode, setSortMode] = useState<HomeSortMode>("time_asc");

  // Load saved filter from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("pmu_min_confiance");
      if (saved) setMinConfiance(Number(saved));
      const savedSort = localStorage.getItem("pmu_sort_mode");
      if (
        savedSort === "time_asc" ||
        savedSort === "confidence_desc" ||
        savedSort === "confidence_asc" ||
        savedSort === "opportunity" ||
        savedSort === "allocation_desc"
      ) {
        setSortMode(savedSort);
      }
    } catch { /* silent */ }
  }, []);

  // Inject shimmer keyframes once
  useEffect(() => {
    if (styleInjected.current) return;
    styleInjected.current = true;
    const style = document.createElement("style");
    style.textContent = shimmerCSS;
    document.head.appendChild(style);
  }, []);

  const fetchRaces = useCallback(async () => {
    try {
      const res = await fetch("/api/races");
      const data = await res.json();
      if (data.success && data.races) {
        setRaces(data.races);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch confidence scores (once)
  const fetchScores = useCallback(async () => {
    if (scoresLoaded.current) return;
    scoresLoaded.current = true;
    setScoresLoading(true);
    try {
      const res = await fetch("/api/races/scores");
      const data = await res.json();
      if (data.success && data.scores) {
        setScores(data.scores);
      }
    } catch { /* silent */ }
    setScoresLoading(false);
  }, []);

  // Initial fetch + 60s interval
  useEffect(() => {
    fetchRaces();
    const interval = setInterval(fetchRaces, 60000);
    return () => clearInterval(interval);
  }, [fetchRaces]);

  // Fetch scores when races load
  useEffect(() => {
    if (races.length > 0) fetchScores();
  }, [races, fetchScores]);

  // 1-second tick for countdowns
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  // Save filter to localStorage
  const handleFilterChange = (val: number) => {
    setMinConfiance(val);
    try {
      localStorage.setItem("pmu_min_confiance", String(val));
    } catch { /* silent */ }
  };

  const handleSortChange = (mode: HomeSortMode) => {
    setSortMode(mode);
    try {
      localStorage.setItem("pmu_sort_mode", mode);
    } catch { /* silent */ }
  };

  // Sort races by departure time
  const timeSortedRaces = [...races].sort(
    (a, b) => getRaceMinutes(a.heureDepart) - getRaceMinutes(b.heureDepart)
  );

  // Apply confidence filter
  const filteredRaces = minConfiance > 0
    ? timeSortedRaces.filter((race) => {
        const key = `${race.reunion}-${race.course}`;
        const score = scores[key];
        // Keep upcoming races (no score yet) + races matching filter
        if (score === undefined) {
          const status = getRaceStatus(race.heureDepart);
          return status === "upcoming"; // show upcoming, hide analyzed without score
        }
        return score >= minConfiance;
      })
    : timeSortedRaces;

  const sortedRaces = [...filteredRaces].sort((a, b) => {
    const aKey = `${a.reunion}-${a.course}`;
    const bKey = `${b.reunion}-${b.course}`;
    const aScore = scores[aKey];
    const bScore = scores[bKey];
    const aMinutesUntil = getMinutesUntilStart(a.heureDepart);
    const bMinutesUntil = getMinutesUntilStart(b.heureDepart);
    const aStatus = getRaceStatus(a.heureDepart);
    const bStatus = getRaceStatus(b.heureDepart);

    if (sortMode === "confidence_desc") {
      if (aScore === undefined && bScore === undefined) {
        return getRaceMinutes(a.heureDepart) - getRaceMinutes(b.heureDepart);
      }
      if (aScore === undefined) return 1;
      if (bScore === undefined) return -1;
      if (bScore !== aScore) return bScore - aScore;
      return getRaceMinutes(a.heureDepart) - getRaceMinutes(b.heureDepart);
    }

    if (sortMode === "confidence_asc") {
      if (aScore === undefined && bScore === undefined) {
        return getRaceMinutes(a.heureDepart) - getRaceMinutes(b.heureDepart);
      }
      if (aScore === undefined) return 1;
      if (bScore === undefined) return -1;
      if (aScore !== bScore) return aScore - bScore;
      return getRaceMinutes(a.heureDepart) - getRaceMinutes(b.heureDepart);
    }

    if (sortMode === "opportunity") {
      const aOpportunity =
        (aStatus === "prono_available" ? 3 : aStatus === "upcoming" ? 2 : 1) +
        ((aScore ?? 0) / 10);
      const bOpportunity =
        (bStatus === "prono_available" ? 3 : bStatus === "upcoming" ? 2 : 1) +
        ((bScore ?? 0) / 10);
      if (bOpportunity !== aOpportunity) return bOpportunity - aOpportunity;
      return aMinutesUntil - bMinutesUntil;
    }

    if (sortMode === "allocation_desc") {
      if (b.allocation !== a.allocation) return b.allocation - a.allocation;
      return getRaceMinutes(a.heureDepart) - getRaceMinutes(b.heureDepart);
    }

    return getRaceMinutes(a.heureDepart) - getRaceMinutes(b.heureDepart);
  });

  const totalCourses = races.length;
  const reunionSet = new Set(races.map((r) => r.reunion));
  const totalReunions = reunionSet.size;
  const pronoCount = races.filter(
    (r) => getRaceStatus(r.heureDepart) === "prono_available"
  ).length;

  const handleCardClick = (race: RaceSummary) => {
    const status = getRaceStatus(race.heureDepart);
    if (status === "prono_available" || status === "finished") {
      router.push(`/course/${race.reunion}/${race.course}`);
    }
  };

  // Force re-read on tick (countdowns)
  void tick;

  return (
    <div
      style={{
        maxWidth: 430,
        margin: "0 auto",
        minHeight: "100vh",
        background: "#F5F5F5",
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        position: "relative",
      }}
    >
      {/* HEADER */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          background: "#1A1A1A",
          height: 56,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            color: "#00843D",
            fontWeight: 700,
            fontSize: 22,
            lineHeight: "24px",
            letterSpacing: "-0.3px",
          }}
        >
          PMU AI
        </div>
        <div
          style={{
            color: "#888",
            fontSize: 11,
            lineHeight: "14px",
            marginTop: 1,
          }}
        >
          Pronostics IA
        </div>
      </div>

      {/* GREEN BANNER */}
      <div
        style={{
          background: "linear-gradient(135deg, #00843D, #006B31)",
          borderRadius: 16,
          margin: "12px 16px",
          padding: 20,
          color: "#fff",
        }}
      >
        <div style={{ fontSize: 12, opacity: 0.85, marginBottom: 4 }}>
          Aujourd&apos;hui
        </div>
        <div
          style={{
            fontSize: 18,
            fontWeight: 600,
            marginBottom: 8,
            lineHeight: "22px",
          }}
        >
          {getFrenchDate()}
        </div>
        <div
          style={{
            fontSize: 22,
            fontWeight: 700,
            marginBottom: 4,
            lineHeight: "28px",
          }}
        >
          {loading
            ? "Chargement..."
            : `${totalCourses} courses \u00B7 ${totalReunions} r\u00E9unions`}
        </div>
        <div style={{ fontSize: 13, opacity: 0.9 }}>
          {loading ? "" : `${pronoCount} pronostics disponibles`}
        </div>
      </div>

      {/* FILTER BAR */}
      <div
        style={{
          margin: "0 16px 8px",
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <button
          onClick={() => router.push("/live")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "8px 14px",
            borderRadius: 20,
            border: "1px solid #111",
            background: "#111",
            color: "#fff",
            fontSize: 13,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          <span style={{ fontSize: 14, lineHeight: 1 }}>⚡</span>
          Live
        </button>
        <button
          onClick={() => setShowFilter(!showFilter)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "8px 14px",
            borderRadius: 20,
            border: minConfiance > 0 ? "2px solid #00843D" : "1px solid #ddd",
            background: minConfiance > 0 ? "#E8F5E9" : "#fff",
            color: minConfiance > 0 ? "#00843D" : "#555",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="4" y1="6" x2="20" y2="6" />
            <line x1="8" y1="12" x2="16" y2="12" />
            <line x1="11" y1="18" x2="13" y2="18" />
          </svg>
          {minConfiance > 0 ? `Confiance ≥ ${minConfiance}/10` : "Filtrer"}
        </button>
        <button
          onClick={() => setShowFilter(!showFilter)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "8px 14px",
            borderRadius: 20,
            border: "1px solid #ddd",
            background: "#fff",
            color: "#555",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Tri: {getSortLabel(sortMode)}
        </button>
        {minConfiance > 0 && (
          <button
            onClick={() => handleFilterChange(0)}
            style={{
              padding: "6px 10px",
              borderRadius: 20,
              border: "none",
              background: "#FDECEA",
              color: "#E74C3C",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            ✕ Reset
          </button>
        )}
        {scoresLoading && (
          <span style={{ fontSize: 12, color: "#888" }}>Chargement scores...</span>
        )}
        {minConfiance > 0 && !scoresLoading && (
          <span style={{ fontSize: 12, color: "#888" }}>
            {filteredRaces.length} course{filteredRaces.length > 1 ? "s" : ""}
          </span>
        )}
      </div>

      <div
        style={{
          margin: "0 16px 12px",
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        {[
          { value: "time_asc", label: "Par heure" },
          { value: "confidence_desc", label: "Meilleure note" },
          { value: "confidence_asc", label: "Note faible" },
          { value: "opportunity", label: "Opportunites" },
          { value: "allocation_desc", label: "Allocation" },
        ].map((option) => (
          <button
            key={option.value}
            onClick={() => handleSortChange(option.value as HomeSortMode)}
            style={{
              padding: "8px 12px",
              borderRadius: 20,
              border: sortMode === option.value ? "2px solid #111" : "1px solid #ddd",
              background: sortMode === option.value ? "#111" : "#fff",
              color: sortMode === option.value ? "#fff" : "#555",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {option.label}
          </button>
        ))}
      </div>

      {/* FILTER PANEL */}
      {showFilter && (
        <div
          style={{
            margin: "0 16px 12px",
            padding: 16,
            background: "#fff",
            borderRadius: 16,
            boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 700, color: "#1A1A1A", marginBottom: 12 }}>
            Confiance minimum
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {[0, 3, 4, 5, 6, 7, 8, 9].map((val) => (
              <button
                key={val}
                onClick={() => {
                  handleFilterChange(val);
                  setShowFilter(false);
                }}
                style={{
                  padding: "8px 14px",
                  borderRadius: 12,
                  border: minConfiance === val ? "2px solid #00843D" : "1px solid #ddd",
                  background: minConfiance === val ? "#E8F5E9" : "#fff",
                  color: minConfiance === val ? "#00843D" : "#555",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                  minWidth: 60,
                }}
              >
                {val === 0 ? "Tout" : `≥ ${val}/10`}
              </button>
            ))}
          </div>
          <div style={{ fontSize: 12, color: "#888", marginTop: 10 }}>
            Ce filtre est sauvegardé automatiquement
          </div>
        </div>
      )}

      {/* CONTENT */}
      <div style={{ paddingBottom: 80 }}>
        {loading ? (
          <div style={{ padding: "0 16px" }}>
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                style={{
                  height: 120,
                  borderRadius: 16,
                  marginBottom: 8,
                  background:
                    "linear-gradient(90deg, #e0e0e0 25%, #f0f0f0 50%, #e0e0e0 75%)",
                  backgroundSize: "400px 100%",
                  animation: "shimmer 1.5s infinite linear",
                }}
              />
            ))}
          </div>
        ) : (
          <div>
            {filteredRaces.map((race) => {
              const status = getRaceStatus(race.heureDepart);
              const secondsUntil = getSecondsUntilStart(race.heureDepart);
              const isProno = status === "prono_available";
              const isFinished = status === "finished";
              const isUpcoming = status === "upcoming";
              const isClickable = isProno || isFinished;
              const raceKey = `${race.reunion}-${race.course}`;
              const confScore = scores[raceKey];

              return (
                <div
                      key={`${race.reunion}-${race.course}`}
                      onClick={() => handleCardClick(race)}
                      style={{
                        background: "#fff",
                        borderRadius: 16,
                        margin: "8px 16px",
                        padding: 16,
                        boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                        borderLeft: `4px solid ${isProno ? "#00843D" : isFinished ? "#888" : "#ddd"}`,
                        cursor: isClickable ? "pointer" : "default",
                        transition: "transform 0.15s ease",
                        position: "relative",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        gap: 12,
                      }}
                    >
                      {/* Left content */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {/* Top row: time + pills */}
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            marginBottom: 6,
                            flexWrap: "wrap",
                          }}
                        >
                          <span
                            style={{
                              fontSize: 18,
                              fontWeight: 700,
                              color: isProno ? "#00843D" : "#333",
                              lineHeight: "22px",
                            }}
                          >
                            {race.heureDepart}
                          </span>
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 600,
                              background: "#E8F5E9",
                              color: "#2E7D32",
                              padding: "2px 8px",
                              borderRadius: 20,
                              lineHeight: "18px",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {formatDiscipline(race.discipline)}
                          </span>
                          {race.estQuinte && (
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 700,
                                background: "#FFF3CD",
                                color: "#856404",
                                padding: "2px 8px",
                                borderRadius: 20,
                                lineHeight: "18px",
                                whiteSpace: "nowrap",
                              }}
                            >
                              QUINTE+
                            </span>
                          )}
                        </div>

                        {/* Course name */}
                        <div
                          style={{
                            fontSize: 15,
                            fontWeight: 700,
                            color: "#1A1A1A",
                            lineHeight: "20px",
                            marginBottom: 4,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          R{race.reunion}C{race.course} — {race.nomCourse}
                        </div>

                        {/* Bottom info */}
                        <div
                          style={{
                            fontSize: 13,
                            color: "#888",
                            lineHeight: "18px",
                          }}
                        >
                          {race.hippodrome} &middot; {race.nombrePartants} partants &middot;{" "}
                          {race.distance}m
                        </div>
                        {confScore !== undefined && (
                          <div style={{ marginTop: 6 }}>
                            <span
                              style={{
                                display: "inline-block",
                                fontSize: 11,
                                fontWeight: 700,
                                padding: "2px 8px",
                                borderRadius: 20,
                                background: confScore >= 7.5 ? "#E8F5E9" : confScore >= 5.5 ? "#FFF3CD" : confScore >= 3.5 ? "#FFF3CD" : "#FDECEA",
                                color: confScore >= 7.5 ? "#00843D" : confScore >= 5.5 ? "#856404" : confScore >= 3.5 ? "#E67E22" : "#E74C3C",
                              }}
                            >
                              Confiance {confScore}/10
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Right: status badge */}
                      <div
                        style={{
                          flexShrink: 0,
                          display: "flex",
                          alignItems: "center",
                          marginTop: 2,
                        }}
                      >
                        {isFinished && (
                          <span
                            style={{
                              fontSize: 12,
                              fontWeight: 600,
                              background: "#F5F5F5",
                              color: "#666",
                              padding: "4px 10px",
                              borderRadius: 20,
                              lineHeight: "18px",
                              whiteSpace: "nowrap",
                              cursor: "pointer",
                            }}
                          >
                            Résultat &#10140;
                          </span>
                        )}
                        {isProno && (
                          <span
                            style={{
                              fontSize: 12,
                              fontWeight: 700,
                              background: "#E8F5E9",
                              color: "#00843D",
                              padding: "4px 12px",
                              borderRadius: 20,
                              lineHeight: "18px",
                              cursor: "pointer",
                              whiteSpace: "nowrap",
                            }}
                          >
                            Prono dispo &#10140;
                          </span>
                        )}
                        {isUpcoming && secondsUntil > 0 && (
                          <span
                            style={{
                              fontSize: 13,
                              fontWeight: 600,
                              color: "#E67E22",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {formatCountdown(secondsUntil)}
                          </span>
                        )}
                      </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* BOTTOM TAB BAR */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: "50%",
          transform: "translateX(-50%)",
          width: "100%",
          maxWidth: 430,
          zIndex: 50,
          background: "#fff",
          borderTop: "1px solid #eee",
          height: 64,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-around",
        }}
      >
        {/* Courses (active) */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 2,
            cursor: "pointer",
            position: "relative",
            paddingTop: 8,
          }}
        >
          <div
            style={{
              width: 4,
              height: 4,
              borderRadius: "50%",
              background: "#00843D",
              position: "absolute",
              top: 0,
            }}
          />
          <span style={{ fontSize: 22, lineHeight: "26px" }}>
            &#127943;
          </span>
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "#00843D",
              lineHeight: "14px",
            }}
          >
            Courses
          </span>
        </div>

        {/* Mes Paris */}
        <div
          onClick={() => router.push("/mes-paris")}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 2,
            cursor: "pointer",
            paddingTop: 8,
          }}
        >
          <span style={{ fontSize: 22, lineHeight: "26px" }}>&#128176;</span>
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "#999",
              lineHeight: "14px",
            }}
          >
            Mes Paris
          </span>
        </div>

        {/* Bilan */}
        <div
          onClick={() => router.push("/bilan")}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 2,
            cursor: "pointer",
            paddingTop: 8,
          }}
        >
          <span style={{ fontSize: 22, lineHeight: "26px" }}>
            &#128202;
          </span>
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "#999",
              lineHeight: "14px",
            }}
          >
            Bilan
          </span>
        </div>
      </div>
    </div>
  );
}
