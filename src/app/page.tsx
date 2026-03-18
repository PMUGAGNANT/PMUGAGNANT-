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
type ScoreStage = "preview_2h" | "preview_1h" | "final_30m" | "finished";
type SortMode = "time" | "confidence" | "hot" | "allocation";
type SimpleDisplayProfile = "base" | "value" | "outsider";

interface RaceScoreMeta {
  score: number;
  stage: ScoreStage;
  simpleReturn1Euro?: number | null;
  simpleHorse?: {
    numPmu: number;
    nom: string;
  } | null;
  finishedInfo?: {
    arrivalTop3: number[];
    simpleOutcome: "GAGNANT" | "PLACE" | "PERDU";
    recommendedArrival: number | null;
  } | null;
}

interface ScoreHistoryEntry {
  preview2h?: number;
  preview1h?: number;
  final30m?: number;
}

const SCORE_HISTORY_STORAGE_KEY = "pmu_score_history_v2";
const SORT_MODE_STORAGE_KEY = "pmu_sort_mode_v1";
const DATE_STORAGE_KEY = "pmu_selected_date_v1";

function getParisNow(): Date {
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: "Europe/Paris" })
  );
}

function parseDateStr(dateStr: string): Date {
  const day = Number(dateStr.slice(0, 2));
  const month = Number(dateStr.slice(2, 4)) - 1;
  const year = Number(dateStr.slice(4, 8));
  return new Date(year, month, day);
}

function formatDateStrToInput(dateStr: string): string {
  return `${dateStr.slice(4, 8)}-${dateStr.slice(2, 4)}-${dateStr.slice(0, 2)}`;
}

function formatInputToDateStr(value: string): string {
  const [year, month, day] = value.split("-");
  return `${day}${month}${year}`;
}

function shiftDateStr(dateStr: string, days: number): string {
  const date = parseDateStr(dateStr);
  date.setDate(date.getDate() + days);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = String(date.getFullYear());
  return `${day}${month}${year}`;
}

function getTodayDateStrClient(): string {
  const now = getParisNow();
  const day = String(now.getDate()).padStart(2, "0");
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const year = String(now.getFullYear());
  return `${day}${month}${year}`;
}

function getMinutesUntilStart(dateStr: string, heureDepart: string): number {
  const [hours, minutes] = heureDepart.split(":").map(Number);
  const parisNow = getParisNow();
  const parisTarget = parseDateStr(dateStr);
  parisTarget.setHours(hours, minutes, 0, 0);
  const diffMs = parisTarget.getTime() - parisNow.getTime();
  return diffMs / 60000;
}

function getRaceStatus(dateStr: string, heureDepart: string): RaceStatus {
  const min = getMinutesUntilStart(dateStr, heureDepart);
  if (min < -10) return "finished";
  if (min <= 30) return "prono_available";
  return "upcoming";
}

