"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";

import { useEffect, useState, useCallback, useRef } from "react";

import {
  getSupabaseBrowserClient,
  getSupabaseConfigError,
  hasSupabaseConfig,
} from "@/lib/supabase";

/* ------------------------------------------------------------------ */

/*  Types (mirroring API response)                                     */

/* ------------------------------------------------------------------ */

interface MusicStats {
  recentPositions: number[];

  nbVictoires: number;

  nbPodiums: number;

  nbDQ: number;

  nbAbandons: number;

  fiabilite: number;

  averagePosition: number;

  serie: number;

  trend: number;

  ratioForme: number;
}

interface ScoreComponents {
  reliabilityScore?: number;

  placePotential?: number;

  winPotential?: number;

  riskPenalty?: number;

  totalScore?: number;
}

interface ScoredParticipant {
  numPmu: number;

  nom: string;

  placeCorde?: number | null;

  poids?: number | null;

  driver: string;

  jockey: string;

  entraineur: string;

  age: number;

  sexe: string;

  cote: number | null;

  musique: string;

  nombreCourses: number;

  nombreVictoires: number;

  nombrePlaces: number;

  gainCarriere: number;

  nombreSuiveurs: number;

  ordreArrivee: number | null;

  statut: string;

  score: number;

  scoreAlgo: number;

  estTocard: boolean;

  musicStats: MusicStats | null;

  scoreComponents?: ScoreComponents | null;
}

interface PredictedOdds {
  coteMatin: number | null;

  coteEstimee: number | null;

  variation: string;

  tendance: "BAISSE_FORTE" | "BAISSE" | "HAUSSE" | "STABLE";
}

interface ValueAnalysis {
  probabilite: number;

  coteJuste: number;

  cotePMU: number;

  valueIndex: number;

  label: string;

  emoji: string;

  miseConseillee: number;
}

interface FavoriteSolidity {
  score: number;

  estFragile: boolean;

  alertes: string[];

  pointsPositifs: string[];

  ecartScore: number;
}

interface Recommendation {
  decision: string;

  emoji: string;

  vautLeCoup: boolean;

  raisonnement: string[];
}

interface BetRecommendationHorse {
  numPmu: number;

  nom: string;

  placeCorde?: number | null;

  poids?: number | null;
}

interface BetRecommendation {
  type: "SIMPLE_GAGNANT" | "COUPLE_PLACE" | "COUPLE_GAGNANT";

  label: string;

  emoji: string;

  chevaux: BetRecommendationHorse[];

  surete: number;

  sureteLabel: string;

  miseConseillee: number;

  coteEstimee: number | null;

  pourquoi: string[];
}

interface ConfidenceScore {
  score: number;

  niveau: { label: string; emoji: string };

  facteurs: string[];
}

interface StrategicProfiles {
  beton: ScoredParticipant | null;

  pepite: ScoredParticipant | null;

  sniper: ScoredParticipant | null;

  lisibilite: "LISIBLE" | "COMPLEXE" | "LOTERIE";
}

interface AlgorithmHealth {
  score: number;

  status: "SAIN" | "SURVEILLANCE" | "FRAGILE";

  strengths: string[];

  weaknesses: string[];

  notes: string[];
}

interface CourseInfo {
  reunion: number;

  course: number;

  hippodrome: string;

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

interface RaceAnalysis {
  courseInfo: CourseInfo;

  participants: number;

  top5: ScoredParticipant[];

  favori: ScoredParticipant | null;

  soliditeFavori: FavoriteSolidity | null;

  recommandation: Recommendation | null;

  parisRecommandes: BetRecommendation[];

  scoreConfiance: ConfidenceScore | null;

  predictionsCotes: Record<number, PredictedOdds>;

  profils: StrategicProfiles;

  valueTop5: Record<number, ValueAnalysis>;

  algorithmHealth: AlgorithmHealth | null;
}

interface APIResponse {
  success: boolean;

  courseInfo: CourseInfo;

  participants: number;

  minutesUntilStart: number;

  pronoAvailable: boolean;

  isFinished: boolean;

  analysis: RaceAnalysis | null;

  error?: string;
}

/* ------------------------------------------------------------------ */

/*  Helpers                                                            */

/* ------------------------------------------------------------------ */

const GREEN = "#00843D";

const GREEN_DARK = "#006B31";

const DARK = "#1A1A1A";

function disciplineLabel(d: string): string {
  switch (d) {
    case "TROT_ATTELE":
      return "Trot Attel\u00e9";

    case "TROT_MONTE":
      return "Trot Mont\u00e9";

    case "PLAT":
      return "Plat";

    case "OBSTACLE":
      return "Obstacle";

    default:
      return d;
  }
}

function formatWeight(poids?: number | null): string | null {
  if (poids === null || poids === undefined || Number.isNaN(poids)) return null;

  return `${poids.toFixed(1).replace(".", ",")} kg`;
}

function formatRounded(value: number, digits = 1): string {
  return value.toFixed(digits).replace(".", ",");
}

function formatReturnForOneEuro(cote?: number | null): string | null {
  if (cote === null || cote === undefined || Number.isNaN(cote) || cote <= 0) {
    return null;
  }

  return `1 EUR -> ${formatRounded(cote)} EUR`;
}

function cleanNarrative(text: string): string {
  return text.replace(/(\d+\.\d{2,})/g, (raw) => {
    const parsed = Number(raw);

    return Number.isFinite(parsed) ? formatRounded(parsed) : raw;
  });
}

function dedupeStrings(
  items: Array<string | null | undefined>,
  limit = 3,
): string[] {
  const seen = new Set<string>();

  const cleaned: string[] = [];

  for (const item of items) {
    if (!item) continue;

    const key = item.trim();

    if (!key || seen.has(key)) continue;

    seen.add(key);

    cleaned.push(key);

    if (cleaned.length >= limit) break;
  }

  return cleaned;
}

function getParisNow(): Date {
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: "Europe/Paris" }),
  );
}

function getTodayDateStrClient(): string {
  const now = getParisNow();

  const day = String(now.getDate()).padStart(2, "0");

  const month = String(now.getMonth() + 1).padStart(2, "0");

  const year = String(now.getFullYear());

  return `${day}${month}${year}`;
}

function parseDateStr(dateStr: string): Date {
  const day = Number(dateStr.slice(0, 2));

  const month = Number(dateStr.slice(2, 4)) - 1;

  const year = Number(dateStr.slice(4, 8));

  return new Date(year, month, day);
}

/* ------------------------------------------------------------------ */

/*  SVG Confidence Gauge                                               */

/* ------------------------------------------------------------------ */

