"use client";

import { useParams, useRouter } from "next/navigation";
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

interface ScoredParticipant {
  numPmu: number;
  nom: string;
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
}

type BetRecommendationType =
  | "SIMPLE_GAGNANT"
  | "COUPLE_PLACE"
  | "COUPLE_GAGNANT";

interface BetRecommendation {
  type: BetRecommendationType;
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

type PlacedBetType =
  | "GAGNANT"
  | "PLACE"
  | "COUPLE_GAGNANT"
  | "COUPLE_PLACE";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
const GREEN = "#00843D";
const GREEN_DARK = "#006B31";
const DARK = "#1A1A1A";

function disciplineLabel(d: string): string {
  switch (d) {
    case "TROT_ATTELE": return "Trot Attel\u00e9";
    case "TROT_MONTE": return "Trot Mont\u00e9";
    case "PLAT": return "Plat";
    case "OBSTACLE": return "Obstacle";
    default: return d;
  }
}

function positionMedal(pos: number): string {
  if (pos === 1) return "\uD83E\uDD47";
  if (pos === 2) return "\uD83E\uDD48";
  if (pos === 3) return "\uD83E\uDD49";
  return `${pos}.`;
}

function getBetTypeLabel(type: PlacedBetType): string {
  switch (type) {
    case "GAGNANT":
      return "Simple gagnant";
    case "PLACE":
      return "Simple place";
    case "COUPLE_GAGNANT":
      return "Couple gagnant";
    case "COUPLE_PLACE":
      return "Couple place";
    default:
      return type;
  }
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
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
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
      <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "16px" }}>
        <div style={{ ...shimmer, height: "120px", borderRadius: "16px" }} />
        <div style={{ ...shimmer, height: "200px", borderRadius: "16px" }} />
        <div style={{ display: "flex", gap: "12px" }}>
          <div style={{ ...shimmer, height: "120px", flex: 1, borderRadius: "12px" }} />
          <div style={{ ...shimmer, height: "120px", flex: 1, borderRadius: "12px" }} />
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
  const supabaseConfigured = hasSupabaseConfig();
  const reunion = params.reunion as string;
  const course = params.course as string;

  const [data, setData] = useState<APIResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [countdown, setCountdown] = useState("");
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Betting state
  const [showBetPanel, setShowBetPanel] = useState(false);
  const [betHorse, setBetHorse] = useState<ScoredParticipant | null>(null);
  const [betSecondHorse, setBetSecondHorse] = useState<ScoredParticipant | null>(null);
  const [betType, setBetType] = useState<PlacedBetType>("PLACE");
  const [betMise, setBetMise] = useState(2);
  const [betLoading, setBetLoading] = useState(false);
  const [betMessage, setBetMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/race/${reunion}/${course}`);
      const json: APIResponse = await res.json();
      setData(json);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [reunion, course]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /* Live countdown for locked prono */
  useEffect(() => {
    if (!data || data.pronoAvailable || data.isFinished) {
      if (countdownRef.current) clearInterval(countdownRef.current);
      return;
    }

    const heureDepart = data.courseInfo.heureDepart;
    const [h, m] = heureDepart.split(":").map(Number);

    function tick() {
      const now = new Date();
      const parisNow = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Paris" }));
      const target = new Date(parisNow);
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
  }, [data, fetchData]);

  /* ---------------------------------------------------------------- */
  /*  Shared styles                                                    */
  /* ---------------------------------------------------------------- */
  const pageStyle: React.CSSProperties = {
    maxWidth: "430px",
    margin: "0 auto",
    minHeight: "100vh",
    background: "#F5F5F5",
    fontFamily: "system-ui, -apple-system, sans-serif",
    paddingBottom: "80px",
    position: "relative",
  };

  const headerStyle: React.CSSProperties = {
    position: "sticky",
    top: 0,
    zIndex: 100,
    background: DARK,
    height: "56px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "0 16px",
  };

  const cardStyle: React.CSSProperties = {
    background: "#fff",
    borderRadius: "16px",
    boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
    padding: "20px",
    margin: "0 16px 16px",
  };

  const pillStyle: React.CSSProperties = {
    display: "inline-block",
    padding: "4px 10px",
    borderRadius: "20px",
    fontSize: "11px",
    fontWeight: 600,
    textTransform: "uppercase" as const,
    letterSpacing: "0.5px",
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
          style={{ position: "absolute", left: "16px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", width: "32px", height: "32px", borderRadius: "50%", background: "rgba(255,255,255,0.1)" }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
        </div>
        <div style={{ color: "#fff", fontWeight: 700, fontSize: "16px" }}>
          R{reunion}C{course}
          <span style={{ color: "#888", fontWeight: 400, marginLeft: "6px" }}>&middot; {hippo}</span>
        </div>
      </div>
    );
  }

  function RaceInfoCard({ dark }: { dark?: boolean }) {
    if (!data) return null;
    const ci = data.courseInfo;
    const bg = dark
      ? { background: "linear-gradient(135deg, #1A1A1A, #2D2D2D)" }
      : { background: "#fff" };
    const textColor = dark ? "#fff" : DARK;
    return (
      <div style={{ ...cardStyle, ...bg, color: textColor }}>
        <div style={{ fontWeight: 700, fontSize: "18px", marginBottom: "8px" }}>{ci.hippodrome}</div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginBottom: "8px" }}>
          <span style={{ ...pillStyle, background: dark ? "rgba(0,132,61,0.25)" : "#E8F5E9", color: GREEN }}>
            {disciplineLabel(ci.discipline)}
          </span>
          <span style={{ fontSize: "13px", color: dark ? "#bbb" : "#666" }}>{ci.distance}m</span>
          <span style={{ fontSize: "13px", color: dark ? "#bbb" : "#666" }}>&middot; {ci.nombrePartants} partants</span>
        </div>
        <div style={{ fontWeight: 700, color: GREEN, fontSize: "16px" }}>{ci.heureDepart}</div>
      </div>
    );
  }

  /* ---------- CASE 1: Prono locked ---------- */
  function LockedSection() {
    return (
      <div style={{ textAlign: "center", marginTop: "60px", padding: "0 32px" }}>
        <div style={{ fontSize: "64px", marginBottom: "16px" }}>&#x1F512;</div>
        <div style={{ fontWeight: 700, fontSize: "20px", color: DARK, marginBottom: "16px" }}>
          Pronostic verrouill&eacute;
        </div>
        <div style={{ fontWeight: 700, fontSize: "28px", color: GREEN, marginBottom: "12px", fontVariantNumeric: "tabular-nums" }}>
          Disponible dans {countdown || "--:--"}
        </div>
        <div style={{ fontSize: "14px", color: "#888", lineHeight: 1.5 }}>
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
    const confiance = a.scoreConfiance;
    const profils = a.profils;
    const parisRecommandes = a.parisRecommandes || [];

    return (
      <>
        {/* Result banner for finished races */}
        {data.isFinished && favori && <ResultBanner favori={favori} />}

        {/* A. Race Header Card */}
        <RaceInfoCard dark />

        {/* B. Favori Section */}
        {favori && confiance && (
          <div style={cardStyle}>
            <div style={{ ...pillStyle, background: "#E8F5E9", color: GREEN, marginBottom: "16px", fontSize: "11px", letterSpacing: "1px" }}>
              &#x2B50; FAVORI
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "16px" }}>
              <div style={{
                width: "48px", height: "48px", borderRadius: "50%", background: GREEN,
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#fff", fontWeight: 700, fontSize: "20px", flexShrink: 0,
              }}>
                {favori.numPmu}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: "24px", color: DARK, lineHeight: 1.2 }}>{favori.nom}</div>
                <div style={{ fontSize: "14px", color: "#888", marginTop: "2px" }}>
                  {data.courseInfo.estPlat
                    ? `J: ${favori.jockey || "N/A"}`
                    : `D: ${favori.driver || "N/A"}`}
                </div>
              </div>
            </div>

            {/* Confidence Gauge */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: "12px" }}>
              <ConfidenceGauge score={confiance.score} />
              <div style={{
                marginTop: "8px",
                ...pillStyle,
                background: confiance.niveau.emoji === "\uD83D\uDFE2" ? "#E8F5E9"
                  : confiance.niveau.emoji === "\uD83D\uDFE1" ? "#FFF8E1"
                  : confiance.niveau.emoji === "\uD83D\uDFE0" ? "#FFF3E0"
                  : "#FFEBEE",
                color: confiance.niveau.emoji === "\uD83D\uDFE2" ? GREEN
                  : confiance.niveau.emoji === "\uD83D\uDFE1" ? "#F57F17"
                  : confiance.niveau.emoji === "\uD83D\uDFE0" ? "#E65100"
                  : "#C62828",
              }}>
                {confiance.niveau.emoji} {confiance.niveau.label}
              </div>
            </div>
          </div>
        )}

        {/* C. Decision Card */}
        {reco && (
          <div style={{
            ...cardStyle,
            background: reco.vautLeCoup
              ? `linear-gradient(135deg, ${GREEN}, ${GREEN_DARK})`
              : "#FFF3CD",
            color: reco.vautLeCoup ? "#fff" : DARK,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
              <span style={{ fontSize: "32px" }}>{reco.emoji}</span>
              <span style={{ fontWeight: 700, fontSize: "18px" }}>{reco.decision}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {reco.raisonnement.map((r, i) => (
                <div key={i} style={{ fontSize: "13px", lineHeight: 1.5, opacity: reco.vautLeCoup ? 0.92 : 1 }}>
                  &bull; {r}
                </div>
              ))}
            </div>
          </div>
        )}

        {parisRecommandes.length > 0 && (
          <div style={cardStyle}>
            <div style={{ fontWeight: 700, fontSize: "16px", marginBottom: "16px" }}>
              Plans de paris IA
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {parisRecommandes.map((pari) => (
                <div
                  key={pari.type}
                  style={{
                    borderRadius: "14px",
                    padding: "14px",
                    background: "#FAFAFA",
                    border: "1px solid #EAEAEA",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
                    <div style={{ fontWeight: 700, fontSize: "15px", color: DARK }}>
                      {pari.emoji} {pari.label}
                    </div>
                    <span
                      style={{
                        ...pillStyle,
                        background: pari.surete >= 8 ? "#E8F5E9" : pari.surete >= 6 ? "#FFF3CD" : "#FFEBEE",
                        color: pari.surete >= 8 ? GREEN : pari.surete >= 6 ? "#B26A00" : "#C62828",
                      }}
                    >
                      Surete {pari.surete}/10
                    </span>
                  </div>

                  <div style={{ fontSize: "17px", fontWeight: 700, color: DARK, marginBottom: "8px" }}>
                    {pari.chevaux.map((cheval) => `N${cheval.numPmu} ${cheval.nom}`).join(" + ")}
                  </div>

                  <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "10px" }}>
                    <span style={{ fontSize: "12px", color: "#666" }}>Niveau: {pari.sureteLabel}</span>
                    <span style={{ fontSize: "12px", color: "#666" }}>Mise: {pari.miseConseillee}EUR</span>
                    <span style={{ fontSize: "12px", color: "#666" }}>
                      Cote estimee: {pari.coteEstimee ?? "N/A"}
                    </span>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "4px", marginBottom: "12px" }}>
                    {pari.pourquoi.map((reason, index) => (
                      <div key={index} style={{ fontSize: "12px", color: "#777", lineHeight: 1.45 }}>
                        - {reason}
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => openBetPanelFromRecommendation(pari)}
                    style={{
                      width: "100%",
                      padding: "12px",
                      borderRadius: "12px",
                      border: "none",
                      background: DARK,
                      color: "#fff",
                      fontSize: "14px",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    Jouer ce pari
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* D. Value & Profil Row */}
        {favori && (
          <div style={{ display: "flex", gap: "12px", margin: "0 16px 16px" }}>
            {/* Value Card */}
            {a.valueTop5[favori.numPmu] && (() => {
              const v = a.valueTop5[favori.numPmu];
              return (
                <div style={{ ...cardStyle, margin: 0, flex: 1, padding: "16px", borderRadius: "12px" }}>
                  <div style={{ fontSize: "11px", color: "#888", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "6px" }}>Value</div>
                  <div style={{ fontWeight: 700, fontSize: "24px", color: DARK }}>
                    {v.valueIndex} {v.emoji}
                  </div>
                  <div style={{ fontSize: "12px", color: "#888", marginTop: "4px" }}>{v.label}</div>
                  <div style={{ fontSize: "14px", color: GREEN, fontWeight: 600, marginTop: "8px" }}>
                    {v.miseConseillee}€
                  </div>
                </div>
              );
            })()}

            {/* Profil Card */}
            <div style={{ ...cardStyle, margin: 0, flex: 1, padding: "16px", borderRadius: "12px" }}>
              <div style={{ fontSize: "11px", color: "#888", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "6px" }}>Profil</div>
              <div style={{ fontWeight: 700, fontSize: "18px", color: DARK }}>
                {profils.beton ? "BETON" : profils.pepite ? "PEPITE" : profils.sniper ? "SNIPER" : "\u2014"}
              </div>
              <div style={{
                marginTop: "8px",
                ...pillStyle,
                background: profils.lisibilite === "LISIBLE" ? "#E8F5E9"
                  : profils.lisibilite === "COMPLEXE" ? "#FFF8E1"
                  : "#FFEBEE",
                color: profils.lisibilite === "LISIBLE" ? GREEN
                  : profils.lisibilite === "COMPLEXE" ? "#F57F17"
                  : "#C62828",
              }}>
                {profils.lisibilite}
              </div>
            </div>
          </div>
        )}

        {/* E. Cotes Section */}
        {favori && a.predictionsCotes[favori.numPmu] && (() => {
          const cotes = a.predictionsCotes[favori.numPmu];
          const tendanceColor = cotes.tendance === "BAISSE" || cotes.tendance === "BAISSE_FORTE"
            ? GREEN
            : cotes.tendance === "HAUSSE" ? "#D32F2F" : "#888";
          const tendanceArrow = cotes.tendance === "BAISSE" || cotes.tendance === "BAISSE_FORTE"
            ? "\u2193"
            : cotes.tendance === "HAUSSE" ? "\u2191" : "\u2194";
          return (
            <div style={cardStyle}>
              <div style={{ fontWeight: 700, fontSize: "16px", marginBottom: "16px" }}>
                &#x1F4CA; Pr&eacute;diction des cotes
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <span style={{ fontSize: "14px", color: "#666" }}>Cote matin</span>
                <span style={{ fontSize: "16px", fontWeight: 600 }}>{cotes.coteMatin ?? "N/A"}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <span style={{ fontSize: "14px", color: "#666" }}>Cote estim&eacute;e</span>
                <span style={{ fontSize: "18px", fontWeight: 700, color: GREEN }}>{cotes.coteEstimee ?? "N/A"}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{
                  ...pillStyle,
                  background: tendanceColor === GREEN ? "#E8F5E9" : tendanceColor === "#D32F2F" ? "#FFEBEE" : "#F5F5F5",
                  color: tendanceColor,
                }}>
                  {tendanceArrow} {cotes.tendance.replace("_", " ")}
                </span>
                <span style={{ fontSize: "13px", color: "#888" }}>{cotes.variation}</span>
              </div>
            </div>
          );
        })()}

        {/* F. Top 5 Classement */}
        {a.top5.length > 0 && (
          <div style={cardStyle}>
            <div style={{ fontWeight: 700, fontSize: "16px", marginBottom: "16px" }}>
              &#x1F3C6; Top 5
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {a.top5.map((horse, idx) => {
                const isFavori = favori && horse.numPmu === favori.numPmu;
                const maxScore = a.top5[0].scoreAlgo;
                const barWidth = maxScore > 0 ? (horse.scoreAlgo / maxScore) * 100 : 0;
                const cote = a.predictionsCotes[horse.numPmu];
                return (
                  <div
                    key={horse.numPmu}
                    style={{
                      padding: "12px",
                      borderRadius: "10px",
                      background: isFavori ? "#F8FFF8" : "#FAFAFA",
                      borderLeft: isFavori ? `4px solid ${GREEN}` : "4px solid transparent",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ fontSize: idx < 3 ? "18px" : "14px", fontWeight: 700, minWidth: "28px" }}>
                          {positionMedal(idx + 1)}
                        </span>
                        <span style={{ fontWeight: 700, fontSize: "15px", color: DARK }}>{horse.nom}</span>
                      </div>
                      <span style={{ fontWeight: 700, fontSize: "14px", color: DARK }}>{horse.scoreAlgo}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <div style={{ flex: 1, height: "8px", background: "#E0E0E0", borderRadius: "4px", overflow: "hidden" }}>
                        <div style={{
                          width: `${barWidth}%`,
                          height: "100%",
                          background: GREEN,
                          borderRadius: "4px",
                          transition: "width 0.6s ease",
                        }} />
                      </div>
                      {cote && (
                        <span style={{ fontSize: "12px", color: "#888", whiteSpace: "nowrap" }}>
                          @ {cote.coteEstimee ?? cote.coteMatin ?? "?"}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* G. Solidite du Favori */}
        {solidite && (
          <div style={cardStyle}>
            <div style={{ fontWeight: 700, fontSize: "16px", marginBottom: "16px" }}>
              &#x1F6E1;&#xFE0F; Solidit&eacute;
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
              <div style={{ flex: 1, height: "12px", background: "#E0E0E0", borderRadius: "6px", overflow: "hidden" }}>
                <div style={{
                  width: `${solidite.score}%`,
                  height: "100%",
                  borderRadius: "6px",
                  background: solidite.score >= 65 ? GREEN : solidite.score >= 45 ? "#FF9800" : "#D32F2F",
                  transition: "width 0.6s ease",
                }} />
              </div>
              <span style={{ fontWeight: 700, fontSize: "16px", color: DARK, minWidth: "40px", textAlign: "right" }}>
                {solidite.score}
              </span>
            </div>
            {solidite.pointsPositifs.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: solidite.alertes.length > 0 ? "12px" : "0" }}>
                {solidite.pointsPositifs.map((p, i) => (
                  <div key={i} style={{ fontSize: "13px", color: GREEN, lineHeight: 1.5 }}>
                    &#x2705; {p}
                  </div>
                ))}
              </div>
            )}
            {solidite.alertes.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {solidite.alertes.map((a, i) => (
                  <div key={i} style={{ fontSize: "13px", color: "#E65100", lineHeight: 1.5 }}>
                    &#x26A0;&#xFE0F; {a}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* H. BET BUTTON */}
        {!data.isFinished && favori && (
          <div style={{ margin: "0 16px 16px" }}>
            <button
              onClick={() => openBetPanel(favori)}
              style={{
                width: "100%",
                padding: "16px",
                borderRadius: "14px",
                border: "none",
                background: `linear-gradient(135deg, ${GREEN}, ${GREEN_DARK})`,
                color: "#fff",
                fontSize: "16px",
                fontWeight: 700,
                cursor: "pointer",
                boxShadow: "0 4px 16px rgba(0,132,61,0.3)",
              }}
            >
              &#127922; Parier sur cette course
            </button>
            {a.top5.length > 1 && (
              <div style={{ textAlign: "center", marginTop: "8px" }}>
                <span
                  onClick={() => openBetPanel(a.top5[1])}
                  style={{ fontSize: "13px", color: GREEN, cursor: "pointer", fontWeight: 600 }}
                >
                  ou parier sur {a.top5[1].nom} (2e choix)
                </span>
              </div>
            )}
          </div>
        )}

        {/* Bet success message */}
        {false && (
          <div style={{
            margin: "0 16px 16px", padding: "16px", borderRadius: "14px",
            background: "#E8F5E9", textAlign: "center",
          }}>
            <div style={{ fontSize: "24px", marginBottom: "4px" }}>&#9989;</div>
            <div style={{ fontWeight: 700, color: GREEN, fontSize: "15px" }}>Pari enregistré !</div>
            <div
              onClick={() => router.push("/mes-paris")}
              style={{ fontSize: "13px", color: GREEN, marginTop: "8px", cursor: "pointer", textDecoration: "underline" }}
            >
              Voir mes paris
            </div>
          </div>
        )}

        {betMessage && !showBetPanel && (
          <div style={{
            margin: "0 16px 16px", padding: "12px 16px", borderRadius: "12px",
            background: betMessage.type === "success" ? "#E8F5E9" : "#FFEBEE",
            color: betMessage.type === "success" ? GREEN : "#C62828",
            fontSize: "13px", fontWeight: 600, textAlign: "center",
          }}>
            {betMessage.text}
          </div>
        )}
      </>
    );
  }

  /* Result Banner for finished races */
  function ResultBanner({ favori }: { favori: ScoredParticipant }) {
    const ordre = favori.ordreArrivee;
    let bg: string;
    let text: string;

    if (ordre === 1) {
      bg = GREEN;
      text = "\uD83C\uDFC6 GAGNANT !";
    } else if (ordre !== null && ordre <= 3) {
      bg = "#FFD600";
      text = `\u2705 PLAC\u00c9 (${ordre}e)`;
    } else {
      bg = "#D32F2F";
      text = "\u274C Non plac\u00e9";
    }

    return (
      <div style={{
        margin: "0 16px 16px",
        padding: "16px",
        borderRadius: "12px",
        background: bg,
        textAlign: "center",
        color: ordre !== null && ordre <= 3 && ordre !== 1 ? DARK : "#fff",
        fontWeight: 700,
        fontSize: "20px",
      }}>
        {text}
      </div>
    );
  }

  function findRunnerByNum(numPmu: number) {
    return data?.analysis?.top5.find((runner) => runner.numPmu === numPmu) || null;
  }

  function openBetPanel(
    horse: ScoredParticipant,
    type: PlacedBetType = "PLACE",
    secondHorse: ScoredParticipant | null = null,
    mise = 2
  ) {
    setBetHorse(horse);
    setBetSecondHorse(secondHorse);
    setBetType(type);
    setBetMise(mise);
    setBetMessage(null);
    setShowBetPanel(true);
  }

  function openBetPanelFromRecommendation(pari: BetRecommendation) {
    if (!pari.chevaux.length) return;

    const firstHorse = findRunnerByNum(pari.chevaux[0].numPmu);
    const secondHorse = pari.chevaux[1] ? findRunnerByNum(pari.chevaux[1].numPmu) : null;

    if (!firstHorse) return;

    const typeMap: Record<BetRecommendationType, PlacedBetType> = {
      SIMPLE_GAGNANT: "GAGNANT",
      COUPLE_PLACE: "COUPLE_PLACE",
      COUPLE_GAGNANT: "COUPLE_GAGNANT",
    };

    openBetPanel(firstHorse, typeMap[pari.type], secondHorse, pari.miseConseillee || 2);
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
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setBetLoading(false);
      router.push(`/login?redirect=/course/${reunion}/${course}`);
      return;
    }

    const isCoupleBet = betType === "COUPLE_GAGNANT" || betType === "COUPLE_PLACE";
    if (isCoupleBet && !betSecondHorse) {
      setBetLoading(false);
      setBetMessage({ type: "error", text: "Choisissez le deuxieme cheval du couple." });
      return;
    }

    const primaryOdds = betHorse.cote || data.analysis?.predictionsCotes[betHorse.numPmu]?.coteEstimee || 2;
    const secondaryOdds = betSecondHorse
      ? betSecondHorse.cote || data.analysis?.predictionsCotes[betSecondHorse.numPmu]?.coteEstimee || 2.5
      : null;
    const cote = isCoupleBet
      ? betType === "COUPLE_GAGNANT"
        ? Math.round(Math.max(2.5, ((primaryOdds + (secondaryOdds || 0)) * 0.9)) * 10) / 10
        : Math.round(Math.max(1.4, ((primaryOdds + (secondaryOdds || 0)) * 0.35)) * 10) / 10
      : primaryOdds;
    const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Paris" }));
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
          cheval_num_2: isCoupleBet ? betSecondHorse?.numPmu : null,
          cheval_nom_2: isCoupleBet ? betSecondHorse?.nom : null,
          type_pari: betType,
          mise: betMise,
          cote,
        }),
      });
      const result = await res.json();
      if (result.success) {
        setBetMessage({ type: "success", text: `Pari placé ! Solde: ${result.solde}€` });
        setShowBetPanel(false);
      } else {
        setBetMessage({ type: "error", text: result.error || "Erreur" });
      }
    } catch {
      setBetMessage({ type: "error", text: "Erreur réseau" });
    } finally {
      setBetLoading(false);
    }
  }

  /* ---------- Bet Panel Overlay ---------- */
  function BetPanel() {
    if (!showBetPanel || !betHorse || !data) return null;
    const isCoupleBet = betType === "COUPLE_GAGNANT" || betType === "COUPLE_PLACE";
    const betTypeOptions: Array<{ value: PlacedBetType; label: string; helper: string }> = [
      { value: "PLACE", label: "Simple place", helper: "Le cheval finit dans les 3." },
      { value: "GAGNANT", label: "Simple gagnant", helper: "Le cheval doit gagner." },
      { value: "COUPLE_PLACE", label: "Couple place", helper: "Les 2 chevaux doivent finir dans les 3." },
      { value: "COUPLE_GAGNANT", label: "Couple gagnant", helper: "Les 2 chevaux doivent finir dans les 2." },
    ];
    const primaryOdds = betHorse.cote || data.analysis?.predictionsCotes[betHorse.numPmu]?.coteEstimee || 2;
    const secondaryOdds = betSecondHorse
      ? betSecondHorse.cote || data.analysis?.predictionsCotes[betSecondHorse.numPmu]?.coteEstimee || 2.5
      : null;
    const cote = isCoupleBet
      ? betType === "COUPLE_GAGNANT"
        ? Math.round(Math.max(2.5, ((primaryOdds + (secondaryOdds || 0)) * 0.9)) * 10) / 10
        : Math.round(Math.max(1.4, ((primaryOdds + (secondaryOdds || 0)) * 0.35)) * 10) / 10
      : primaryOdds;
    const gainPotentiel = betType === "GAGNANT"
      ? Math.round((betMise * cote - betMise) * 100) / 100
      : betType === "PLACE"
        ? Math.round((betMise * cote * 0.3 - betMise) * 100) / 100
      : Math.round((betMise * cote - betMise) * 100) / 100;
    const coupleCandidates = data.analysis?.top5.filter((runner) => runner.numPmu !== betHorse.numPmu) || [];
    const selectedType = betTypeOptions.find((option) => option.value === betType);

    return (
      <div style={{
        position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
        background: "rgba(0,0,0,0.5)", zIndex: 300,
        display: "flex", alignItems: "flex-end", justifyContent: "center",
      }} onClick={() => setShowBetPanel(false)}>
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            background: "#fff", borderRadius: "24px 24px 0 0",
            width: "100%", maxWidth: 430, padding: "24px 20px 32px",
          }}
        >
          {/* Handle */}
          <div style={{ width: 40, height: 4, background: "#ddd", borderRadius: 2, margin: "0 auto 20px" }} />

          <div style={{ fontWeight: 700, fontSize: 18, color: DARK, marginBottom: 16 }}>Placer un pari</div>

          {/* Horse info */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
            <div style={{
              width: 44, height: 44, borderRadius: "50%", background: GREEN,
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#fff", fontWeight: 700, fontSize: 18,
            }}>
              {betHorse.numPmu}
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16, color: DARK }}>{betHorse.nom}</div>
              <div style={{ fontSize: 13, color: "#888" }}>
                {getBetTypeLabel(betType)} - Cote estimee: {cote}
              </div>
            </div>
          </div>

          {isCoupleBet && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#555", marginBottom: 8 }}>
                Deuxieme cheval du couple
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {coupleCandidates.map((runner) => (
                  <button
                    key={runner.numPmu}
                    onClick={() => setBetSecondHorse(runner)}
                    style={{
                      padding: "10px 12px",
                      borderRadius: 12,
                      border: `2px solid ${betSecondHorse?.numPmu === runner.numPmu ? GREEN : "#E0E0E0"}`,
                      background: betSecondHorse?.numPmu === runner.numPmu ? "#E8F5E9" : "#fff",
                      color: betSecondHorse?.numPmu === runner.numPmu ? GREEN : "#555",
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    N{runner.numPmu} {runner.nom}
                  </button>
                ))}
              </div>
              <div style={{ marginTop: 10, fontSize: 12, color: betSecondHorse ? "#666" : "#C62828" }}>
                {betSecondHorse
                  ? `Selection: N${betHorse.numPmu} ${betHorse.nom} + N${betSecondHorse.numPmu} ${betSecondHorse.nom}`
                  : "Selectionnez le deuxieme cheval du couple."}
              </div>
            </div>
          )}

          {/* Type pari */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#555", marginBottom: 8 }}>Type de pari</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {betTypeOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => {
                    setBetType(option.value);
                    if (option.value === "COUPLE_GAGNANT" || option.value === "COUPLE_PLACE") {
                      setBetSecondHorse((current) => current || coupleCandidates[0] || null);
                    } else {
                      setBetSecondHorse(null);
                    }
                  }}
                  style={{
                    padding: "12px", borderRadius: 12,
                    border: `2px solid ${betType === option.value ? GREEN : "#E0E0E0"}`,
                    background: betType === option.value ? "#E8F5E9" : "#fff",
                    color: betType === option.value ? GREEN : "#888",
                    fontWeight: 700, fontSize: 14, cursor: "pointer", textAlign: "left",
                  }}
                >
                  <div>{option.label}</div>
                  <div style={{ fontSize: 11, fontWeight: 500, marginTop: 4, opacity: 0.8 }}>
                    {option.helper}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 16, fontSize: 12, color: "#666", lineHeight: 1.5 }}>
            {selectedType?.helper}
          </div>

          {/* Mise */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#555", marginBottom: 8 }}>Mise</div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, justifyContent: "center" }}>
              <button
                onClick={() => setBetMise(Math.max(1, betMise - 1))}
                style={{
                  width: 44, height: 44, borderRadius: 12, border: "2px solid #E0E0E0",
                  background: "#fff", fontSize: 20, fontWeight: 700, cursor: "pointer", color: DARK,
                }}
              >
                -
              </button>
              <div style={{ fontSize: 28, fontWeight: 700, color: DARK, minWidth: 60, textAlign: "center" }}>
                {betMise}€
              </div>
              <button
                onClick={() => setBetMise(Math.min(50, betMise + 1))}
                style={{
                  width: 44, height: 44, borderRadius: 12, border: "2px solid #E0E0E0",
                  background: "#fff", fontSize: 20, fontWeight: 700, cursor: "pointer", color: DARK,
                }}
              >
                +
              </button>
            </div>
          </div>

          {/* Gain potentiel */}
          <div style={{
            background: "#F5F5F5", borderRadius: 12, padding: "12px 16px",
            display: "flex", justifyContent: "space-between", marginBottom: 20,
          }}>
            <span style={{ fontSize: 14, color: "#666" }}>Gain potentiel</span>
            <span style={{ fontSize: 16, fontWeight: 700, color: gainPotentiel > 0 ? GREEN : "#C62828" }}>
              {gainPotentiel > 0 ? "+" : ""}{gainPotentiel}€
            </span>
          </div>

          {/* Submit */}
          <button
            onClick={handlePlaceBet}
            disabled={betLoading || (isCoupleBet && !betSecondHorse)}
            style={{
              width: "100%", padding: 16, borderRadius: 12,
              border: "none", background: betLoading || (isCoupleBet && !betSecondHorse) ? "#999" : GREEN,
              color: "#fff", fontSize: 16, fontWeight: 700, cursor: betLoading || (isCoupleBet && !betSecondHorse) ? "not-allowed" : "pointer",
            }}
          >
            {betLoading ? "Envoi..." : "Confirmer le pari"}
          </button>

          {betMessage && (
            <div style={{
              marginTop: 12, padding: "10px 16px", borderRadius: 12,
              background: betMessage.type === "success" ? "#E8F5E9" : "#FFEBEE",
              color: betMessage.type === "success" ? GREEN : "#C62828",
              fontSize: 13, fontWeight: 600, textAlign: "center",
            }}>
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
      { label: "Mes Paris", icon: "\uD83D\uDCB0", href: "/mes-paris", active: false },
      { label: "Bilan", icon: "\uD83D\uDCCA", href: "/bilan", active: false },
    ];
    return (
      <div style={{
        position: "fixed",
        bottom: 0,
        left: "50%",
        transform: "translateX(-50%)",
        width: "100%",
        maxWidth: "430px",
        height: "64px",
        background: "#fff",
        boxShadow: "0 -2px 12px rgba(0,0,0,0.08)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-around",
        zIndex: 200,
      }}>
        {tabs.map((tab) => (
          <div
            key={tab.label}
            onClick={() => { if (tab.href !== "#") router.push(tab.href); }}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "2px",
              cursor: "pointer",
              color: tab.active ? GREEN : "#888",
            }}
          >
            <span style={{ fontSize: "20px" }}>{tab.icon}</span>
            <span style={{ fontSize: "11px", fontWeight: tab.active ? 700 : 400 }}>{tab.label}</span>
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
        <div style={{ textAlign: "center", padding: "60px 20px", color: "#888" }}>
          <div style={{ fontSize: "48px", marginBottom: "16px" }}>&#x26A0;&#xFE0F;</div>
          <div style={{ fontWeight: 600, fontSize: "16px" }}>Course introuvable</div>
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
