"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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

interface RaceAnalysisResponse {
  success: boolean;
  pronoAvailable: boolean;
  isFinished: boolean;
  analysis: {
    favori?: { numPmu: number; nom: string } | null;
    recommandation?: { decision: string; vautLeCoup: boolean } | null;
    scoreConfiance?: { score: number } | null;
  } | null;
}

type LiveStatus = "upcoming" | "watch_now" | "live" | "finished";

const GREEN = "#00843D";
const DARK = "#1A1A1A";
const LIVE_RED = "#E53935";
const RECENT_GREY = "#757575";
const WATCH_WINDOW_MINUTES = 5;
const LIVE_WINDOW_AFTER_START = -20;
const RECENT_RESULT_WINDOW = -90;

function getParisNow() {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Paris" }));
}

function getMinutesUntilStart(heureDepart: string) {
  const [hours, minutes] = heureDepart.split(":").map(Number);
  const parisNow = getParisNow();
  const parisTarget = new Date(parisNow);
  parisTarget.setHours(hours, minutes, 0, 0);

  return Math.round((parisTarget.getTime() - parisNow.getTime()) / 60000);
}

function getSecondsUntilStart(heureDepart: string) {
  const [hours, minutes] = heureDepart.split(":").map(Number);
  const parisNow = getParisNow();
  const parisTarget = new Date(parisNow);
  parisTarget.setHours(hours, minutes, 0, 0);

  return Math.round((parisTarget.getTime() - parisNow.getTime()) / 1000);
}

function getRaceStatus(heureDepart: string): { status: LiveStatus; minutesUntil: number } {
  const minutesUntil = getMinutesUntilStart(heureDepart);

  if (minutesUntil < LIVE_WINDOW_AFTER_START) {
    return { status: "finished", minutesUntil };
  }

  if (minutesUntil <= 0) {
    return { status: "live", minutesUntil };
  }

  if (minutesUntil <= WATCH_WINDOW_MINUTES) {
    return { status: "live", minutesUntil };
  }

  if (minutesUntil <= 30) {
    return { status: "watch_now", minutesUntil };
  }

  return { status: "upcoming", minutesUntil };
}