function ConfidenceGauge({ score }: { score: number }) {
  const size = 100;

  const strokeWidth = 8;

  const radius = (size - strokeWidth) / 2;

  const circumference = 2 * Math.PI * radius;

  const progress = (score / 10) * circumference;

  const offset = circumference - progress;

  return (
    <div
      style={{ display: "flex", flexDirection: "column", alignItems: "center" }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#eee"
          strokeWidth={strokeWidth}
        />

        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={GREEN}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: "stroke-dashoffset 0.8s ease" }}
        />

        <text
          x={size / 2}
          y={size / 2 - 4}
          textAnchor="middle"
          dominantBaseline="central"
          style={{ fontSize: "28px", fontWeight: 700, fill: DARK }}
        >
          {score}
        </text>

        <text
          x={size / 2}
          y={size / 2 + 20}
          textAnchor="middle"
          dominantBaseline="central"
          style={{ fontSize: "13px", fill: "#888" }}
        >
          /10
        </text>
      </svg>
    </div>
  );
}

/* ------------------------------------------------------------------ */

/*  Skeleton Loader                                                    */

/* ------------------------------------------------------------------ */

function Skeleton() {
  const shimmer: React.CSSProperties = {
    background: "linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)",

    backgroundSize: "200% 100%",

    animation: "shimmer 1.5s infinite",

    borderRadius: "8px",
  };

  return (
    <>
      <style>{`@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>

      <div
        style={{
          padding: "16px",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
        }}
      >
        <div style={{ ...shimmer, height: "120px", borderRadius: "16px" }} />

        <div style={{ ...shimmer, height: "200px", borderRadius: "16px" }} />

        <div style={{ display: "flex", gap: "12px" }}>
          <div
            style={{
              ...shimmer,
              height: "120px",
              flex: 1,
              borderRadius: "12px",
            }}
          />

          <div
            style={{
              ...shimmer,
              height: "120px",
              flex: 1,
              borderRadius: "12px",
            }}
          />
        </div>

        <div style={{ ...shimmer, height: "160px", borderRadius: "16px" }} />

        <div style={{ ...shimmer, height: "260px", borderRadius: "16px" }} />
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */

/*  Main Component                                                     */

/* ------------------------------------------------------------------ */

export default function CourseDetailPage() {
  const params = useParams();

  const router = useRouter();

  const searchParams = useSearchParams();

  const supabaseConfigured = hasSupabaseConfig();

  const reunion = params.reunion as string;

  const course = params.course as string;

  const selectedDate = searchParams.get("date") || getTodayDateStrClient();

  const [data, setData] = useState<APIResponse | null>(null);

  const [loading, setLoading] = useState(true);

  const [countdown, setCountdown] = useState("");

  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Betting state

  const [showBetPanel, setShowBetPanel] = useState(false);

  const [betHorse, setBetHorse] = useState<ScoredParticipant | null>(null);

  const [betType, setBetType] = useState<"GAGNANT" | "PLACE">("PLACE");

  const [betMise, setBetMise] = useState(2);

  const [betLoading, setBetLoading] = useState(false);

  const [betMessage, setBetMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const [alreadyBet, setAlreadyBet] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/race/${reunion}/${course}?date=${selectedDate}`,
      );

      const json: APIResponse = await res.json();

      setData(json);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [reunion, course, selectedDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /* Live countdown for locked prono */

  useEffect(() => {
    if (!data || data.pronoAvailable || data.isFinished) {
      if (countdownRef.current) clearInterval(countdownRef.current);

      return;
    }

    const courseInfo = data.courseInfo;

    function tick() {
      const parisNow = getParisNow();

      const [h, m] = courseInfo.heureDepart.split(":").map(Number);

      const target = parseDateStr(selectedDate);

      target.setHours(h, m, 0, 0);

      // Prono available 30 min before

      const unlockTime = new Date(target.getTime() - 30 * 60 * 1000);

      const diffMs = unlockTime.getTime() - parisNow.getTime();

      if (diffMs <= 0) {
        setCountdown("00:00");

        if (countdownRef.current) clearInterval(countdownRef.current);

        // Auto-refetch

        setLoading(true);

        fetchData();

        return;
      }

      const totalSec = Math.floor(diffMs / 1000);

      const mm = String(Math.floor(totalSec / 60)).padStart(2, "0");

      const ss = String(totalSec % 60).padStart(2, "0");

      setCountdown(`${mm}:${ss}`);
    }

    tick();

    countdownRef.current = setInterval(tick, 1000);

    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [data, fetchData, selectedDate]);

  /* ---------------------------------------------------------------- */

  /*  Shared styles                                                    */

  /* ---------------------------------------------------------------- */

  const pageStyle: React.CSSProperties = {
    maxWidth: "430px",

    margin: "0 auto",

    minHeight: "100vh",

    background:
      "radial-gradient(circle at top, rgba(0,132,61,0.08), transparent 24%), linear-gradient(180deg, #F6F8F9 0%, #EEF2F3 100%)",

    paddingBottom: "80px",

    position: "relative",
  };

  const headerStyle: React.CSSProperties = {
    position: "sticky",

    top: 0,

    zIndex: 100,

    background: "rgba(18, 22, 26, 0.88)",

    backdropFilter: "blur(18px)",

    borderBottom: "1px solid rgba(255,255,255,0.06)",

    height: "62px",

    display: "flex",

    alignItems: "center",

    justifyContent: "center",

    padding: "0 16px",
  };

  const cardStyle: React.CSSProperties = {
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(248,250,251,1) 100%)",

    borderRadius: "22px",

    boxShadow: "0 18px 40px rgba(15,23,42,0.08)",

    border: "1px solid rgba(15,23,42,0.06)",

    padding: "20px",

    margin: "0 16px 16px",

    overflow: "hidden",

    position: "relative",
  };

  const pillStyle: React.CSSProperties = {
    display: "inline-block",

    padding: "6px 12px",

    borderRadius: "999px",

    fontSize: "11px",

    fontWeight: 700,

    textTransform: "uppercase" as const,

    letterSpacing: "0.08em",
  };

  /* ---------------------------------------------------------------- */

  /*  Sub-components                                                   */

  /* ---------------------------------------------------------------- */

  function Header() {
    const hippo = data?.courseInfo?.hippodrome ?? "";

    return (
      <div style={headerStyle}>
        <div
          onClick={() => router.back()}
          style={{
            position: "absolute",
            left: "16px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "32px",
            height: "32px",
            borderRadius: "50%",
            background: "rgba(255,255,255,0.1)",
          }}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#fff"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </div>

        <div
          style={{
            color: "#fff",
            fontWeight: 800,
            fontSize: "17px",
            letterSpacing: "-0.3px",
          }}
        >
          R{reunion}C{course}
          <span
            style={{
              color: "rgba(255,255,255,0.56)",
              fontWeight: 500,
              marginLeft: "6px",
            }}
          >
            &middot; {hippo}
          </span>
        </div>
      </div>
    );
  }

  function RaceInfoCard({ dark }: { dark?: boolean }) {
    if (!data) return null;

    const ci = data.courseInfo;

    const bg = dark
      ? {
          background:
            "radial-gradient(circle at top right, rgba(16,185,129,0.18), transparent 30%), linear-gradient(135deg, #11181c, #1b2329)",

          border: "1px solid rgba(255,255,255,0.08)",

          boxShadow: "0 26px 48px rgba(15,23,42,0.18)",
        }
      : { background: "linear-gradient(180deg, #FFFFFF 0%, #F8FBF9 100%)" };

    const textColor = dark ? "#fff" : DARK;

    return (
      <div style={{ ...cardStyle, ...bg, color: textColor }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 800,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: dark ? "#7ee7a8" : GREEN,
            marginBottom: 10,
          }}
        >
          Course premium
        </div>

        <div
          style={{
            fontWeight: 800,
            fontSize: "24px",
            lineHeight: "28px",
            marginBottom: "8px",
            letterSpacing: "-0.6px",
          }}
        >
          {ci.nomCourse}
        </div>

        <div
          style={{
            fontWeight: 700,
            fontSize: "15px",
            marginBottom: "12px",
            color: dark ? "rgba(255,255,255,0.76)" : "#475569",
          }}
        >
          {ci.hippodrome}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            flexWrap: "wrap",
            marginBottom: "12px",
          }}
        >
          <span
            style={{
              ...pillStyle,
              background: dark ? "rgba(0,132,61,0.25)" : "#E8F5E9",
              color: GREEN,
            }}
          >
            {disciplineLabel(ci.discipline)}
          </span>

          <span
            style={{
              ...pillStyle,
              background: dark ? "rgba(255,255,255,0.08)" : "#F3F4F6",
              color: dark ? "#fff" : "#334155",
            }}
          >
            {ci.distance}m
          </span>

          <span
            style={{
              ...pillStyle,
              background: dark ? "rgba(255,255,255,0.08)" : "#F3F4F6",
              color: dark ? "#fff" : "#334155",
            }}
          >
            {ci.nombrePartants} partants
          </span>

          {ci.allocation > 0 && (
            <span
              style={{
                ...pillStyle,
                background: dark ? "rgba(255,215,0,0.12)" : "#FFF8E1",
                color: dark ? "#FFD54F" : "#B27500",
              }}
            >
              Allocation {ci.allocation.toLocaleString("fr-FR")} EUR
            </span>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <div
            style={{
              fontWeight: 800,
              color: dark ? "#FFFFFF" : DARK,
              fontSize: "34px",
              lineHeight: "36px",
              letterSpacing: "-1px",
            }}
          >
            {ci.heureDepart}
          </div>

          <div
            style={{
              fontSize: "13px",
              color: dark ? "rgba(255,255,255,0.68)" : "#64748B",
            }}
          >
            depart officiel
          </div>
        </div>
      </div>
    );
  }

  /* ---------- CASE 1: Prono locked ---------- */

  function LockedSection() {
    return (
      <div
        style={{ textAlign: "center", marginTop: "48px", padding: "0 24px" }}
      >
        <div style={{ fontSize: "64px", marginBottom: "18px" }}>&#x1F512;</div>

        <div
          style={{
            fontWeight: 700,
            fontSize: "20px",
            color: DARK,
            marginBottom: "16px",
          }}
        >
          Pronostic verrouill&eacute;
        </div>

        <div
          style={{
            fontWeight: 800,
            fontSize: "32px",
            color: GREEN,
            marginBottom: "12px",
            fontVariantNumeric: "tabular-nums",
            letterSpacing: "-1px",
          }}
        >
          Disponible dans {countdown || "--:--"}
        </div>

        <div style={{ fontSize: "14px", color: "#64748B", lineHeight: 1.6 }}>
          Le pronostic sera d&eacute;voil&eacute; 30 min avant le d&eacute;part
        </div>
      </div>
    );
  }

  /* ---------- CASE 2 / 3: Full Analysis ---------- */

  function FullAnalysis() {
    if (!data || !data.analysis) return null;

    const a = data.analysis;

    const favori = a.favori;

    const solidite = a.soliditeFavori;

    const reco = a.recommandation;

    const primarySimpleRecommendation =
      a.parisRecommandes?.find((pari) => pari.type === "SIMPLE_GAGNANT") ??
      null;

    const primarySimpleHorse = primarySimpleRecommendation?.chevaux?.[0]
      ? (a.top5.find(
          (horse) =>
            horse.numPmu === primarySimpleRecommendation.chevaux[0].numPmu,
        ) ?? null)
      : null;

    const ticketSimpleDiffers = Boolean(
      favori &&
      primarySimpleHorse &&
      favori.numPmu !== primarySimpleHorse.numPmu,
    );

    const confiance = a.scoreConfiance;

    const profils = a.profils;

    const algoHealth = a.algorithmHealth;

    const simpleHorse = primarySimpleHorse ?? favori;

    const highlightedOdds = simpleHorse
      ? (a.predictionsCotes[simpleHorse.numPmu] ?? null)
      : null;

    const highlightedValue = simpleHorse
      ? (a.valueTop5[simpleHorse.numPmu] ?? null)
      : null;

    const riderLabel = data.courseInfo.estPlat ? "Jockey" : "Driver";

    const lisibiliteLabel =
      profils.lisibilite === "LISIBLE"
        ? "Course lisible"
        : profils.lisibilite === "COMPLEXE"
          ? "Course complexe"
          : "Course ouverte";

    const normalizedDecision = reco?.decision ?? (() => {
      if (!solidite) return "Lecture en attente";

      if (solidite.score >= 82 && solidite.alertes.length === 0) {
        return "JOUEZ LE FAVORI";
      }

      if (solidite.score >= 65) {
        return "FAVORI JOUABLE AVEC PRUDENCE";
      }

      if (solidite.score >= 45 || profils.lisibilite === "COMPLEXE") {
        return "COURSE COMPLEXE";
      }

      return "COURSE A EVITER";
    })();

    const tonePalette = {
      positive: {
        background: "#EAF8EF",

        border: "1px solid rgba(0,132,61,0.18)",

        text: GREEN_DARK,

        accent: GREEN,

        muted: "#F4FBF6",
      },

      warning: {
        background: "#FFF7E8",

        border: "1px solid rgba(214,153,6,0.2)",

        text: "#8A5A00",

        accent: "#D69906",

        muted: "#FFF9F0",
      },

      danger: {
        background: "#FFF0F0",

        border: "1px solid rgba(211,47,47,0.18)",

        text: "#A61B1B",

        accent: "#D32F2F",

        muted: "#FFF6F6",
      },

      info: {
        background: "#EEF5FF",

        border: "1px solid rgba(59,130,246,0.16)",

        text: "#1D4ED8",

        accent: "#2563EB",

        muted: "#F6FAFF",
      },

      neutral: {
        background: "#F8FAFC",

        border: "1px solid rgba(148,163,184,0.18)",

        text: "#334155",

        accent: "#475569",

        muted: "#FFFFFF",
      },
    } as const;

    const decisionTone =
      normalizedDecision === "JOUEZ LE FAVORI"
        ? tonePalette.positive
        : normalizedDecision === "FAVORI JOUABLE AVEC PRUDENCE"
          ? tonePalette.warning
          : normalizedDecision === "COURSE COMPLEXE"
            ? tonePalette.info
            : tonePalette.danger;

    const lisibiliteTone =
      profils.lisibilite === "LISIBLE"
        ? tonePalette.positive
        : profils.lisibilite === "COMPLEXE"
          ? tonePalette.warning
          : tonePalette.danger;

    const soliditeTone = !solidite
      ? tonePalette.info
      : solidite.score >= 82
        ? tonePalette.positive
        : solidite.score >= 65
          ? tonePalette.warning
          : tonePalette.danger;

    const displayedOdds =
      primarySimpleRecommendation?.coteEstimee ??
      highlightedOdds?.coteEstimee ??
      simpleHorse?.cote ??
      null;

    const ticketLabel =
      displayedOdds !== null && displayedOdds >= 15
        ? "Outsider speculatif"
        : displayedOdds !== null && displayedOdds >= 6
          ? "Value jouable"
          : "Base solide";

    const ticketTone =
      displayedOdds !== null && displayedOdds >= 15
        ? tonePalette.danger
        : displayedOdds !== null && displayedOdds >= 6
          ? tonePalette.info
          : tonePalette.positive;

    const summaryNote = cleanNarrative(
      reco?.raisonnement?.[0] ??
        algoHealth?.notes?.[0] ??
        (normalizedDecision === "JOUEZ LE FAVORI"
          ? "Le favori ressort nettement et la course reste lisible."
          : normalizedDecision === "FAVORI JOUABLE AVEC PRUDENCE"
            ? "Le ticket ressort bien, mais il faut garder un peu de prudence."
            : normalizedDecision === "COURSE COMPLEXE"
              ? "Le lot reste serre, mieux vaut rester selectif."
              : "La course manque de lisibilite pour un ticket offensif."),
    );

    const splitReading =
      ticketSimpleDiffers && simpleHorse && favori
        ? `Le moteur garde N${favori.numPmu} ${favori.nom} comme favori technique, mais prefere jouer N${simpleHorse.numPmu} ${simpleHorse.nom} en simple.`
        : null;

    const focusStrengths = dedupeStrings(
      [
        ...(solidite?.pointsPositifs.map(cleanNarrative) ?? []),

        ...(algoHealth?.strengths.map(cleanNarrative) ?? []),

        ...(primarySimpleRecommendation?.pourquoi.map(cleanNarrative) ?? []),
      ],

      4,
    );

    const focusWatchouts = dedupeStrings(
      [
        ...(solidite?.alertes.map(cleanNarrative) ?? []),

        ...(algoHealth?.weaknesses.map(cleanNarrative) ?? []),

        ...(confiance?.facteurs

          .filter((facteur) => facteur.includes("(-"))

          .map(cleanNarrative) ?? []),
      ],

      4,
    );

    const watchTitle =
      focusWatchouts.length > 0
        ? "Ce qui rend la course nerveuse"
        : "Lecture assez stable";

    const metricCardStyle: React.CSSProperties = {
      borderRadius: "16px",

      padding: "14px",

      border: "1px solid rgba(15,23,42,0.06)",

      background: "#FFFFFF",

      boxShadow: "0 12px 26px rgba(15,23,42,0.04)",
    };

    const renderMetricCard = (
      title: string,

      value: string,

      subtitle: string,

      tone:
        | typeof tonePalette.positive
        | typeof tonePalette.warning
        | typeof tonePalette.danger
        | typeof tonePalette.info
        | typeof tonePalette.neutral,
    ) => (
      <div
        style={{
          ...metricCardStyle,
          background: tone.muted,
          border: tone.border,
        }}
      >
        <div
          style={{
            fontSize: "11px",
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "#64748B",
            marginBottom: "8px",
          }}
        >
          {title}
        </div>

        <div
          style={{
            fontSize: "24px",
            fontWeight: 800,
            color: tone.text,
            lineHeight: 1.05,
          }}
        >
          {value}
        </div>

        <div
          style={{
            fontSize: "12px",
            color: "#64748B",
            marginTop: "8px",
            lineHeight: 1.45,
          }}
        >
          {subtitle}
        </div>
      </div>
    );

    const renderHorseSummary = (
      horse: ScoredParticipant,

      title: string,

      tone:
        | typeof tonePalette.positive
        | typeof tonePalette.warning
        | typeof tonePalette.danger
        | typeof tonePalette.info
        | typeof tonePalette.neutral,

      badge?: string | null,
    ) => {
      const rider = data.courseInfo.estPlat
        ? horse.jockey || horse.driver || horse.entraineur || "Non renseigne"
        : horse.driver || horse.jockey || horse.entraineur || "Non renseigne";

      const odds = a.predictionsCotes[horse.numPmu] ?? null;

      const value = a.valueTop5[horse.numPmu] ?? null;

      const components = horse.scoreComponents;

      const returnLabel = formatReturnForOneEuro(
        odds?.coteEstimee ?? horse.cote,
      );

      const valueShort = value
        ? value.valueIndex >= 2.2
          ? "Value forte"
          : value.valueIndex >= 1.4
            ? "Value jouable"
            : value.valueIndex < 0.85
              ? "Sous pression"
              : "Prix juste"
        : null;

      return (
        <div
          style={{
            borderRadius: "20px",
            padding: "16px",
            background: tone.muted,
            border: tone.border,
            display: "flex",
            flexDirection: "column",
            gap: "14px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "10px",
              flexWrap: "wrap",
            }}
          >
            <span
              style={{
                ...pillStyle,
                background: tone.background,
                color: tone.accent,
              }}
            >
              {title}
            </span>

            {badge ? (
              <span
                style={{ fontSize: "12px", color: tone.text, fontWeight: 700 }}
              >
                {badge}
              </span>
            ) : null}
          </div>

          <div
            style={{ display: "flex", alignItems: "flex-start", gap: "14px" }}
          >
            <div
              style={{
                width: "52px",

                height: "52px",

                borderRadius: "16px",

                background: tone.accent,

                color: "#fff",

                display: "flex",

                alignItems: "center",

                justifyContent: "center",

                fontWeight: 800,

                fontSize: "24px",

                flexShrink: 0,

                boxShadow: "0 14px 24px rgba(15,23,42,0.10)",
              }}
            >
              {horse.numPmu}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: "22px",
                  fontWeight: 800,
                  color: DARK,
                  lineHeight: 1.05,
                  letterSpacing: "-0.4px",
                }}
              >
                {horse.nom}
              </div>

              <div
                style={{ fontSize: "13px", color: "#64748B", marginTop: "4px" }}
              >
                {riderLabel}: {rider}
              </div>

              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "8px",
                  marginTop: "10px",
                }}
              >
                {horse.placeCorde ? (
                  <span
                    style={{
                      ...pillStyle,
                      background: "#F3F4F6",
                      color: "#475569",
                    }}
                  >
                    Stalle {horse.placeCorde}
                  </span>
                ) : null}

                {formatWeight(horse.poids) ? (
                  <span
                    style={{
                      ...pillStyle,
                      background: "#FFF8E1",
                      color: "#A66B00",
                    }}
                  >
                    Poids {formatWeight(horse.poids)}
                  </span>
                ) : null}

                {valueShort ? (
                  <span
                    style={{
                      ...pillStyle,
                      background: tone.background,
                      color: tone.text,
                    }}
                  >
                    {valueShort}
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          {components ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              <span
                style={{
                  ...pillStyle,
                  background: "#EEF8F1",
                  color: GREEN_DARK,
                }}
              >
                Place {formatRounded(components.placePotential ?? 0)}/10
              </span>

              <span
                style={{
                  ...pillStyle,
                  background: "#EEF5FF",
                  color: "#1D4ED8",
                }}
              >
                Gagne {formatRounded(components.winPotential ?? 0)}/10
              </span>

              <span
                style={{
                  ...pillStyle,
                  background: "#FFF3E0",
                  color: "#B45309",
                }}
              >
                Risque {formatRounded(components.riskPenalty ?? 0)}/10
              </span>
            </div>
          ) : null}

          {returnLabel ? (
            <div
              style={{
                padding: "10px 12px",
                borderRadius: "14px",
                background: tone.background,
                color: tone.text,
                fontSize: "13px",
                fontWeight: 700,
              }}
            >
              Projection marche: {returnLabel}
            </div>
          ) : null}
        </div>
      );
    };

    return (
      <>
        {data.isFinished && simpleHorse && (
          <ResultBanner
            horse={simpleHorse}
            label={ticketSimpleDiffers ? "Ticket simple" : "Favori"}
          />
        )}

        <RaceInfoCard dark />

        {favori && confiance && solidite && (
          <div
            style={{
              ...cardStyle,

              background:
                "radial-gradient(circle at top right, rgba(0,132,61,0.10), transparent 24%), linear-gradient(180deg, #FFFFFF 0%, #F7FBF8 100%)",

              display: "flex",

              flexDirection: "column",

              gap: "18px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: "14px",
                flexWrap: "wrap",
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    ...pillStyle,
                    background: decisionTone.background,
                    color: decisionTone.accent,
                    marginBottom: "12px",
                  }}
                >
                  Lecture centrale
                </div>

                <div
                  style={{
                    fontSize: "28px",
                    lineHeight: 1.05,
                    letterSpacing: "-0.8px",
                    fontWeight: 800,
                    color: DARK,
                    marginBottom: "8px",
                  }}
                >
                  {normalizedDecision}
                </div>

                <div
                  style={{
                    fontSize: "14px",
                    color: "#475569",
                    lineHeight: 1.6,
                  }}
                >
                  {summaryNote}
                </div>

                {splitReading ? (
                  <div
                    style={{
                      marginTop: "12px",
                      padding: "12px 14px",
                      borderRadius: "14px",
                      background: "#F8FAFC",
                      color: "#475569",
                      fontSize: "13px",
                      lineHeight: 1.55,
                    }}
                  >
                    {splitReading}
                  </div>
                ) : null}
              </div>

              <div style={{ flexShrink: 0 }}>
                <ConfidenceGauge score={confiance.score} />
              </div>
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              <span
                style={{
                  ...pillStyle,
                  background: decisionTone.background,
                  color: decisionTone.accent,
                }}
              >
                Ticket {ticketLabel}
              </span>

              <span
                style={{
                  ...pillStyle,
                  background: lisibiliteTone.background,
                  color: lisibiliteTone.accent,
                }}
              >
                {lisibiliteLabel}
              </span>

              <span
                style={{
                  ...pillStyle,
                  background: soliditeTone.background,
                  color: soliditeTone.accent,
                }}
              >
                Solidite {solidite.score}/100
              </span>
            </div>

            <div style={{ display: "grid", gap: "12px" }}>
              {simpleHorse
                ? renderHorseSummary(
                    simpleHorse,

                    "Ticket simple conseille",

                    decisionTone,

                    ticketLabel,
                  )
                : null}

              {ticketSimpleDiffers && favori
                ? renderHorseSummary(
                    favori,

                    "Favori technique",

                    tonePalette.neutral,

                    "Lecture brute",
                  )
                : null}
            </div>

            <div
              style={{
                display: "grid",

                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",

                gap: "12px",
              }}
            >
              {renderMetricCard(
                "Confiance course",
                `${formatRounded(confiance.score)}/10`,
                confiance.niveau.label,
                decisionTone,
              )}

              {renderMetricCard(
                "Ecart top 2",
                `${formatRounded(solidite.ecartScore)} pts`,
                solidite.alertes.length > 0
                  ? `${solidite.alertes.length} alerte(s)`
                  : "Alerte majeure absente",
                soliditeTone,
              )}

              {renderMetricCard(
                "Projection 1 EUR",
                formatReturnForOneEuro(displayedOdds) ?? "N/A",
                highlightedValue?.label ?? ticketLabel,
                highlightedOdds?.tendance === "HAUSSE"
                  ? tonePalette.warning
                  : ticketTone,
              )}
            </div>

            <div style={{ ...metricCardStyle, background: "#FCFDFC" }}>
              {splitReading ? (
                <div
                  style={{
                    marginBottom: "12px",
                    padding: "12px 14px",
                    borderRadius: "14px",
                    background: "#F8FAFC",
                    color: "#475569",
                    fontSize: "13px",
                    lineHeight: 1.55,
                  }}
                >
                  {splitReading}
                </div>
              ) : null}

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                  gap: "12px",
                }}
              >
                <div
                  style={{
                    borderRadius: "14px",
                    padding: "14px",
                    background: "#F7FBF8",
                  }}
                >
                  <div
                    style={{
                      fontSize: "13px",
                      fontWeight: 800,
                      color: GREEN_DARK,
                      marginBottom: "12px",
                    }}
                  >
                    Pourquoi le ticket ressort
                  </div>

                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                    }}
                  >
                    {(focusStrengths.length > 0
                      ? focusStrengths
                      : ["Lecture globalement propre pour le ticket simple."]
                    ).map((item, index) => (
                      <div
                        key={index}
                        style={{
                          fontSize: "13px",
                          color: "#475569",
                          lineHeight: 1.55,
                        }}
                      >
                        OK - {item}
                      </div>
                    ))}
                  </div>
                </div>

                <div
                  style={{
                    borderRadius: "14px",
                    padding: "14px",
                    background: "#FFFBF2",
                  }}
                >
                  <div
                    style={{
                      fontSize: "13px",
                      fontWeight: 800,
                      color: "#9A6700",
                      marginBottom: "12px",
                    }}
                  >
                    {watchTitle}
                  </div>

                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                    }}
                  >
                    {(focusWatchouts.length > 0
                      ? focusWatchouts
                      : ["Pas de drapeau rouge majeur sur cette lecture."]
                    ).map((item, index) => (
                      <div
                        key={index}
                        style={{
                          fontSize: "13px",
                          color: "#6B7280",
                          lineHeight: 1.55,
                        }}
                      >
                        {focusWatchouts.length > 0 ? "Alerte -" : "Note -"} {item}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {a.top5.length > 0 && (
          <div
            style={{
              ...cardStyle,
              padding: "20px",
              display: "flex",
              flexDirection: "column",
              gap: "14px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: "12px",
              }}
            >
              <div>
                <div
                  style={{
                    ...pillStyle,
                    background: "#EEF5FF",
                    color: "#1D4ED8",
                    marginBottom: "10px",
                  }}
                >
                  Radar top 5
                </div>

                <div
                  style={{
                    fontSize: "22px",
                    fontWeight: 800,
                    color: DARK,
                    letterSpacing: "-0.5px",
                  }}
                >
                  Ordre de lecture de la course
                </div>
              </div>

              <div
                style={{ fontSize: "13px", color: "#64748B", fontWeight: 700 }}
              >
                {a.top5.length} chevaux suivis
              </div>
            </div>

            <div
              style={{ display: "flex", flexDirection: "column", gap: "12px" }}
            >
              {a.top5.map((horse, idx) => {
                const isSimple = Boolean(
                  simpleHorse && horse.numPmu === simpleHorse.numPmu,
                );

                const isFavori = Boolean(
                  favori && horse.numPmu === favori.numPmu,
                );

                const rowTone = isSimple
                  ? decisionTone
                  : isFavori
                    ? tonePalette.info
                    : tonePalette.neutral;

                const rider = data.courseInfo.estPlat
                  ? horse.jockey ||
                    horse.driver ||
                    horse.entraineur ||
                    "Non renseigne"
                  : horse.driver ||
                    horse.jockey ||
                    horse.entraineur ||
                    "Non renseigne";

                const odds = a.predictionsCotes[horse.numPmu] ?? null;

                const components = horse.scoreComponents;

                const maxScore = a.top5[0].scoreAlgo || 1;

                const barWidth = Math.max(
                  8,
                  Math.round((horse.scoreAlgo / maxScore) * 100),
                );

                return (
                  <div
                    key={horse.numPmu}
                    style={{
                      borderRadius: "18px",

                      padding: "14px",

                      background: rowTone.muted,

                      border: rowTone.border,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "12px",
                      }}
                    >
                      <div
                        style={{
                          width: "40px",

                          height: "40px",

                          borderRadius: "12px",

                          background: rowTone.accent,

                          color: "#fff",

                          display: "flex",

                          alignItems: "center",

                          justifyContent: "center",

                          fontWeight: 800,

                          fontSize: "18px",

                          flexShrink: 0,
                        }}
                      >
                        {idx + 1}
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: "10px",
                            marginBottom: "6px",
                          }}
                        >
                          <div style={{ minWidth: 0 }}>
                            <div
                              style={{
                                fontWeight: 800,
                                fontSize: "18px",
                                color: DARK,
                                lineHeight: 1.15,
                              }}
                            >
                              N{horse.numPmu} {horse.nom}
                            </div>

                            <div
                              style={{
                                fontSize: "12px",
                                color: "#64748B",
                                marginTop: "4px",
                              }}
                            >
                              {riderLabel}: {rider}
                            </div>
                          </div>

                          <div style={{ textAlign: "right", flexShrink: 0 }}>
                            <div
                              style={{
                                fontSize: "14px",
                                fontWeight: 800,
                                color: rowTone.text,
                              }}
                            >
                              {horse.scoreAlgo}
                            </div>

                            <div style={{ fontSize: "12px", color: "#64748B" }}>
                              {odds?.coteEstimee ?? horse.cote ?? "N/A"}
                            </div>
                          </div>
                        </div>

                        <div
                          style={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: "8px",
                            marginBottom: "10px",
                          }}
                        >
                          {isSimple ? (
                            <span
                              style={{
                                ...pillStyle,
                                background: decisionTone.background,
                                color: decisionTone.accent,
                              }}
                            >
                              Ticket simple
                            </span>
                          ) : null}

                          {isFavori ? (
                            <span
                              style={{
                                ...pillStyle,
                                background: tonePalette.info.background,
                                color: tonePalette.info.accent,
                              }}
                            >
                              Favori technique
                            </span>
                          ) : null}

                          {horse.placeCorde ? (
                            <span
                              style={{
                                ...pillStyle,
                                background: "#F3F4F6",
                                color: "#475569",
                              }}
                            >
                              Stalle {horse.placeCorde}
                            </span>
                          ) : null}

                          {formatWeight(horse.poids) ? (
                            <span
                              style={{
                                ...pillStyle,
                                background: "#FFF8E1",
                                color: "#A66B00",
                              }}
                            >
                              {formatWeight(horse.poids)}
                            </span>
                          ) : null}

                          {components ? (
                            <span
                              style={{
                                ...pillStyle,
                                background: "#EEF8F1",
                                color: GREEN_DARK,
                              }}
                            >
                              Place{" "}
                              {formatRounded(components.placePotential ?? 0)}/10
                            </span>
                          ) : null}
                        </div>

                        <div
                          style={{
                            height: "8px",
                            borderRadius: "999px",
                            background: "#E5E7EB",
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              width: `${barWidth}%`,

                              height: "100%",

                              borderRadius: "999px",

                              background: rowTone.accent,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {!data.isFinished && simpleHorse && !alreadyBet && (
          <div style={{ margin: "0 16px 16px" }}>
            <button
              onClick={() => openBetPanel(simpleHorse)}
              style={{
                width: "100%",

                padding: "18px",

                borderRadius: "18px",

                border: "none",

                background: `linear-gradient(135deg, ${GREEN}, ${GREEN_DARK})`,

                color: "#fff",

                fontSize: "16px",

                fontWeight: 800,

                cursor: "pointer",

                boxShadow: "0 16px 30px rgba(0,132,61,0.26)",

                letterSpacing: "-0.2px",
              }}
            >
              {ticketSimpleDiffers
                ? "Parier le ticket simple conseille"
                : "Parier sur cette course"}
            </button>

            {a.top5.length > 1 &&
            simpleHorse &&
            a.top5[1].numPmu !== simpleHorse.numPmu ? (
              <div style={{ textAlign: "center", marginTop: "8px" }}>
                <span
                  onClick={() => openBetPanel(a.top5[1])}
                  style={{
                    fontSize: "13px",
                    color: GREEN,
                    cursor: "pointer",
                    fontWeight: 600,
                  }}
                >
                  ou parier sur {a.top5[1].nom} (2e lecture)
                </span>
              </div>
            ) : null}
          </div>
        )}

        {alreadyBet && (
          <div
            style={{
              margin: "0 16px 16px",
              padding: "16px",
              borderRadius: "14px",

              background: "#E8F5E9",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: "24px", marginBottom: "4px" }}>&#9989;</div>

            <div style={{ fontWeight: 700, color: GREEN, fontSize: "15px" }}>
              Pari enregistre !
            </div>

            <div
              onClick={() => router.push("/mes-paris")}
              style={{
                fontSize: "13px",
                color: GREEN,
                marginTop: "8px",
                cursor: "pointer",
                textDecoration: "underline",
              }}
            >
              Voir mes paris
            </div>
          </div>
        )}

        {betMessage && !showBetPanel && (
          <div
            style={{
              margin: "0 16px 16px",
              padding: "12px 16px",
              borderRadius: "12px",

              background: betMessage.type === "success" ? "#E8F5E9" : "#FFEBEE",

              color: betMessage.type === "success" ? GREEN : "#C62828",

              fontSize: "13px",
              fontWeight: 600,
              textAlign: "center",
            }}
          >
            {betMessage.text}
          </div>
        )}
      </>
    );
  }

  /* Result Banner for finished races */

  function ResultBanner({
    horse,

    label,
  }: {
    horse: ScoredParticipant;

    label: string;
  }) {
    const ordre = horse.ordreArrivee;

    let bg: string;

    let text: string;

    if (ordre === 1) {
      bg = GREEN;

      text = `\uD83C\uDFC6 ${label} gagnant`;
    } else if (ordre !== null && ordre <= 3) {
      bg = "#FFD600";

      text = `\u2705 ${label} place (${ordre}e)`;
    } else {
      bg = "#D32F2F";

      text = `\u274C ${label} non place`;
    }

    return (
      <div
        style={{
          margin: "0 16px 16px",

          padding: "16px",

          borderRadius: "12px",

          background: bg,

          textAlign: "center",

          color: ordre !== null && ordre <= 3 && ordre !== 1 ? DARK : "#fff",

          fontWeight: 700,

          fontSize: "20px",
        }}
      >
        {text}
      </div>
    );
  }

  /* ---------- Bet handler ---------- */

  async function handlePlaceBet() {
    if (!betHorse || !data) return;

    if (!supabaseConfigured) {
      setBetMessage({ type: "error", text: getSupabaseConfigError() });

      return;
    }

    setBetLoading(true);

    setBetMessage(null);

    const supabase = getSupabaseBrowserClient();

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      setBetLoading(false);

      router.push(`/login?redirect=/course/${reunion}/${course}`);

      return;
    }

    const cote =
      betHorse.cote ||
      data.analysis?.predictionsCotes[betHorse.numPmu]?.coteEstimee ||
      2;

    const now = new Date(
      new Date().toLocaleString("en-US", { timeZone: "Europe/Paris" }),
    );

    const dateStr = `${String(now.getDate()).padStart(2, "0")}${String(now.getMonth() + 1).padStart(2, "0")}${now.getFullYear()}`;

    try {
      const res = await fetch("/api/bets", {
        method: "POST",

        headers: {
          "Content-Type": "application/json",

          Authorization: `Bearer ${session.access_token}`,
        },

        body: JSON.stringify({
          date_str: dateStr,

          reunion: Number(reunion),

          course: Number(course),

          hippodrome: data.courseInfo.hippodrome,

          heure_depart: data.courseInfo.heureDepart,

          cheval_num: betHorse.numPmu,

          cheval_nom: betHorse.nom,

          type_pari: betType,

          mise: betMise,

          cote,
        }),
      });

      const result = await res.json();

      if (result.success) {
        setBetMessage({
          type: "success",
          text: `Pari place ! Solde: ${result.solde} EUR`,
        });

        setAlreadyBet(true);

        setShowBetPanel(false);
      } else {
        setBetMessage({ type: "error", text: result.error || "Erreur" });
      }
    } catch {
      setBetMessage({ type: "error", text: "Erreur reseau" });
    } finally {
      setBetLoading(false);
    }
  }

  function openBetPanel(horse: ScoredParticipant) {
    setBetHorse(horse);

    setBetType("PLACE");

    setBetMise(2);

    setBetMessage(null);

    setShowBetPanel(true);
  }

  /* ---------- Bet Panel Overlay ---------- */

  function BetPanel() {
    if (!showBetPanel || !betHorse || !data) return null;

    const cote =
      betHorse.cote ||
      data.analysis?.predictionsCotes[betHorse.numPmu]?.coteEstimee ||
      2;

    const gainPotentiel =
      betType === "GAGNANT"
        ? Math.round((betMise * cote - betMise) * 100) / 100
        : Math.round((betMise * cote * 0.3 - betMise) * 100) / 100;

    return (
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,

          background: "rgba(0,0,0,0.5)",
          zIndex: 300,

          display: "flex",
          alignItems: "flex-end",
          justifyContent: "center",
        }}
        onClick={() => setShowBetPanel(false)}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            background: "#fff",
            borderRadius: "24px 24px 0 0",

            width: "100%",
            maxWidth: 430,
            padding: "24px 20px 32px",
          }}
        >
          {/* Handle */}

          <div
            style={{
              width: 40,
              height: 4,
              background: "#ddd",
              borderRadius: 2,
              margin: "0 auto 20px",
            }}
          />

          <div
            style={{
              fontWeight: 700,
              fontSize: 18,
              color: DARK,
              marginBottom: 16,
            }}
          >
            Placer un pari
          </div>

          {/* Horse info */}

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginBottom: 20,
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: "50%",
                background: GREEN,

                display: "flex",
                alignItems: "center",
                justifyContent: "center",

                color: "#fff",
                fontWeight: 700,
                fontSize: 18,
              }}
            >
              {betHorse.numPmu}
            </div>

            <div>
              <div style={{ fontWeight: 700, fontSize: 16, color: DARK }}>
                {betHorse.nom}
              </div>

              <div style={{ fontSize: 13, color: "#888" }}>Cote: {cote}</div>

              {(betHorse.placeCorde || formatWeight(betHorse.poids)) && (
                <div style={{ fontSize: 12, color: "#64748B", marginTop: 4 }}>
                  {[
                    betHorse.placeCorde
                      ? `Stalle ${betHorse.placeCorde}`
                      : null,
                    formatWeight(betHorse.poids)
                      ? `Poids ${formatWeight(betHorse.poids)}`
                      : null,
                  ]

                    .filter(Boolean)

                    .join(" - ")}
                </div>
              )}
            </div>
          </div>

          {/* Type pari */}

          <div style={{ marginBottom: 16 }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "#555",
                marginBottom: 8,
              }}
            >
              Type de pari
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              {(["PLACE", "GAGNANT"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setBetType(t)}
                  style={{
                    flex: 1,
                    padding: "12px",
                    borderRadius: 12,

                    border: `2px solid ${betType === t ? GREEN : "#E0E0E0"}`,

                    background: betType === t ? "#E8F5E9" : "#fff",

                    color: betType === t ? GREEN : "#888",

                    fontWeight: 700,
                    fontSize: 14,
                    cursor: "pointer",
                  }}
                >
                  {t === "PLACE" ? "Place (Top 3)" : "Gagnant (1er)"}
                </button>
              ))}
            </div>
          </div>

          {/* Mise */}

          <div style={{ marginBottom: 20 }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "#555",
                marginBottom: 8,
              }}
            >
              Mise
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                justifyContent: "center",
              }}
            >
              <button
                onClick={() => setBetMise(Math.max(1, betMise - 1))}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  border: "2px solid #E0E0E0",

                  background: "#fff",
                  fontSize: 20,
                  fontWeight: 700,
                  cursor: "pointer",
                  color: DARK,
                }}
              >
                -
              </button>

              <div
                style={{
                  fontSize: 28,
                  fontWeight: 700,
                  color: DARK,
                  minWidth: 60,
                  textAlign: "center",
                }}
              >
                {betMise} EUR
              </div>

              <button
                onClick={() => setBetMise(Math.min(50, betMise + 1))}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  border: "2px solid #E0E0E0",

                  background: "#fff",
                  fontSize: 20,
                  fontWeight: 700,
                  cursor: "pointer",
                  color: DARK,
                }}
              >
                +
              </button>
            </div>
          </div>

          {/* Gain potentiel */}

          <div
            style={{
              background: "#F5F5F5",
              borderRadius: 12,
              padding: "12px 16px",

              display: "flex",
              justifyContent: "space-between",
              marginBottom: 20,
            }}
          >
            <span style={{ fontSize: 14, color: "#666" }}>Gain potentiel</span>

            <span
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: gainPotentiel > 0 ? GREEN : "#C62828",
              }}
            >
              {gainPotentiel > 0 ? "+" : ""}
              {gainPotentiel} EUR
            </span>
          </div>

          {/* Submit */}

          <button
            onClick={handlePlaceBet}
            disabled={betLoading}
            style={{
              width: "100%",
              padding: 16,
              borderRadius: 12,

              border: "none",
              background: betLoading ? "#999" : GREEN,

              color: "#fff",
              fontSize: 16,
              fontWeight: 700,
              cursor: betLoading ? "not-allowed" : "pointer",
            }}
          >
            {betLoading ? "Envoi..." : "Confirmer le pari"}
          </button>

          {betMessage && (
            <div
              style={{
                marginTop: 12,
                padding: "10px 16px",
                borderRadius: 12,

                background:
                  betMessage.type === "success" ? "#E8F5E9" : "#FFEBEE",

                color: betMessage.type === "success" ? GREEN : "#C62828",

                fontSize: 13,
                fontWeight: 600,
                textAlign: "center",
              }}
            >
              {betMessage.text}
            </div>
          )}
        </div>
      </div>
    );
  }

  /* Bottom Tab Bar */

  function BottomTabBar() {
    const tabs = [
      { label: "Courses", icon: "\uD83C\uDFC7", href: "/", active: false },

      {
        label: "Mes Paris",
        icon: "\uD83D\uDCB0",
        href: "/mes-paris",
        active: false,
      },

      { label: "Bilan", icon: "\uD83D\uDCCA", href: "/bilan", active: false },
    ];

    return (
      <div
        style={{
          position: "fixed",

          bottom: 0,

          left: "50%",

          transform: "translateX(-50%)",

          width: "100%",

          maxWidth: "430px",

          height: "70px",

          background: "rgba(255,255,255,0.92)",

          backdropFilter: "blur(18px)",

          borderTop: "1px solid rgba(15,23,42,0.08)",

          boxShadow: "0 -14px 30px rgba(15,23,42,0.08)",

          display: "flex",

          alignItems: "center",

          justifyContent: "space-around",

          zIndex: 200,
        }}
      >
        {tabs.map((tab) => (
          <div
            key={tab.label}
            onClick={() => {
              if (tab.href !== "#") router.push(tab.href);
            }}
            style={{
              display: "flex",

              flexDirection: "column",

              alignItems: "center",

              gap: "2px",

              cursor: "pointer",

              color: tab.active ? GREEN : "#64748B",
            }}
          >
            <span style={{ fontSize: "20px" }}>{tab.icon}</span>

            <span
              style={{ fontSize: "11px", fontWeight: tab.active ? 800 : 600 }}
            >
              {tab.label}
            </span>
          </div>
        ))}
      </div>
    );
  }

  /* ---------------------------------------------------------------- */

  /*  Render                                                           */

  /* ---------------------------------------------------------------- */

  return (
    <div style={pageStyle}>
      <Header />

      {loading ? (
        <Skeleton />
      ) : !data || !data.success ? (
        <div
          style={{ textAlign: "center", padding: "60px 20px", color: "#888" }}
        >
          <div style={{ fontSize: "48px", marginBottom: "16px" }}>
            &#x26A0;&#xFE0F;
          </div>

          <div style={{ fontWeight: 600, fontSize: "16px" }}>
            Course introuvable
          </div>
        </div>
      ) : !data.pronoAvailable ? (
        <>
          <div style={{ height: "16px" }} />

          <RaceInfoCard />

          <LockedSection />
        </>
      ) : (
        <>
          <div style={{ height: "16px" }} />

          <FullAnalysis />
        </>
      )}

      <BottomTabBar />

      <BetPanel />
    </div>
  );
}
