"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  formatDateToPmu,
  fromIsoDate,
  getMinutesUntilStart,
  getTodayDateStr,
  parsePmuDate,
  toIsoDate,
} from "@/lib/date-utils";
import type { RaceSummary } from "@/lib/types";

type ScoreStage = "preview_2h" | "preview_1h" | "final_30m" | "finished";

type RaceScore = {
  score: number;
  stage: ScoreStage;
};

type RacesResponse = {
  success: boolean;
  date: string;
  races: RaceSummary[];
};

type ScoresResponse = {
  success: boolean;
  scores: Record<string, RaceScore>;
};

type SortMode = "hour" | "score" | "urgent" | "allocation";

const DARK = "#171b1f";
const GREEN = "#0b8f4d";

function formatCurrency(value: number | null | undefined) {
  if (!value) return "Allocation -";
  return `${new Intl.NumberFormat("fr-FR").format(value)} EUR`;
}

function formatDisplayDate(dateStr: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(parsePmuDate(dateStr));
}

function formatRelativeDay(dateStr: string) {
  const today = parsePmuDate(getTodayDateStr());
  const target = parsePmuDate(dateStr);
  const diff = Math.round((target.getTime() - today.getTime()) / 86400000);

  if (diff === 0) return "Aujourd'hui";
  if (diff === -1) return "Hier";
  if (diff === 1) return "Demain";
  return "Selection";
}

function addDays(dateStr: string, delta: number) {
  const next = parsePmuDate(dateStr);
  next.setDate(next.getDate() + delta);
  return formatDateToPmu(next);
}

function formatDiscipline(race: RaceSummary) {
  if (race.estPlat) return "Plat";
  if (race.estTrot && race.discipline.includes("MONTE")) return "Monte";
  if (race.estTrot) return "Attele";
  if (race.discipline.includes("OBSTACLE") || race.discipline.includes("HAIES") || race.discipline.includes("STEEPLE")) {
    return "Obstacle";
  }
  return race.discipline.replaceAll("_", " ");
}

function getStageLabel(stage: ScoreStage | null) {
  if (stage === "preview_2h") return "Note 2h";
  if (stage === "preview_1h") return "Note 1h";
  if (stage === "final_30m") return "Note 30 min";
  if (stage === "finished") return "Course finie";
  return "En attente";
}

function getStageStyle(stage: ScoreStage | null) {
  if (stage === "preview_2h") return { background: "#EEF5FF", color: "#2563EB" };
  if (stage === "preview_1h") return { background: "#E7F8EE", color: GREEN };
  if (stage === "final_30m") return { background: "#FFF4D8", color: "#A66B00" };
  if (stage === "finished") return { background: "#F3F4F6", color: "#64748B" };
  return { background: "#F3F4F6", color: "#64748B" };
}

function getScoreTone(score: number | null) {
  if (score === null) return { background: "#F3F4F6", color: "#64748B" };
  if (score >= 7.5) return { background: "#E7F8EE", color: GREEN };
  if (score >= 6) return { background: "#FFF4D8", color: "#A66B00" };
  return { background: "#FDECEA", color: "#D64545" };
}

function getRaceHint(race: RaceSummary, score: number | null, stage: ScoreStage | null, minutesUntilStart: number) {
  if (stage === "finished") {
    return "La course est terminee. Ouvre le detail pour voir le ticket et le resultat final.";
  }
  if (score === null) {
    if (minutesUntilStart > 120) {
      return "Le moteur ouvrira l'analyse a partir de 2 heures avant le depart.";
    }
    return "La course est dans la fenetre d'analyse, le moteur termine sa lecture.";
  }
  if (score >= 7.5) {
    return "Base lisible avec un ticket principal qui ressort proprement.";
  }
  if (score >= 6) {
    return "Course jouable, mais elle demande plus de selection et de prudence.";
  }
  return "Lecture prudente. La course reste ouverte ou nerveuse.";
}

function getCardAccent(score: number | null, stage: ScoreStage | null) {
  if (stage === "finished") return "#CBD5E1";
  if (score === null) return "#D7DEE7";
  if (score >= 7.5) return GREEN;
  if (score >= 6) return "#D4A017";
  return "#D64545";
}