function formatCountdown(totalSeconds: number) {
  if (totalSeconds <= 0) return "Maintenant";

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `Dans ${hours}h${String(minutes).padStart(2, "0")}`;
  }

  return `Dans ${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function formatDiscipline(discipline: string) {
  if (discipline.includes("TROT_ATTELE")) return "Trot Attele";
  if (discipline.includes("TROT_MONTE")) return "Trot Monte";
  if (discipline === "PLAT") return "Plat";
  if (discipline.includes("OBSTACLE") || discipline.includes("HAIES") || discipline.includes("STEEPLE")) {
    return "Obstacle";
  }

  return discipline;
}

function formatLastUpdated(date: Date | null) {
  if (!date) return "--:--:--";

  return date.toLocaleTimeString("fr-FR", {
    timeZone: "Europe/Paris",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function getLiveLabel(status: LiveStatus, minutesUntil: number, secondsUntil: number) {
  if (status === "live") {
    if (minutesUntil > 0) {
      return `Depart dans ${formatCountdown(secondsUntil).replace("Dans ", "")}`;
    }

    const minutesRunning = Math.abs(minutesUntil);
    return minutesRunning <= 1 ? "Depart en cours" : `Partie il y a ${minutesRunning} min`;
  }

  if (status === "watch_now") {
    return formatCountdown(secondsUntil);
  }

  return `Terminee il y a ${Math.abs(minutesUntil)} min`;
}

function SectionTitle({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <div style={{ margin: "20px 16px 10px" }}>
      <div style={{ fontSize: 18, fontWeight: 700, color: DARK }}>{title}</div>
      <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>{subtitle}</div>
    </div>
  );
}

export default function LivePage() {
  const router = useRouter();
  const [races, setRaces] = useState<RaceSummary[]>([]);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [featuredAnalysis, setFeaturedAnalysis] = useState<RaceAnalysisResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [, setTick] = useState(0);

  const sortedRaces = useMemo(() => {
    return [...races].sort((a, b) => {
      const [ah, am] = a.heureDepart.split(":").map(Number);
      const [bh, bm] = b.heureDepart.split(":").map(Number);
      return ah * 60 + am - (bh * 60 + bm);
    });
  }, [races]);

  const liveRaces = sortedRaces.filter((race) => getRaceStatus(race.heureDepart).status === "live");
  const actualLiveRaces = liveRaces.filter((race) => getRaceStatus(race.heureDepart).minutesUntil <= 0);
  const imminentRaces = liveRaces.filter((race) => getRaceStatus(race.heureDepart).minutesUntil > 0);
  const watchNowRaces = sortedRaces.filter((race) => getRaceStatus(race.heureDepart).status === "watch_now");
  const recentResults = sortedRaces.filter((race) => {
    const { status, minutesUntil } = getRaceStatus(race.heureDepart);
    return status === "finished" && minutesUntil >= RECENT_RESULT_WINDOW;
  });

  const featuredRace = liveRaces[0] ?? watchNowRaces[0] ?? null;

  const fetchFeaturedAnalysis = useCallback(async (race: RaceSummary | null) => {
    if (!race) {
      setFeaturedAnalysis(null);
      return;
    }

    try {
      const res = await fetch(`/api/race/${race.reunion}/${race.course}`, { cache: "no-store" });
      const json = (await res.json()) as RaceAnalysisResponse;
      if (json.success) {
        setFeaturedAnalysis(json);
      } else {
        setFeaturedAnalysis(null);
      }
    } catch {
      setFeaturedAnalysis(null);
    }
  }, []);

  const fetchData = useCallback(async () => {
    try {
      setError(false);

      const [racesRes, scoresRes] = await Promise.all([
        fetch("/api/races", { cache: "no-store" }),
        fetch("/api/races/scores", { cache: "no-store" }),
      ]);

      const racesJson = await racesRes.json();
      const scoresJson = await scoresRes.json();

      if (racesJson.success && racesJson.races) {
        const fetchedRaces = racesJson.races as RaceSummary[];
        setRaces(fetchedRaces);

        const featured =
          fetchedRaces
            .sort((a, b) => {
              const [ah, am] = a.heureDepart.split(":").map(Number);
              const [bh, bm] = b.heureDepart.split(":").map(Number);
              return ah * 60 + am - (bh * 60 + bm);
            })
            .find((race) => {
              const { status } = getRaceStatus(race.heureDepart);
              return status === "live" || status === "watch_now";
            }) ?? null;

        void fetchFeaturedAnalysis(featured);
      } else {
        setError(true);
      }

      if (scoresJson.success && scoresJson.scores) {
        setScores(scoresJson.scores);
      }

      setLastUpdated(new Date());
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [fetchFeaturedAnalysis]);

  useEffect(() => {
    void fetchData();
    const refreshInterval = setInterval(() => {
      void fetchData();
    }, 30000);
    const tickInterval = setInterval(() => setTick((value) => value + 1), 1000);

    return () => {
      clearInterval(refreshInterval);
      clearInterval(tickInterval);
    };
  }, [fetchData]);

  const handleOpenRace = (race: RaceSummary) => {
    router.push(`/course/${race.reunion}/${race.course}`);
  };

  const renderRaceCard = (race: RaceSummary, accentColor: string) => {
    const raceKey = `${race.reunion}-${race.course}`;
    const score = scores[raceKey];
    const { status, minutesUntil } = getRaceStatus(race.heureDepart);
    const secondsUntil = getSecondsUntilStart(race.heureDepart);
    const label = getLiveLabel(status, minutesUntil, secondsUntil);

    return (
      <div
        key={raceKey}
        onClick={() => handleOpenRace(race)}
        style={{
          background: "#fff",
          borderRadius: 16,
          margin: "8px 16px",
          padding: 16,
          boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
          borderLeft: `4px solid ${accentColor}`,
          cursor: "pointer",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            marginBottom: 8,
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 700, color: accentColor }}>
            {race.heureDepart}
          </div>
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: accentColor,
              background: `${accentColor}14`,
              borderRadius: 20,
              padding: "4px 10px",
              whiteSpace: "nowrap",
            }}
          >
            {label}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              background: "#E8F5E9",
              color: "#2E7D32",
              padding: "2px 8px",
              borderRadius: 20,
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
              }}
            >
              QUINTE+
            </span>
          )}
        </div>

        <div style={{ fontSize: 16, fontWeight: 700, color: DARK, lineHeight: "22px" }}>
          R{race.reunion}C{race.course} - {race.nomCourse}
        </div>
        <div style={{ fontSize: 13, color: "#888", marginTop: 6 }}>
          {race.hippodrome} - {race.nombrePartants} partants - {race.distance}m
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: 12,
            gap: 12,
          }}
        >
          <div>
            {score !== undefined ? (
              <span
                style={{
                  display: "inline-block",
                  fontSize: 11,
                  fontWeight: 700,
                  padding: "4px 10px",
                  borderRadius: 20,
                  background: score >= 7.5 ? "#E8F5E9" : score >= 5.5 ? "#FFF3CD" : "#FDECEA",
                  color: score >= 7.5 ? GREEN : score >= 5.5 ? "#856404" : "#E74C3C",
                }}
              >
                Confiance {score}/10
              </span>
            ) : (
              <span style={{ fontSize: 12, color: "#888" }}>Analyse en cours...</span>
            )}
          </div>

          <span style={{ fontSize: 12, fontWeight: 700, color: accentColor }}>
            Ouvrir →
          </span>
        </div>
      </div>
    );
  };

  return (
    <div
      style={{
        maxWidth: 430,
        margin: "0 auto",
        minHeight: "100vh",
        background: "#F5F5F5",
        fontFamily: "system-ui, -apple-system, sans-serif",
        paddingBottom: 80,
      }}
    >
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 100,
          background: DARK,
          height: 56,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          onClick={() => router.push("/")}
          style={{
            position: "absolute",
            left: 16,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 32,
            height: 32,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.1)",
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
        </div>
        <div style={{ color: "#fff", fontWeight: 700, fontSize: 18 }}>
          ⚡ Live PMU
        </div>
      </div>

      <div
        style={{
          background: "linear-gradient(135deg, #111, #2A2A2A)",
          borderRadius: 16,
          margin: "12px 16px",
          padding: 20,
          color: "#fff",
        }}
      >
        <div style={{ fontSize: 12, opacity: 0.85, marginBottom: 4 }}>Temps reel</div>
        <div style={{ fontSize: 28, fontWeight: 700, marginBottom: 6 }}>
          {actualLiveRaces.length} en direct
        </div>
        <div style={{ fontSize: 14, opacity: 0.9 }}>
          {imminentRaces.length} departs imminents - {watchNowRaces.length} a suivre
        </div>
        <div style={{ marginTop: 10, fontSize: 12, color: "#B7B7B7" }}>
          Derniere mise a jour : {formatLastUpdated(lastUpdated)}
        </div>
        {featuredRace && (
          <div
            style={{
              marginTop: 14,
              background: "rgba(255,255,255,0.06)",
              borderRadius: 14,
              padding: 14,
            }}
          >
            <div style={{ fontSize: 11, letterSpacing: 1, textTransform: "uppercase", color: "#9FE3B9" }}>
              Course chaude
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, marginTop: 6 }}>
              R{featuredRace.reunion}C{featuredRace.course} - {featuredRace.nomCourse}
            </div>
            <div style={{ fontSize: 13, color: "#D0D0D0", marginTop: 6 }}>
              {featuredRace.hippodrome} - depart {featuredRace.heureDepart}
            </div>
            {featuredAnalysis?.analysis?.favori && (
              <div style={{ fontSize: 13, marginTop: 10, color: "#fff" }}>
                Favori IA : N{featuredAnalysis.analysis.favori.numPmu} {featuredAnalysis.analysis.favori.nom}
              </div>
            )}
            {featuredAnalysis?.analysis?.recommandation?.decision && (
              <div style={{ fontSize: 12, marginTop: 6, color: featuredAnalysis.analysis.recommandation.vautLeCoup ? "#9FE3B9" : "#FFD28A" }}>
                {featuredAnalysis.analysis.recommandation.decision}
              </div>
            )}
          </div>
        )}
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 60, color: "#888" }}>Chargement du direct...</div>
      ) : error ? (
        <div style={{ textAlign: "center", padding: 60, color: "#E74C3C" }}>
          Impossible de charger le live
        </div>
      ) : (
        <>
          <SectionTitle
            title="En direct"
            subtitle="Courses parties ou sur le point de partir"
          />
          {liveRaces.length > 0 ? (
            liveRaces.map((race) => renderRaceCard(race, LIVE_RED))
          ) : (
            <div style={{ margin: "0 16px", background: "#fff", borderRadius: 16, padding: 20, color: "#888" }}>
              Aucune course chaude pour le moment.
            </div>
          )}

          <SectionTitle
            title="A suivre"
            subtitle="Pronostics disponibles dans les 30 prochaines minutes"
          />
          {watchNowRaces.length > 0 ? (
            watchNowRaces.map((race) => renderRaceCard(race, GREEN))
          ) : (
            <div style={{ margin: "0 16px", background: "#fff", borderRadius: 16, padding: 20, color: "#888" }}>
              Rien a jouer tout de suite. Reviens dans quelques minutes.
            </div>
          )}

          <SectionTitle
            title="Tout juste termine"
            subtitle="Courses finies recemment, ouvre-les pour voir le detail"
          />
          {recentResults.length > 0 ? (
            recentResults.map((race) => renderRaceCard(race, RECENT_GREY))
          ) : (
            <div style={{ margin: "0 16px", background: "#fff", borderRadius: 16, padding: 20, color: "#888" }}>
              Pas encore de resultat recent.
            </div>
          )}
        </>
      )}

      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: "50%",
          transform: "translateX(-50%)",
          width: "100%",
          maxWidth: 430,
          height: 64,
          background: "#fff",
          borderTop: "1px solid #eee",
          display: "flex",
          justifyContent: "space-around",
          alignItems: "center",
          zIndex: 200,
        }}
      >
        <div
          onClick={() => router.push("/")}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            cursor: "pointer",
            gap: 2,
          }}
        >
          <span style={{ fontSize: 22 }}>🏇</span>
          <span style={{ fontSize: 11, color: "#888", fontWeight: 500 }}>Courses</span>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            cursor: "default",
            gap: 2,
            position: "relative",
          }}
        >
          <span style={{ fontSize: 22 }}>⚡</span>
          <span style={{ fontSize: 11, color: GREEN, fontWeight: 700 }}>Live</span>
          <div
            style={{
              width: 5,
              height: 5,
              borderRadius: "50%",
              background: GREEN,
              position: "absolute",
              bottom: -4,
            }}
          />
        </div>

        <div
          onClick={() => router.push("/bilan")}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            cursor: "pointer",
            gap: 2,
          }}
        >
          <span style={{ fontSize: 22 }}>📊</span>
          <span style={{ fontSize: 11, color: "#888", fontWeight: 500 }}>Bilan</span>
        </div>
      </div>
    </div>
  );
}