function getSecondsUntilStart(dateStr: string, heureDepart: string): number {
  const [hours, minutes] = heureDepart.split(":").map(Number);
  const parisNow = getParisNow();
  const parisTarget = parseDateStr(dateStr);
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

function getStageLabel(stage: ScoreStage): string {
  if (stage === "preview_2h") return "Note 2h";
  if (stage === "preview_1h") return "Note 1h";
  if (stage === "final_30m") return "Note 30 min";
  return "Resultat";
}

function getStageBadgeStyle(stage: ScoreStage) {
  if (stage === "preview_2h") {
    return { background: "#F3E8FF", color: "#7B1FA2" };
  }
  if (stage === "preview_1h") {
    return { background: "#E3F2FD", color: "#1565C0" };
  }
  if (stage === "final_30m") {
    return { background: "#E8F5E9", color: "#00843D" };
  }
  return { background: "#F5F5F5", color: "#666" };
}

function getEvolutionStyle(delta: number) {
  if (delta > 0) {
    return { background: "#E8F5E9", color: "#00843D" };
  }
  if (delta < 0) {
    return { background: "#FDECEA", color: "#E74C3C" };
  }
  return { background: "#F5F5F5", color: "#666" };
}

function formatSignedDelta(delta: number): string {
  return `${delta > 0 ? "+" : ""}${delta.toFixed(1)}`;
}

function formatEuroReturn(amount: number): string {
  return `${amount.toFixed(1).replace(".", ",")}EUR`;
}

function getSimpleDisplayProfile(
  score?: number,
  simpleReturn1Euro?: number | null
): SimpleDisplayProfile | null {
  if (score === undefined || simpleReturn1Euro === undefined || simpleReturn1Euro === null) {
    return null;
  }

  if (simpleReturn1Euro >= 25 || score < 4.8) {
    return "outsider";
  }

  if (simpleReturn1Euro >= 12 || score < 6.2) {
    return "value";
  }

  return "base";
}

function getSimpleDisplayMeta(profile: SimpleDisplayProfile) {
  if (profile === "base") {
    return {
      label: "Base solide",
      tagBackground: "#E8F5E9",
      tagColor: "#0F7A3C",
      panelBackground:
        "linear-gradient(180deg, rgba(0,132,61,0.07) 0%, rgba(232,245,233,0.96) 100%)",
      panelBorder: "1px solid rgba(0,132,61,0.12)",
      title: "Base simple gagnant",
      amountPrefix: "Si ca gagne",
      note: "Lecture marche coherente avec le profil du cheval.",
      noteColor: "#1F5131",
    };
  }

  if (profile === "value") {
    return {
      label: "Value jouable",
      tagBackground: "#EEF8FF",
      tagColor: "#0F5EA8",
      panelBackground:
        "linear-gradient(180deg, rgba(15,94,168,0.06) 0%, rgba(238,248,255,0.95) 100%)",
      panelBorder: "1px solid rgba(15,94,168,0.10)",
      title: "Value simple gagnant",
      amountPrefix: "Si ca gagne",
      note: "Rapport interessant, mais ticket plus nerveux qu'une base.",
      noteColor: "#0F5EA8",
    };
  }

  return {
    label: "Outsider",
    tagBackground: "#FFF3CD",
    tagColor: "#A66B00",
    panelBackground:
      "linear-gradient(180deg, rgba(212,160,23,0.08) 0%, rgba(255,248,225,0.96) 100%)",
    panelBorder: "1px solid rgba(212,160,23,0.18)",
    title: "Outsider speculatif",
    amountPrefix: "Rapport possible",
    note: "Rapport tres eleve: a lire comme un coup speculatif, pas comme une base normale.",
    noteColor: "#8A5A00",
  };
}

function getOutcomeStyle(outcome: "GAGNANT" | "PLACE" | "PERDU") {
  if (outcome === "GAGNANT") {
    return {
      background: "#E8F5E9",
      color: "#0F7A3C",
      border: "1px solid rgba(15,122,60,0.14)",
    };
  }

  if (outcome === "PLACE") {
    return {
      background: "#FFF8E1",
      color: "#A66B00",
      border: "1px solid rgba(212,160,23,0.20)",
    };
  }

  return {
    background: "#FDECEA",
    color: "#C0392B",
    border: "1px solid rgba(231,76,60,0.16)",
  };
}

function getTimelineNodeColors(value?: number, active?: boolean) {
  if (!active || value === undefined) {
    return {
      background: "#F1F1F1",
      border: "#DDDDDD",
      text: "#AAAAAA",
      label: "#999999",
    };
  }

  if (value >= 7.5) {
    return {
      background: "#E8F5E9",
      border: "#00843D",
      text: "#00843D",
      label: "#2E7D32",
    };
  }

  if (value >= 5.5) {
    return {
      background: "#FFF8E1",
      border: "#D4A017",
      text: "#A66B00",
      label: "#A66B00",
    };
  }

  return {
    background: "#FDECEA",
    border: "#E74C3C",
    text: "#C0392B",
    label: "#C0392B",
  };
}

function getTrendSentence(
  note2h?: number,
  note1h?: number,
  note30m?: number
): string {
  if (note2h !== undefined && note30m !== undefined) {
    const delta = note30m - note2h;
    if (delta >= 1) return `La course se renforce (${formatSignedDelta(delta)} depuis 2h)`;
    if (delta <= -1) return `La course se degrade (${formatSignedDelta(delta)} depuis 2h)`;
    return "La confiance reste stable entre 2h et 30 min";
  }

  if (note1h !== undefined && note30m !== undefined) {
    const delta = note30m - note1h;
    if (delta >= 1) return `La lecture devient meilleure (${formatSignedDelta(delta)} sur la derniere heure)`;
    if (delta <= -1) return `La course devient plus piegeuse (${formatSignedDelta(delta)} sur la derniere heure)`;
    return "Peu de variation sur la derniere heure";
  }

  if (note2h !== undefined || note1h !== undefined || note30m !== undefined) {
    return "La frise se complete au fil de l'approche du depart";
  }

  return "";
}

function getFrenchDate(dateStr?: string): string {
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
  const now = dateStr ? parseDateStr(dateStr) : getParisNow();
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
  const [scores, setScores] = useState<Record<string, RaceScoreMeta>>({});
  const [scoreHistory, setScoreHistory] = useState<
    Record<string, ScoreHistoryEntry>
  >({});
  const [scoresLoading, setScoresLoading] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>("time");
  const [selectedDate, setSelectedDate] = useState<string>(getTodayDateStrClient());

  // Load saved filter from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("pmu_min_confiance");
      if (saved) setMinConfiance(Number(saved));
      const savedHistory = localStorage.getItem(SCORE_HISTORY_STORAGE_KEY);
      if (savedHistory) {
        setScoreHistory(JSON.parse(savedHistory));
      }
      const savedSortMode = localStorage.getItem(
        SORT_MODE_STORAGE_KEY
      ) as SortMode | null;
      if (savedSortMode) {
        setSortMode(savedSortMode);
      }
      const savedDate = localStorage.getItem(DATE_STORAGE_KEY);
      if (savedDate && /^\d{8}$/.test(savedDate)) {
        setSelectedDate(savedDate);
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
      const res = await fetch(`/api/races?date=${selectedDate}`);
      const data = await res.json();
      if (data.success && data.races) {
        setRaces(data.races);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  // Fetch confidence scores (once)
  const fetchScores = useCallback(async () => {
    setScoresLoading(true);
    try {
      const res = await fetch(`/api/races/scores?date=${selectedDate}`);
      const data = await res.json();
      if (data.success && data.scores) {
        setScores(data.scores);
      }
    } catch { /* silent */ }
    setScoresLoading(false);
  }, [selectedDate]);

  // Initial fetch + 60s interval
  useEffect(() => {
    fetchRaces();
    fetchScores();
    const interval = setInterval(() => {
      fetchRaces();
      fetchScores();
    }, 60000);
    return () => clearInterval(interval);
  }, [fetchRaces, fetchScores]);

  // Keep local snapshots of the 2h / 1h / 30min notes for comparison on the cards.
  useEffect(() => {
    if (races.length === 0 || Object.keys(scores).length === 0) return;

    let changed = false;
    const nextHistory = { ...scoreHistory };

    for (const race of races) {
      const scoreKey = `${race.reunion}-${race.course}`;
      const meta = scores[scoreKey];
      if (!meta) continue;

      const historyKey = `${race.dateStr}-${scoreKey}`;
      const entry = nextHistory[historyKey] ?? {};

      if (meta.stage === "preview_2h" && entry.preview2h === undefined) {
        nextHistory[historyKey] = { ...entry, preview2h: meta.score };
        changed = true;
        continue;
      }

      if (meta.stage === "preview_1h" && entry.preview1h === undefined) {
        nextHistory[historyKey] = { ...entry, preview1h: meta.score };
        changed = true;
        continue;
      }

      if (
        (meta.stage === "final_30m" || meta.stage === "finished") &&
        entry.final30m === undefined
      ) {
        nextHistory[historyKey] = { ...entry, final30m: meta.score };
        changed = true;
      }
    }

    if (changed) {
      setScoreHistory(nextHistory);
      try {
        localStorage.setItem(
          SCORE_HISTORY_STORAGE_KEY,
          JSON.stringify(nextHistory)
        );
      } catch {
        // silent
      }
    }
  }, [races, scores, scoreHistory]);

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

  const handleSortModeChange = (mode: SortMode) => {
    setSortMode(mode);
    try {
      localStorage.setItem(SORT_MODE_STORAGE_KEY, mode);
    } catch {
      // silent
    }
  };

  const handleDateChange = (nextDate: string) => {
    setSelectedDate(nextDate);
    setLoading(true);
    try {
      localStorage.setItem(DATE_STORAGE_KEY, nextDate);
    } catch {
      // silent
    }
  };

  // Sort races by departure time
  const baseSortedRaces = [...races].sort((a, b) => {
    const [ah, am] = a.heureDepart.split(":").map(Number);
    const [bh, bm] = b.heureDepart.split(":").map(Number);
    return ah * 60 + am - (bh * 60 + bm);
  });

  // Apply confidence filter
  const filteredBaseRaces = minConfiance > 0
    ? baseSortedRaces.filter((race) => {
        const key = `${race.reunion}-${race.course}`;
        const score = scores[key]?.score;
        // Keep upcoming races (no score yet) + races matching filter
        if (score === undefined) {
          const status = getRaceStatus(race.dateStr, race.heureDepart);
          return status === "upcoming"; // show upcoming, hide analyzed without score
        }
        return score >= minConfiance;
      })
    : baseSortedRaces;

  const filteredRaces = [...filteredBaseRaces].sort((a, b) => {
    const aKey = `${a.reunion}-${a.course}`;
    const bKey = `${b.reunion}-${b.course}`;
    const aScore = scores[aKey]?.score ?? -1;
    const bScore = scores[bKey]?.score ?? -1;
    const aMinutes = getMinutesUntilStart(a.dateStr, a.heureDepart);
    const bMinutes = getMinutesUntilStart(b.dateStr, b.heureDepart);

    if (sortMode === "confidence") {
      if (bScore !== aScore) return bScore - aScore;
      return aMinutes - bMinutes;
    }

    if (sortMode === "hot") {
      const aHot = aMinutes <= 60 && aMinutes >= -10 ? 1 : 0;
      const bHot = bMinutes <= 60 && bMinutes >= -10 ? 1 : 0;
      if (bHot !== aHot) return bHot - aHot;
      if (aMinutes !== bMinutes) return aMinutes - bMinutes;
      return bScore - aScore;
    }

    if (sortMode === "allocation") {
      if (b.allocation !== a.allocation) return b.allocation - a.allocation;
      return aMinutes - bMinutes;
    }

    return aMinutes - bMinutes;
  });

  const totalCourses = races.length;
  const reunionSet = new Set(races.map((r) => r.reunion));
  const totalReunions = reunionSet.size;
  const pronoCount = races.filter(
    (r) => getRaceStatus(r.dateStr, r.heureDepart) === "prono_available"
  ).length;
  const analysedCount = Object.keys(scores).length;
  const radarRace = [...filteredRaces]
    .filter((race) => scores[`${race.reunion}-${race.course}`]?.score !== undefined)
    .sort((a, b) => {
      const aKey = `${a.reunion}-${a.course}`;
      const bKey = `${b.reunion}-${b.course}`;
      const aScore = scores[aKey]?.score ?? 0;
      const bScore = scores[bKey]?.score ?? 0;
      if (bScore !== aScore) return bScore - aScore;
      return getMinutesUntilStart(a.dateStr, a.heureDepart) - getMinutesUntilStart(b.dateStr, b.heureDepart);
    })[0];
  const spotlightRace = radarRace ?? filteredRaces[0] ?? null;

  const handleCardClick = (race: RaceSummary) => {
    const status = getRaceStatus(race.dateStr, race.heureDepart);
    if (status === "prono_available" || status === "finished") {
      router.push(`/course/${race.reunion}/${race.course}?date=${race.dateStr}`);
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
        background:
          "linear-gradient(180deg, rgba(255,255,255,0.78) 0%, rgba(247,249,250,0.95) 100%)",
        position: "relative",
      }}
    >
      {/* HEADER */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          background: "rgba(16, 18, 22, 0.88)",
          backdropFilter: "blur(18px)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          height: 64,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            color: "#22c55e",
            fontWeight: 800,
            fontSize: 24,
            lineHeight: "24px",
            letterSpacing: "-0.6px",
            textShadow: "0 6px 18px rgba(34,197,94,0.24)",
          }}
        >
          PMU AI
        </div>
        <div
          style={{
            color: "rgba(255,255,255,0.6)",
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            lineHeight: "14px",
            marginTop: 3,
          }}
        >
          Pronostics IA
        </div>
      </div>

      {/* GREEN BANNER */}
      <div
        style={{
          background:
            "radial-gradient(circle at top right, rgba(255,255,255,0.18), transparent 32%), linear-gradient(135deg, #0a8f4d 0%, #066737 100%)",
          borderRadius: 28,
          margin: "14px 16px 12px",
          padding: 22,
          color: "#fff",
          boxShadow: "0 24px 48px rgba(0, 132, 61, 0.24)",
          border: "1px solid rgba(255,255,255,0.12)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            width: 180,
            height: 180,
            right: -70,
            top: -90,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.08)",
          }}
        />
        <div style={{ fontSize: 12, opacity: 0.85, marginBottom: 4 }}>
          {selectedDate === getTodayDateStrClient() ? "Aujourd&apos;hui" : "Jour analyse"}
        </div>
        <div
          style={{
            fontSize: 19,
            fontWeight: 700,
            marginBottom: 10,
            lineHeight: "23px",
            letterSpacing: "-0.2px",
          }}
        >
          {getFrenchDate(selectedDate)}
        </div>
        <div
          style={{
            fontSize: 30,
            fontWeight: 800,
            marginBottom: 6,
            lineHeight: "32px",
            letterSpacing: "-1px",
          }}
        >
          {loading
            ? "Chargement..."
            : `${totalCourses} courses \u00B7 ${totalReunions} r\u00E9unions`}
        </div>
        <div style={{ fontSize: 14, opacity: 0.92, fontWeight: 600 }}>
          {loading ? "" : `${pronoCount} pronostics disponibles`}
        </div>
        {!loading && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 18 }}>
            <span
              style={{
                background: "rgba(255,255,255,0.14)",
                border: "1px solid rgba(255,255,255,0.14)",
                padding: "10px 12px",
                borderRadius: 18,
                fontSize: 12,
                fontWeight: 700,
                display: "flex",
                flexDirection: "column",
                gap: 2,
              }}
            >
              <span style={{ opacity: 0.72, fontSize: 11, fontWeight: 600 }}>Radar actif</span>
              <span>{analysedCount} courses notees</span>
            </span>
            <span
              style={{
                background: "rgba(255,255,255,0.14)",
                border: "1px solid rgba(255,255,255,0.14)",
                padding: "10px 12px",
                borderRadius: 18,
                fontSize: 12,
                fontWeight: 700,
                display: "flex",
                flexDirection: "column",
                gap: 2,
              }}
            >
              <span style={{ opacity: 0.72, fontSize: 11, fontWeight: 600 }}>Tri moteur</span>
              <span>{sortMode === "time" ? "Par heure" : sortMode === "confidence" ? "Note forte" : sortMode === "hot" ? "A suivre vite" : "Gros enjeux"}</span>
            </span>
          </div>
        )}
      </div>

      <div
        style={{
          margin: "0 16px 14px",
          padding: 14,
          borderRadius: 20,
          background: "rgba(255,255,255,0.92)",
          border: "1px solid rgba(15,23,42,0.06)",
          boxShadow: "0 12px 26px rgba(15,23,42,0.06)",
          display: "flex",
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <button
          onClick={() => handleDateChange(shiftDateStr(selectedDate, -1))}
          style={{
            width: 40,
            height: 40,
            borderRadius: 14,
            border: "1px solid rgba(15,23,42,0.08)",
            background: "#FFFFFF",
            fontSize: 18,
            fontWeight: 800,
            color: "#334155",
            cursor: "pointer",
          }}
        >
          ←
        </button>
        <div style={{ flex: 1, minWidth: 180 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.22px", marginBottom: 4 }}>
            Calendrier algo
          </div>
          <input
            type="date"
            value={formatDateStrToInput(selectedDate)}
            onChange={(event) => handleDateChange(formatInputToDateStr(event.target.value))}
            style={{
              width: "100%",
              border: "1px solid rgba(15,23,42,0.08)",
              borderRadius: 12,
              padding: "10px 12px",
              fontSize: 14,
              fontWeight: 700,
              color: "#111827",
              background: "#FFFFFF",
            }}
          />
        </div>
        <button
          onClick={() => handleDateChange(shiftDateStr(selectedDate, 1))}
          style={{
            width: 40,
            height: 40,
            borderRadius: 14,
            border: "1px solid rgba(15,23,42,0.08)",
            background: "#FFFFFF",
            fontSize: 18,
            fontWeight: 800,
            color: "#334155",
            cursor: "pointer",
          }}
        >
          →
        </button>
      </div>

      <div style={{ margin: "0 16px 16px" }}>
        <button
          onClick={() => router.push("/apprentissage")}
          style={{
            width: "100%",
            border: "none",
            cursor: "pointer",
            borderRadius: 22,
            padding: "16px 18px",
            background:
              "linear-gradient(135deg, rgba(15,23,42,0.96) 0%, rgba(19,78,74,0.96) 100%)",
            color: "#FFFFFF",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            boxShadow: "0 18px 34px rgba(15,23,42,0.16)",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 4 }}>
            <span style={{ fontSize: 11, opacity: 0.75, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Apprentissage IA
            </span>
            <span style={{ fontSize: 16, fontWeight: 800, lineHeight: "20px", textAlign: "left" }}>
              Voir comment le modele apprend et devient plus fort
            </span>
          </div>
          <span
            style={{
              fontSize: 12,
              fontWeight: 800,
              background: "rgba(255,255,255,0.12)",
              padding: "8px 12px",
              borderRadius: 999,
              whiteSpace: "nowrap",
            }}
          >
            Ouvrir IA
          </span>
        </button>
      </div>

      {spotlightRace && (
        <div
          style={{
            margin: "0 16px 14px",
            padding: 18,
            borderRadius: 24,
            background:
              "radial-gradient(circle at top right, rgba(34,197,94,0.12), transparent 28%), linear-gradient(135deg, #12181b, #1b2329)",
            border: "1px solid rgba(255,255,255,0.08)",
            boxShadow: "0 24px 46px rgba(15,23,42,0.16)",
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 800,
              color: "#7ee7a8",
              marginBottom: 10,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
            }}
          >
            Radar du jour
          </div>
          <div
            style={{
              fontSize: 24,
              fontWeight: 800,
              color: "#FFFFFF",
              lineHeight: "28px",
              marginBottom: 8,
              letterSpacing: "-0.6px",
            }}
          >
            R{spotlightRace.reunion}C{spotlightRace.course} - {spotlightRace.nomCourse}
          </div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", lineHeight: "18px", marginBottom: 14 }}>
            {spotlightRace.hippodrome} · {spotlightRace.heureDepart} · {spotlightRace.nombrePartants} partants · {spotlightRace.distance}m
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
            <span
              style={{
                background: scores[`${spotlightRace.reunion}-${spotlightRace.course}`]?.score !== undefined ? "#E8F5E9" : "#F4F5F7",
                color: scores[`${spotlightRace.reunion}-${spotlightRace.course}`]?.score !== undefined ? "#00843D" : "#555",
                padding: "6px 10px",
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 800,
              }}
            >
              {scores[`${spotlightRace.reunion}-${spotlightRace.course}`]?.score !== undefined
                ? `Confiance ${scores[`${spotlightRace.reunion}-${spotlightRace.course}`]?.score}/10`
                : "Note en attente"}
            </span>
            <span
              style={{
                background: "rgba(255,255,255,0.08)",
                color: "#FFFFFF",
                padding: "7px 11px",
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              {scores[`${spotlightRace.reunion}-${spotlightRace.course}`]?.stage
                ? getStageLabel(scores[`${spotlightRace.reunion}-${spotlightRace.course}`]?.stage ?? "preview_2h")
                : "Prochaine course"}
            </span>
          </div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.72)", lineHeight: "17px" }}>
            {scores[`${spotlightRace.reunion}-${spotlightRace.course}`]?.score !== undefined
              ? "Course a fort potentiel, a surveiller de pres."
              : "Course encore en observation, la note se debloquera en approchant du depart."}
          </div>
        </div>
      )}

      {/* FILTER BAR */}
      <div
        style={{
          margin: "0 16px 10px",
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <button
          onClick={() => setShowFilter(!showFilter)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "10px 16px",
            borderRadius: 999,
            border: minConfiance > 0 ? "2px solid #00843D" : "1px solid rgba(15,23,42,0.08)",
            background: minConfiance > 0 ? "#E8F5E9" : "rgba(255,255,255,0.86)",
            color: minConfiance > 0 ? "#00843D" : "#334155",
            fontSize: 13,
            fontWeight: 700,
            cursor: "pointer",
            boxShadow: "0 10px 22px rgba(15,23,42,0.06)",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="4" y1="6" x2="20" y2="6" />
            <line x1="8" y1="12" x2="16" y2="12" />
            <line x1="11" y1="18" x2="13" y2="18" />
          </svg>
          {minConfiance > 0 ? `Confiance >= ${minConfiance}/10` : "Filtrer"}
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
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Reset
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
          overflowX: "auto",
          paddingBottom: 4,
        }}
      >
        {[
          { key: "time" as SortMode, label: "Par heure" },
          { key: "confidence" as SortMode, label: "Meilleure note" },
          { key: "hot" as SortMode, label: "A suivre vite" },
          { key: "allocation" as SortMode, label: "Gros enjeux" },
        ].map((option) => (
          <button
            key={option.key}
            onClick={() => handleSortModeChange(option.key)}
            style={{
              border: sortMode === option.key ? "2px solid #00843D" : "1px solid #DDDDDD",
              background: sortMode === option.key ? "linear-gradient(135deg, #0e1b14, #12251a)" : "rgba(255,255,255,0.9)",
              color: sortMode === option.key ? "#FFFFFF" : "#334155",
              padding: "10px 14px",
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 800,
              whiteSpace: "nowrap",
              cursor: "pointer",
              boxShadow: sortMode === option.key ? "0 12px 28px rgba(16,24,22,0.18)" : "0 8px 18px rgba(15,23,42,0.05)",
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
                {val === 0 ? "Tout" : `>= ${val}/10`}
              </button>
            ))}
          </div>
          <div style={{ fontSize: 12, color: "#888", marginTop: 10 }}>
            Ce filtre est sauvegarde automatiquement
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
            <div style={{ padding: "0 16px", marginBottom: 10 }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: "#111827", marginBottom: 4, letterSpacing: "-0.6px" }}>
                Courses a surveiller
              </div>
              <div style={{ fontSize: 13, color: "#64748B", lineHeight: "19px" }}>
                Tri intelligent par heure, confiance, urgence ou allocation.
              </div>
            </div>
            {filteredRaces.map((race) => {
              const status = getRaceStatus(race.dateStr, race.heureDepart);
              const secondsUntil = getSecondsUntilStart(race.dateStr, race.heureDepart);
              const isProno = status === "prono_available";
              const isFinished = status === "finished";
              const isUpcoming = status === "upcoming";
              const isClickable = isProno || isFinished;
              const raceKey = `${race.reunion}-${race.course}`;
              const scoreMeta = scores[raceKey];
              const confScore = scoreMeta?.score;
              const scoreStage = scoreMeta?.stage;
              const simpleReturn1Euro = scoreMeta?.simpleReturn1Euro;
              const simpleHorse = scoreMeta?.simpleHorse;
              const finishedInfo = scoreMeta?.finishedInfo;
              const simpleProfile = getSimpleDisplayProfile(
                confScore,
                simpleReturn1Euro
              );
              const simpleDisplayMeta = simpleProfile
                ? getSimpleDisplayMeta(simpleProfile)
                : null;
              const historyKey = `${race.dateStr}-${raceKey}`;
              const historyEntry = scoreHistory[historyKey];
              const note2h =
                scoreStage === "preview_2h"
                  ? confScore
                  : historyEntry?.preview2h;
              const note1h =
                scoreStage === "preview_1h"
                  ? confScore
                  : historyEntry?.preview1h;
              const note30m =
                scoreStage === "final_30m" || scoreStage === "finished"
                  ? confScore
                  : historyEntry?.final30m;
              const evolutionFrom2h =
                note2h !== undefined &&
                confScore !== undefined &&
                scoreStage !== "preview_2h"
                  ? Number((confScore - note2h).toFixed(1))
                  : null;
              const evolution1hTo30m =
                note1h !== undefined && note30m !== undefined
                  ? Number((note30m - note1h).toFixed(1))
                  : null;
              const trendSentence = getTrendSentence(note2h, note1h, note30m);
              const stageBadgeStyle = scoreStage
                ? getStageBadgeStyle(scoreStage)
                : null;
              const showTicketInsight =
                confScore !== undefined &&
                simpleReturn1Euro !== undefined &&
                simpleReturn1Euro !== null &&
                Boolean(simpleHorse && simpleDisplayMeta);
              const showTimelineInsight =
                !isFinished &&
                (note2h !== undefined ||
                  note1h !== undefined ||
                  note30m !== undefined);
              const insightCardStyle: React.CSSProperties = {
                marginTop: 10,
                padding: 15,
                borderRadius: 20,
                background:
                  "linear-gradient(180deg, rgba(255,255,255,0.97) 0%, rgba(248,250,251,0.99) 100%)",
                border: "1px solid rgba(15,23,42,0.08)",
                boxShadow:
                  "0 10px 22px rgba(15,23,42,0.05), inset 0 1px 0 rgba(255,255,255,0.78)",
              };
              const insightInsetStyle: React.CSSProperties = {
                padding: "11px 12px",
                borderRadius: 14,
                background: "rgba(15,23,42,0.04)",
                border: "1px solid rgba(15,23,42,0.04)",
              };
              const ticketSummaryTitle =
                simpleProfile === "outsider"
                  ? "Coup speculatif"
                  : simpleProfile === "value"
                    ? "Ticket offensif"
                    : "Ticket principal";
              const outcomeSentence =
                finishedInfo?.simpleOutcome === "GAGNANT"
                  ? "Le ticket simple est rentre."
                  : finishedInfo?.simpleOutcome === "PLACE"
                    ? "Le cheval a pris une place, sans gagner."
                    : "Le ticket simple est passe a cote.";
              const arrivalSummary =
                finishedInfo && simpleHorse
                  ? finishedInfo.recommendedArrival !== null
                    ? `N${simpleHorse.numPmu} ${simpleHorse.nom} - arrivee ${finishedInfo.recommendedArrival}e`
                    : `N${simpleHorse.numPmu} ${simpleHorse.nom} - arrivee inconnue`
                  : null;
              const timelineSteps = [
                { label: "2h", value: note2h, active: note2h !== undefined },
                { label: "1h", value: note1h, active: note1h !== undefined },
                { label: "30m", value: note30m, active: note30m !== undefined },
              ];
              const finishedReadTitle =
                finishedInfo?.simpleOutcome === "GAGNANT"
                  ? "Ticket valide"
                  : finishedInfo?.simpleOutcome === "PLACE"
                    ? "Ticket place"
                    : "Ticket manque";
              const finishedReadTone =
                finishedInfo?.simpleOutcome === "GAGNANT"
                  ? { background: "#E8F5E9", color: "#0F7A3C" }
                  : finishedInfo?.simpleOutcome === "PLACE"
                    ? { background: "#FFF8E1", color: "#A66B00" }
                    : { background: "#FDECEA", color: "#C0392B" };
              const timelineSummary = [
                evolutionFrom2h !== null
                  ? `Depuis 2h ${formatSignedDelta(evolutionFrom2h)}`
                  : null,
                evolution1hTo30m !== null
                  ? `1h -> 30m ${formatSignedDelta(evolution1hTo30m)}`
                  : null,
              ].filter(Boolean) as string[];

              return (
                <div
                      key={`${race.reunion}-${race.course}`}
                      onClick={() => handleCardClick(race)}
                      style={{
                        background:
                          "linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(248,250,251,0.98) 100%)",
                        borderRadius: 24,
                        margin: "8px 16px",
                        padding: 18,
                        boxShadow: isProno
                          ? "0 20px 40px rgba(0,132,61,0.12)"
                          : "0 16px 34px rgba(15,23,42,0.08)",
                        border: "1px solid rgba(15,23,42,0.06)",
                        borderLeft: `5px solid ${isProno ? "#00843D" : isFinished ? "#94A3B8" : "#D8DEE6"}`,
                        cursor: isClickable ? "pointer" : "default",
                        transition: "transform 0.15s ease, box-shadow 0.15s ease",
                        position: "relative",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        gap: 12,
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          position: "absolute",
                          inset: 0,
                          background: isProno
                            ? "radial-gradient(circle at top right, rgba(0,132,61,0.12), transparent 30%)"
                            : isFinished
                              ? "radial-gradient(circle at top right, rgba(148,163,184,0.12), transparent 28%)"
                              : "radial-gradient(circle at top right, rgba(15,23,42,0.05), transparent 28%)",
                          pointerEvents: "none",
                        }}
                      />
                      {/* Left content */}
                      <div style={{ flex: 1, minWidth: 0, position: "relative", zIndex: 1 }}>
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
                              fontSize: 28,
                              fontWeight: 800,
                              color: isProno ? "#00843D" : "#333",
                              lineHeight: "28px",
                              letterSpacing: "-0.8px",
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
                            fontSize: 19,
                            fontWeight: 800,
                            color: "#1A1A1A",
                            lineHeight: "24px",
                            marginBottom: 7,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            letterSpacing: "-0.4px",
                          }}
                        >
                          R{race.reunion}C{race.course} — {race.nomCourse}
                        </div>

                        {/* Bottom info */}
                        <div
                          style={{
                            fontSize: 13,
                            color: "#64748B",
                            lineHeight: "19px",
                          }}
                        >
                          {race.hippodrome} &middot; {race.nombrePartants} partants &middot;{" "}
                          {race.distance}m
                        </div>
                        {confScore !== undefined && (
                          <div
                            style={{
                              marginTop: 8,
                              display: "flex",
                              flexWrap: "wrap",
                              gap: 6,
                              alignItems: "center",
                            }}
                          >
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
                            {scoreStage && stageBadgeStyle && (
                              <span
                                style={{
                                  display: "inline-block",
                                  fontSize: 11,
                                  fontWeight: 700,
                                  padding: "2px 8px",
                                  borderRadius: 20,
                                  background: stageBadgeStyle.background,
                                  color: stageBadgeStyle.color,
                                }}
                              >
                                {getStageLabel(scoreStage)}
                              </span>
                            )}
                            {simpleProfile && simpleDisplayMeta && (
                              <span
                                style={{
                                  display: "inline-block",
                                  fontSize: 11,
                                  fontWeight: 800,
                                  padding: "2px 8px",
                                  borderRadius: 20,
                                  background: simpleDisplayMeta.tagBackground,
                                  color: simpleDisplayMeta.tagColor,
                                }}
                              >
                                {simpleDisplayMeta.label}
                              </span>
                            )}
                            {simpleReturn1Euro !== undefined &&
                              simpleReturn1Euro !== null &&
                              simpleProfile !== "outsider" && (
                                <span
                                  style={{
                                    display: "inline-block",
                                    fontSize: 11,
                                    fontWeight: 800,
                                    padding: "2px 8px",
                                    borderRadius: 20,
                                    background: "#EEF8FF",
                                    color: "#0F5EA8",
                                  }}
                                >
                                  1EUR -&gt; {formatEuroReturn(simpleReturn1Euro)}
                                </span>
                              )}
                            {scoreStage === "preview_1h" && (
                              <span
                                style={{
                                  display: "inline-block",
                                  fontSize: 11,
                                  fontWeight: 600,
                                  padding: "2px 8px",
                                  borderRadius: 20,
                                  background: "#FFF3CD",
                                  color: "#856404",
                                }}
                              >
                                Base 1h enregistree
                              </span>
                            )}
                            {scoreStage === "preview_2h" && (
                              <span
                                style={{
                                  display: "inline-block",
                                  fontSize: 11,
                                  fontWeight: 600,
                                  padding: "2px 8px",
                                  borderRadius: 20,
                                  background: "#F3E8FF",
                                  color: "#7B1FA2",
                                }}
                              >
                                Base 2h enregistree
                              </span>
                            )}
                          </div>
                        )}
                        {showTicketInsight && simpleHorse && simpleDisplayMeta && (
                            <div
                              style={{
                                ...insightCardStyle,
                                background: simpleDisplayMeta.panelBackground,
                                border: simpleDisplayMeta.panelBorder,
                              }}
                            >
                              <div
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "flex-start",
                                  gap: 12,
                                  flexWrap: "wrap",
                                }}
                              >
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: 8,
                                      flexWrap: "wrap",
                                      marginBottom: 8,
                                    }}
                                  >
                                    <span
                                      style={{
                                        padding: "5px 10px",
                                        borderRadius: 999,
                                        fontSize: 11,
                                        fontWeight: 800,
                                        background: "rgba(255,255,255,0.8)",
                                        color: simpleDisplayMeta.tagColor,
                                        border: "1px solid rgba(15,23,42,0.06)",
                                        textTransform: "uppercase",
                                        letterSpacing: "0.02em",
                                      }}
                                    >
                                      Ticket IA
                                    </span>
                                    <span
                                      style={{
                                        padding: "5px 10px",
                                        borderRadius: 999,
                                        fontSize: 11,
                                        fontWeight: 800,
                                        background: simpleDisplayMeta.tagBackground,
                                        color: simpleDisplayMeta.tagColor,
                                        border: "1px solid rgba(15,23,42,0.06)",
                                      }}
                                    >
                                      {simpleDisplayMeta.label}
                                    </span>
                                  </div>
                                  <div
                                    style={{
                                      fontSize: 18,
                                      fontWeight: 800,
                                      color: "#16324F",
                                      lineHeight: "23px",
                                      letterSpacing: "-0.28px",
                                    }}
                                  >
                                    N{simpleHorse.numPmu} {simpleHorse.nom}
                                  </div>
                                  <div
                                    style={{
                                      marginTop: 6,
                                      fontSize: 12,
                                      lineHeight: "18px",
                                      color: simpleDisplayMeta.noteColor,
                                      fontWeight: 700,
                                    }}
                                  >
                                    {simpleDisplayMeta.note}
                                  </div>
                                </div>

                                <div
                                  style={{
                                    minWidth: 110,
                                    textAlign: "right",
                                    alignSelf: "stretch",
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 4,
                                  }}
                                >
                                  <div
                                    style={{
                                      fontSize: 10,
                                      fontWeight: 700,
                                      color: "#64748B",
                                      textTransform: "uppercase",
                                      letterSpacing: "0.06em",
                                    }}
                                  >
                                    Retour 1EUR
                                  </div>
                                  <div
                                    style={{
                                      fontSize: 22,
                                      lineHeight: "24px",
                                      fontWeight: 800,
                                      color: simpleDisplayMeta.tagColor,
                                      letterSpacing: "-0.5px",
                                    }}
                                  >
                                    {formatEuroReturn(simpleReturn1Euro)}
                                  </div>
                                  <div
                                    style={{
                                      fontSize: 11,
                                      color: "#64748B",
                                      fontWeight: 700,
                                    }}
                                  >
                                    {ticketSummaryTitle}
                                  </div>
                                </div>
                              </div>

                              <div
                                style={{
                                  marginTop: 10,
                                  display: "grid",
                                  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                                  gap: 8,
                                }}
                              >
                                <div style={insightInsetStyle}>
                                  <div
                                    style={{
                                      fontSize: 10,
                                      fontWeight: 700,
                                      color: "#64748B",
                                      textTransform: "uppercase",
                                      letterSpacing: "0.06em",
                                      marginBottom: 5,
                                    }}
                                  >
                                    Lecture
                                  </div>
                                  <div
                                    style={{
                                      fontSize: 13,
                                      fontWeight: 800,
                                      color: simpleDisplayMeta.tagColor,
                                      lineHeight: "17px",
                                    }}
                                  >
                                    {simpleDisplayMeta.title}
                                  </div>
                                </div>

                                <div style={insightInsetStyle}>
                                  <div
                                    style={{
                                      fontSize: 10,
                                      fontWeight: 700,
                                      color: "#64748B",
                                      textTransform: "uppercase",
                                      letterSpacing: "0.06em",
                                      marginBottom: 5,
                                    }}
                                  >
                                    Projection
                                  </div>
                                  <div
                                    style={{
                                      fontSize: 13,
                                      fontWeight: 800,
                                      color: "#111827",
                                      lineHeight: "17px",
                                    }}
                                  >
                                    {simpleDisplayMeta.amountPrefix}: {formatEuroReturn(simpleReturn1Euro)}
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        {isFinished && finishedInfo && simpleHorse ? (
                          <div
                            style={{
                              ...insightCardStyle,
                              background:
                                "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(246,250,248,0.99) 100%)",
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                gap: 10,
                                marginBottom: 10,
                                flexWrap: "wrap",
                              }}
                            >
                              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                <div
                                  style={{
                                    fontSize: 11,
                                    fontWeight: 800,
                                    color: "#666",
                                    textTransform: "uppercase",
                                    letterSpacing: "0.3px",
                                  }}
                                >
                                  Arrivee officielle
                                </div>
                                <div
                                  style={{
                                    fontSize: 12,
                                    color: "#64748B",
                                    fontWeight: 700,
                                  }}
                                >
                                  Lecture finale du ticket simple
                                </div>
                              </div>
                              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                <span
                                  style={{
                                    padding: "5px 10px",
                                    borderRadius: 999,
                                    fontSize: 11,
                                    fontWeight: 800,
                                    ...finishedReadTone,
                                  }}
                                >
                                  {finishedReadTitle}
                                </span>
                                <span
                                  style={{
                                    padding: "5px 10px",
                                    borderRadius: 999,
                                    fontSize: 11,
                                    fontWeight: 800,
                                    ...getOutcomeStyle(finishedInfo.simpleOutcome),
                                  }}
                                >
                                  {finishedInfo.simpleOutcome}
                                </span>
                              </div>
                            </div>
                            <div
                              style={{
                                display: "flex",
                                flexWrap: "wrap",
                                gap: 6,
                                alignItems: "center",
                                marginBottom: 12,
                              }}
                            >
                              {finishedInfo.arrivalTop3.map((horseNumber, index) => (
                                <span
                                  key={`${raceKey}-arrival-${horseNumber}`}
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 5,
                                    padding: "6px 10px",
                                    borderRadius: 999,
                                    background: index === 0 ? "#EEF8FF" : "#F5F5F5",
                                    color: index === 0 ? "#0F5EA8" : "#555",
                                    fontSize: 12,
                                    fontWeight: 800,
                                  }}
                                >
                                  <span>{index + 1}e</span>
                                  <span>N{horseNumber}</span>
                                </span>
                              ))}
                            </div>
                            <div
                              style={{
                                display: "grid",
                                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                                gap: 8,
                              }}
                            >
                              <div style={insightInsetStyle}>
                                <div
                                  style={{
                                    fontSize: 10,
                                    fontWeight: 700,
                                    color: "#64748B",
                                    textTransform: "uppercase",
                                    letterSpacing: "0.06em",
                                    marginBottom: 5,
                                  }}
                                >
                                  Ticket IA
                                </div>
                                <div
                                  style={{
                                    fontSize: 13,
                                    fontWeight: 800,
                                    color: "#111827",
                                    lineHeight: "17px",
                                  }}
                                >
                                  N{simpleHorse.numPmu} {simpleHorse.nom}
                                </div>
                                {simpleReturn1Euro !== undefined &&
                                simpleReturn1Euro !== null ? (
                                  <div
                                    style={{
                                      marginTop: 6,
                                      fontSize: 12,
                                      color: "#0F5EA8",
                                      fontWeight: 700,
                                    }}
                                  >
                                    Projection 1EUR: {formatEuroReturn(simpleReturn1Euro)}
                                  </div>
                                ) : null}
                              </div>

                              <div style={insightInsetStyle}>
                                <div
                                  style={{
                                    fontSize: 10,
                                    fontWeight: 700,
                                    color: "#64748B",
                                    textTransform: "uppercase",
                                    letterSpacing: "0.06em",
                                    marginBottom: 5,
                                  }}
                                >
                                  Lecture finale
                                </div>
                                <div
                                  style={{
                                    fontSize: 13,
                                    fontWeight: 800,
                                    color: "#111827",
                                    lineHeight: "17px",
                                  }}
                                >
                                  {outcomeSentence}
                                </div>
                                {arrivalSummary ? (
                                  <div
                                    style={{
                                      marginTop: 6,
                                      fontSize: 12,
                                      color: "#64748B",
                                      fontWeight: 700,
                                      lineHeight: "17px",
                                    }}
                                  >
                                    {arrivalSummary}
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        ) : showTimelineInsight && (
                          <div
                            style={{
                              ...insightCardStyle,
                              background:
                                "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(249,251,255,0.99) 100%)",
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                gap: 10,
                                flexWrap: "wrap",
                                marginBottom: 10,
                              }}
                            >
                              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                <div
                                  style={{
                                    fontSize: 11,
                                    fontWeight: 800,
                                    color: "#666",
                                    textTransform: "uppercase",
                                    letterSpacing: "0.3px",
                                  }}
                                >
                                  Suivi confiance
                                </div>
                                <div
                                  style={{
                                    fontSize: 12,
                                    color: "#64748B",
                                    fontWeight: 700,
                                  }}
                                >
                                  Lecture du ticket avant depart
                                </div>
                              </div>
                              {scoreStage && stageBadgeStyle ? (
                                <span
                                  style={{
                                    padding: "5px 10px",
                                    borderRadius: 999,
                                    fontSize: 11,
                                    fontWeight: 800,
                                    background: stageBadgeStyle.background,
                                    color: stageBadgeStyle.color,
                                  }}
                                >
                                  {getStageLabel(scoreStage)}
                                </span>
                              ) : null}
                            </div>
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 6,
                              }}
                            >
                              {timelineSteps.map((step, index, arr) => {
                                const colors = getTimelineNodeColors(
                                  step.value,
                                  step.active
                                );

                                return (
                                  <div
                                    key={step.label}
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      flex: index === arr.length - 1 ? "0 1 auto" : 1,
                                      minWidth: 0,
                                    }}
                                  >
                                      <div
                                        style={{
                                          minWidth: 58,
                                          padding: "9px 6px",
                                          borderRadius: 12,
                                          border: `1px solid ${colors.border}`,
                                          background: colors.background,
                                          textAlign: "center",
                                        }}
                                    >
                                      <div
                                        style={{
                                          fontSize: 10,
                                          fontWeight: 700,
                                          color: colors.label,
                                          marginBottom: 2,
                                        }}
                                      >
                                        {step.label}
                                      </div>
                                      <div
                                        style={{
                                          fontSize: 13,
                                          fontWeight: 800,
                                          color: colors.text,
                                          lineHeight: "16px",
                                        }}
                                      >
                                        {step.value !== undefined
                                          ? `${step.value}/10`
                                          : "--"}
                                      </div>
                                    </div>
                                    {index < arr.length - 1 && (
                                      <div
                                        style={{
                                          flex: 1,
                                          height: 2,
                                          margin: "0 4px",
                                          borderRadius: 999,
                                          background:
                                            arr[index + 1].active && step.active
                                              ? "#CFCFCF"
                                              : "#E8E8E8",
                                          position: "relative",
                                        }}
                                      >
                                        <div
                                          style={{
                                            position: "absolute",
                                            right: -1,
                                            top: -3,
                                            fontSize: 10,
                                            color: "#B0B0B0",
                                          }}
                                        >
                                          &gt;
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                            <div
                              style={{
                                marginTop: 10,
                                display: "grid",
                                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                                gap: 8,
                              }}
                            >
                              <div style={insightInsetStyle}>
                                <div
                                  style={{
                                    fontSize: 10,
                                    fontWeight: 700,
                                    color: "#64748B",
                                    textTransform: "uppercase",
                                    letterSpacing: "0.06em",
                                    marginBottom: 5,
                                  }}
                                >
                                  Depuis 2h
                                </div>
                                <div
                                  style={{
                                    fontSize: 13,
                                    fontWeight: 800,
                                    color:
                                      evolutionFrom2h !== null
                                        ? getEvolutionStyle(evolutionFrom2h).color
                                        : "#111827",
                                    lineHeight: "17px",
                                  }}
                                >
                                  {evolutionFrom2h !== null
                                    ? formatSignedDelta(evolutionFrom2h)
                                    : "En attente"}
                                </div>
                              </div>

                              <div style={insightInsetStyle}>
                                <div
                                  style={{
                                    fontSize: 10,
                                    fontWeight: 700,
                                    color: "#64748B",
                                    textTransform: "uppercase",
                                    letterSpacing: "0.06em",
                                    marginBottom: 5,
                                  }}
                                >
                                  1h -&gt; 30m
                                </div>
                                <div
                                  style={{
                                    fontSize: 13,
                                    fontWeight: 800,
                                    color:
                                      evolution1hTo30m !== null
                                        ? getEvolutionStyle(evolution1hTo30m).color
                                        : "#111827",
                                    lineHeight: "17px",
                                  }}
                                >
                                  {evolution1hTo30m !== null
                                    ? formatSignedDelta(evolution1hTo30m)
                                    : "En attente"}
                                </div>
                              </div>
                            </div>
                            <div
                              style={{
                                marginTop: 10,
                                ...insightInsetStyle,
                              }}
                            >
                                <div
                                  style={{
                                    fontSize: 10,
                                    fontWeight: 700,
                                    color: "#64748B",
                                    textTransform: "uppercase",
                                    letterSpacing: "0.06em",
                                    marginBottom: 5,
                                  }}
                                >
                                  Lecture dynamique
                                </div>
                                <div
                                  style={{
                                    fontSize: 12,
                                    fontWeight: 700,
                                    color: "#334155",
                                    lineHeight: "17px",
                                  }}
                                >
                                  {trendSentence || "La confiance se complete au fil du depart."}
                                </div>
                                {timelineSummary.length > 0 ? (
                                  <div
                                    style={{
                                      marginTop: 6,
                                      fontSize: 11,
                                      color: "#64748B",
                                      fontWeight: 700,
                                    }}
                                  >
                                    {timelineSummary.join(" · ")}
                                  </div>
                                ) : null}
                              </div>
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