function DateNavigator({
  dateStr,
  onChange,
}: {
  dateStr: string;
  onChange: (nextDate: string) => void;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "44px 1fr 44px",
        gap: 10,
        alignItems: "center",
        marginBottom: 16,
      }}
    >
      <button
        onClick={() => onChange(addDays(dateStr, -1))}
        style={{
          height: 44,
          borderRadius: 16,
          border: "1px solid rgba(15,23,42,0.08)",
          background: "#fff",
          color: DARK,
          fontSize: 18,
          fontWeight: 800,
          cursor: "pointer",
        }}
      >
        {"<"}
      </button>

      <div
        style={{
          background: "#fff",
          borderRadius: 20,
          border: "1px solid rgba(15,23,42,0.06)",
          boxShadow: "0 16px 32px rgba(15,23,42,0.06)",
          padding: 12,
          display: "grid",
          gap: 8,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: "#7A8A9A", textTransform: "uppercase", letterSpacing: 0.4 }}>
              {formatRelativeDay(dateStr)}
            </div>
            <div style={{ fontSize: 16, fontWeight: 800, color: DARK }}>{formatDisplayDate(dateStr)}</div>
          </div>
          <button
            onClick={() => onChange(getTodayDateStr())}
            style={{
              border: "none",
              borderRadius: 999,
              background: "#E7F8EE",
              color: GREEN,
              padding: "8px 12px",
              fontSize: 12,
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            Aujourd&apos;hui
          </button>
        </div>
        <input
          type="date"
          value={toIsoDate(dateStr)}
          onChange={(event) => onChange(fromIsoDate(event.target.value))}
          style={{
            width: "100%",
            borderRadius: 14,
            border: "1px solid rgba(15,23,42,0.08)",
            padding: "10px 12px",
            fontSize: 14,
            fontWeight: 700,
            color: DARK,
          }}
        />
      </div>

      <button
        onClick={() => onChange(addDays(dateStr, 1))}
        style={{
          height: 44,
          borderRadius: 16,
          border: "1px solid rgba(15,23,42,0.08)",
          background: "#fff",
          color: DARK,
          fontSize: 18,
          fontWeight: 800,
          cursor: "pointer",
        }}
      >
        {">"}
      </button>
    </div>
  );
}

function HomePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlDate = searchParams.get("date") || getTodayDateStr();
  const [selectedDate, setSelectedDate] = useState(urlDate);
  const [sortMode, setSortMode] = useState<SortMode>("hour");
  const [races, setRaces] = useState<RaceSummary[]>([]);
  const [scores, setScores] = useState<Record<string, RaceScore>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setSelectedDate(urlDate);
  }, [urlDate]);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("pmu-sort-mode");
      if (
        stored === "hour" ||
        stored === "score" ||
        stored === "urgent" ||
        stored === "allocation"
      ) {
        setSortMode(stored);
      }
    } catch {
      // Ignore storage errors on locked browsers.
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem("pmu-sort-mode", sortMode);
    } catch {
      // Ignore storage errors on locked browsers.
    }
  }, [sortMode]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");
      try {
        const [racesResponse, scoresResponse] = await Promise.all([
          fetch(`/api/races?date=${selectedDate}`, { cache: "no-store" }),
          fetch(`/api/races/scores?date=${selectedDate}`, { cache: "no-store" }),
        ]);

        const racesPayload = (await racesResponse.json()) as RacesResponse;
        const scoresPayload = (await scoresResponse.json()) as ScoresResponse;

        if (!racesResponse.ok || !racesPayload.success) {
          throw new Error(racesPayload.success ? "Chargement impossible" : "Courses indisponibles");
        }

        if (!cancelled) {
          setRaces(racesPayload.races);
          setScores(scoresPayload.success ? scoresPayload.scores : {});
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Chargement impossible");
          setRaces([]);
          setScores({});
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [selectedDate]);

  const sortedRaces = useMemo(() => {
    const copy = [...races];

    copy.sort((left, right) => {
      const leftKey = `${left.reunion}-${left.course}`;
      const rightKey = `${right.reunion}-${right.course}`;
      const leftScore = scores[leftKey]?.score ?? -1;
      const rightScore = scores[rightKey]?.score ?? -1;
      const leftMinutes = getMinutesUntilStart(left.heureDepart, left.dateStr);
      const rightMinutes = getMinutesUntilStart(right.heureDepart, right.dateStr);

      if (sortMode === "score") {
        if (rightScore !== leftScore) return rightScore - leftScore;
        return leftMinutes - rightMinutes;
      }

      if (sortMode === "urgent") {
        return leftMinutes - rightMinutes;
      }

      if (sortMode === "allocation") {
        if (right.allocation !== left.allocation) return right.allocation - left.allocation;
        return leftMinutes - rightMinutes;
      }

      return leftMinutes - rightMinutes;
    });

    return copy;
  }, [races, scores, sortMode]);

  const radarRace = useMemo(() => {
    const active = sortedRaces.filter((race) => {
      const key = `${race.reunion}-${race.course}`;
      return scores[key]?.score !== undefined && scores[key]?.stage !== "finished";
    });

    if (active.length > 0) {
      return [...active].sort((left, right) => {
        const leftScore = scores[`${left.reunion}-${left.course}`]?.score ?? 0;
        const rightScore = scores[`${right.reunion}-${right.course}`]?.score ?? 0;
        if (rightScore !== leftScore) return rightScore - leftScore;
        return getMinutesUntilStart(left.heureDepart, left.dateStr) - getMinutesUntilStart(right.heureDepart, right.dateStr);
      })[0];
    }

    return sortedRaces[0] ?? null;
  }, [scores, sortedRaces]);

  const scoredCount = useMemo(
    () => Object.values(scores).filter((entry) => entry.stage !== "finished").length,
    [scores]
  );

  function updateDate(nextDate: string) {
    setSelectedDate(nextDate);
    router.replace(`/?date=${nextDate}`, { scroll: false });
  }

  function openRace(race: RaceSummary) {
    router.push(`/course/${race.reunion}/${race.course}?date=${selectedDate}`);
  }

  return (
    <div
      style={{
        maxWidth: 430,
        margin: "0 auto",
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top left, rgba(11,143,77,0.14), transparent 26%), radial-gradient(circle at top right, rgba(19,35,28,0.16), transparent 22%), linear-gradient(180deg, #f7faf9 0%, #eef3f4 100%)",
        paddingBottom: 92,
      }}
    >
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 30,
          background: "rgba(23,27,31,0.92)",
          backdropFilter: "blur(20px)",
          color: "#fff",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          height: 76,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: 0.2 }}>PMU AI</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.68)", letterSpacing: 1.1 }}>
            PRONOSTICS IA
          </div>
        </div>
      </div>

      <div style={{ padding: 16, display: "grid", gap: 16 }}>
        <DateNavigator dateStr={selectedDate} onChange={updateDate} />

        <div
          style={{
            background: "linear-gradient(145deg, #0b8f4d, #09723d)",
            color: "#fff",
            borderRadius: 28,
            padding: 24,
            boxShadow: "0 24px 46px rgba(9,114,61,0.26)",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: -20,
              right: -26,
              width: 150,
              height: 150,
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(255,255,255,0.18) 0%, transparent 72%)",
            }}
          />
          <div style={{ position: "relative" }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: "rgba(255,255,255,0.86)", marginBottom: 8 }}>
              {formatRelativeDay(selectedDate)}
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 10 }}>
              {formatDisplayDate(selectedDate)}
            </div>
            <div style={{ fontSize: 24, fontWeight: 900, lineHeight: 1.1, marginBottom: 6 }}>
              {races.length} courses · {new Set(races.map((race) => race.reunion)).size} reunions
            </div>
            <div style={{ fontSize: 14, color: "rgba(255,255,255,0.82)", marginBottom: 16 }}>
              {scoredCount} course{scoredCount > 1 ? "s" : ""} deja notee{scoredCount > 1 ? "s" : ""} par le moteur
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div style={{ background: "rgba(255,255,255,0.12)", borderRadius: 18, padding: 14 }}>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", marginBottom: 6, textTransform: "uppercase", fontWeight: 800 }}>
                  Radar actif
                </div>
                <div style={{ fontSize: 16, fontWeight: 900 }}>{scoredCount} courses notees</div>
              </div>
              <div style={{ background: "rgba(255,255,255,0.12)", borderRadius: 18, padding: 14 }}>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", marginBottom: 6, textTransform: "uppercase", fontWeight: 800 }}>
                  Tri moteur
                </div>
                <div style={{ fontSize: 16, fontWeight: 900 }}>
                  {sortMode === "hour"
                    ? "Par heure"
                    : sortMode === "score"
                      ? "Meilleure note"
                      : sortMode === "urgent"
                        ? "A suivre vite"
                        : "Gros enjeux"}
                </div>
              </div>
            </div>
          </div>
        </div>

        {radarRace ? (() => {
          const key = `${radarRace.reunion}-${radarRace.course}`;
          const raceScore = scores[key];
          const minutesUntilStart = getMinutesUntilStart(radarRace.heureDepart, radarRace.dateStr);
          const scoreValue = raceScore?.score ?? null;
          const scoreTone = getScoreTone(scoreValue);
          const stageTone = getStageStyle(raceScore?.stage ?? null);

          return (
            <button
              onClick={() => openRace(radarRace)}
              style={{
                border: "none",
                cursor: "pointer",
                textAlign: "left",
                background: "linear-gradient(145deg, #132126, #1b252b)",
                color: "#fff",
                borderRadius: 28,
                padding: 22,
                boxShadow: "0 24px 46px rgba(15,23,42,0.22)",
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 800, color: "#6CE4A0", textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 10 }}>
                Radar du jour
              </div>
              <div style={{ fontSize: 18, fontWeight: 900, lineHeight: 1.15, marginBottom: 8 }}>
                R{radarRace.reunion}C{radarRace.course} - {radarRace.nomCourse}
              </div>
              <div style={{ color: "rgba(255,255,255,0.74)", fontSize: 14, marginBottom: 14 }}>
                {radarRace.hippodrome} · {radarRace.heureDepart} · {radarRace.nombrePartants} partants · {radarRace.distance} m
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                {scoreValue !== null ? (
                  <span
                    style={{
                      background: scoreTone.background,
                      color: scoreTone.color,
                      borderRadius: 999,
                      padding: "8px 12px",
                      fontSize: 13,
                      fontWeight: 800,
                    }}
                  >
                    Confiance {scoreValue}/10
                  </span>
                ) : null}
                <span
                  style={{
                    background: stageTone.background,
                    color: stageTone.color,
                    borderRadius: 999,
                    padding: "8px 12px",
                    fontSize: 13,
                    fontWeight: 800,
                  }}
                >
                  {getStageLabel(raceScore?.stage ?? null)}
                </span>
              </div>
              <div style={{ color: "rgba(255,255,255,0.82)", fontSize: 14, lineHeight: 1.45 }}>
                {getRaceHint(radarRace, scoreValue, raceScore?.stage ?? null, minutesUntilStart)}
              </div>
            </button>
          );
        })() : null}

        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {([
              { key: "hour", label: "Par heure" },
              { key: "score", label: "Meilleure note" },
              { key: "urgent", label: "A suivre vite" },
              { key: "allocation", label: "Gros enjeux" },
            ] satisfies Array<{ key: SortMode; label: string }>).map((option) => (
              <button
                key={option.key}
                onClick={() => setSortMode(option.key)}
                style={{
                  border: option.key === sortMode ? "none" : "1px solid rgba(15,23,42,0.08)",
                  background: option.key === sortMode ? DARK : "#fff",
                  color: option.key === sortMode ? "#fff" : "#475569",
                  borderRadius: 999,
                  padding: "10px 14px",
                  fontSize: 13,
                  fontWeight: 800,
                  cursor: "pointer",
                  boxShadow: option.key === sortMode ? "0 14px 28px rgba(15,23,42,0.18)" : "none",
                }}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div>
            <div style={{ fontSize: 18, fontWeight: 900, color: DARK, marginBottom: 6 }}>Courses a suivre</div>
            <div style={{ color: "#738395", fontSize: 14 }}>
              Tri intelligent par heure, confiance, urgence et niveau d&apos;enjeu.
            </div>
          </div>
        </div>

        {loading ? (
          <div style={{ color: "#64748B", background: "#fff", borderRadius: 24, padding: 20 }}>Chargement des courses...</div>
        ) : null}

        {error ? (
          <div style={{ color: "#D64545", background: "#fff", borderRadius: 24, padding: 20 }}>{error}</div>
        ) : null}

        {!loading && !error ? (
          <div style={{ display: "grid", gap: 14 }}>
            {sortedRaces.map((race) => {
              const key = `${race.reunion}-${race.course}`;
              const raceScore = scores[key];
              const minutesUntilStart = getMinutesUntilStart(race.heureDepart, race.dateStr);
              const accent = getCardAccent(raceScore?.score ?? null, raceScore?.stage ?? null);
              const scoreTone = getScoreTone(raceScore?.score ?? null);
              const stageTone = getStageStyle(raceScore?.stage ?? null);

              return (
                <button
                  key={`${race.reunion}-${race.course}-${race.dateStr}`}
                  onClick={() => openRace(race)}
                  style={{
                    border: "none",
                    cursor: "pointer",
                    textAlign: "left",
                    background: "#fff",
                    borderRadius: 26,
                    padding: 20,
                    boxShadow: "0 18px 36px rgba(15,23,42,0.08)",
                    borderLeft: `5px solid ${accent}`,
                    display: "grid",
                    gap: 12,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 900, color: DARK, marginBottom: 6 }}>
                        {race.heureDepart}
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        <span style={{ background: "#EEF7EF", color: GREEN, borderRadius: 999, padding: "6px 10px", fontSize: 12, fontWeight: 800 }}>
                          {formatDiscipline(race)}
                        </span>
                        {race.estQuinte ? (
                          <span style={{ background: "#FFF4D8", color: "#A66B00", borderRadius: 999, padding: "6px 10px", fontSize: 12, fontWeight: 800 }}>
                            Quinte
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <span style={{ color: "#D97706", fontSize: 14, fontWeight: 800, whiteSpace: "nowrap" }}>
                      {minutesUntilStart >= 60
                        ? `Dans ${Math.round(minutesUntilStart / 60)}h`
                        : minutesUntilStart >= 0
                          ? `Dans ${Math.round(minutesUntilStart)} min`
                          : raceScore?.stage === "finished"
                            ? "Resultat"
                            : "En cours"}
                    </span>
                  </div>

                  <div>
                    <div style={{ fontSize: 17, fontWeight: 900, color: DARK, lineHeight: 1.2, marginBottom: 6 }}>
                      R{race.reunion}C{race.course} - {race.nomCourse}
                    </div>
                    <div style={{ color: "#64748B", fontSize: 14 }}>
                      {race.hippodrome} · {race.nombrePartants} partants · {race.distance} m
                    </div>
                  </div>

                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {raceScore?.score !== undefined ? (
                      <span
                        style={{
                          background: scoreTone.background,
                          color: scoreTone.color,
                          borderRadius: 999,
                          padding: "7px 10px",
                          fontSize: 12,
                          fontWeight: 800,
                        }}
                      >
                        Confiance {raceScore.score}/10
                      </span>
                    ) : (
                      <span
                        style={{
                          background: "#F3F4F6",
                          color: "#64748B",
                          borderRadius: 999,
                          padding: "7px 10px",
                          fontSize: 12,
                          fontWeight: 800,
                        }}
                      >
                        Analyse a venir
                      </span>
                    )}
                    <span
                      style={{
                        background: stageTone.background,
                        color: stageTone.color,
                        borderRadius: 999,
                        padding: "7px 10px",
                        fontSize: 12,
                        fontWeight: 800,
                      }}
                    >
                      {getStageLabel(raceScore?.stage ?? null)}
                    </span>
                    <span
                      style={{
                        background: "#F3F4F6",
                        color: "#475569",
                        borderRadius: 999,
                        padding: "7px 10px",
                        fontSize: 12,
                        fontWeight: 800,
                      }}
                    >
                      {formatCurrency(race.allocation)}
                    </span>
                  </div>

                  <div style={{ color: "#5B6472", fontSize: 14, lineHeight: 1.45 }}>
                    {getRaceHint(race, raceScore?.score ?? null, raceScore?.stage ?? null, minutesUntilStart)}
                  </div>
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      <div
        style={{
          position: "fixed",
          left: "50%",
          bottom: 0,
          transform: "translateX(-50%)",
          width: "100%",
          maxWidth: 430,
          background: "rgba(255,255,255,0.94)",
          backdropFilter: "blur(18px)",
          borderTop: "1px solid rgba(15,23,42,0.08)",
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          zIndex: 40,
        }}
      >
        {[
          { label: "Courses", active: true, href: `/?date=${selectedDate}` },
          { label: "Mes Paris", active: false, href: "/mes-paris" },
          { label: "Bilan", active: false, href: `/bilan?date=${selectedDate}` },
        ].map((item) => (
          <button
            key={item.label}
            onClick={() => router.push(item.href)}
            style={{
              border: "none",
              background: "transparent",
              padding: "14px 10px 16px",
              fontWeight: item.active ? 900 : 700,
              color: item.active ? GREEN : "#5B6472",
              cursor: "pointer",
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            minHeight: "100vh",
            background:
              "radial-gradient(circle at top left, rgba(0,132,61,0.12), transparent 26%), radial-gradient(circle at top right, rgba(18,183,106,0.1), transparent 18%), #F6F7F8",
            maxWidth: 430,
            margin: "0 auto",
          }}
        />
      }
    >
      <HomePageContent />
    </Suspense>
  );
}
