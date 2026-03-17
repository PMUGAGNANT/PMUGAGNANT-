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

function formatWeight(poids?: number | null): string | null {
  if (poids === null || poids === undefined || Number.isNaN(poids)) return null;
  return `${poids.toFixed(1).replace(".", ",")} kg`;
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
  const [betType, setBetType] = useState<"GAGNANT" | "PLACE">("PLACE");
  const [betMise, setBetMise] = useState(2);
  const [betLoading, setBetLoading] = useState(false);
  const [betMessage, setBetMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [alreadyBet, setAlreadyBet] = useState(false);

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
    background: "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(248,250,251,1) 100%)",
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
          style={{ position: "absolute", left: "16px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", width: "32px", height: "32px", borderRadius: "50%", background: "rgba(255,255,255,0.1)" }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
        </div>
        <div style={{ color: "#fff", fontWeight: 800, fontSize: "17px", letterSpacing: "-0.3px" }}>
          R{reunion}C{course}
          <span style={{ color: "rgba(255,255,255,0.56)", fontWeight: 500, marginLeft: "6px" }}>&middot; {hippo}</span>
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
        <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: dark ? "#7ee7a8" : GREEN, marginBottom: 10 }}>
          Course premium
        </div>
        <div style={{ fontWeight: 800, fontSize: "24px", lineHeight: "28px", marginBottom: "8px", letterSpacing: "-0.6px" }}>{ci.nomCourse}</div>
        <div style={{ fontWeight: 700, fontSize: "15px", marginBottom: "12px", color: dark ? "rgba(255,255,255,0.76)" : "#475569" }}>{ci.hippodrome}</div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginBottom: "12px" }}>
          <span style={{ ...pillStyle, background: dark ? "rgba(0,132,61,0.25)" : "#E8F5E9", color: GREEN }}>
            {disciplineLabel(ci.discipline)}
          </span>
          <span style={{ ...pillStyle, background: dark ? "rgba(255,255,255,0.08)" : "#F3F4F6", color: dark ? "#fff" : "#334155" }}>{ci.distance}m</span>
          <span style={{ ...pillStyle, background: dark ? "rgba(255,255,255,0.08)" : "#F3F4F6", color: dark ? "#fff" : "#334155" }}>{ci.nombrePartants} partants</span>
          {ci.allocation > 0 && (
            <span style={{ ...pillStyle, background: dark ? "rgba(255,215,0,0.12)" : "#FFF8E1", color: dark ? "#FFD54F" : "#B27500" }}>
              Allocation {ci.allocation.toLocaleString("fr-FR")} EUR
            </span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <div style={{ fontWeight: 800, color: dark ? "#FFFFFF" : DARK, fontSize: "34px", lineHeight: "36px", letterSpacing: "-1px" }}>{ci.heureDepart}</div>
          <div style={{ fontSize: "13px", color: dark ? "rgba(255,255,255,0.68)" : "#64748B" }}>depart officiel</div>
        </div>
      </div>
    );
  }

  /* ---------- CASE 1: Prono locked ---------- */
  function LockedSection() {
    return (
      <div style={{ textAlign: "center", marginTop: "48px", padding: "0 24px" }}>
        <div style={{ fontSize: "64px", marginBottom: "18px" }}>&#x1F512;</div>
        <div style={{ fontWeight: 700, fontSize: "20px", color: DARK, marginBottom: "16px" }}>
          Pronostic verrouill&eacute;
        </div>
        <div style={{ fontWeight: 800, fontSize: "32px", color: GREEN, marginBottom: "12px", fontVariantNumeric: "tabular-nums", letterSpacing: "-1px" }}>
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
    const confiance = a.scoreConfiance;
    const profils = a.profils;

    return (
      <>
        {/* Result banner for finished races */}
        {data.isFinished && favori && <ResultBanner favori={favori} />}

        {/* A. Race Header Card */}
        <RaceInfoCard dark />

        {/* B. Favori Section */}
        {favori && confiance && (
          <div style={{ ...cardStyle, background: "radial-gradient(circle at top right, rgba(0,132,61,0.12), transparent 26%), linear-gradient(180deg, #FFFFFF 0%, #F7FBF8 100%)" }}>
            <div style={{ ...pillStyle, background: "#E8F5E9", color: GREEN, marginBottom: "16px", fontSize: "11px", letterSpacing: "1px" }}>
              &#x2B50; FAVORI
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "18px", marginBottom: "18px" }}>
              <div style={{
                width: "58px", height: "58px", borderRadius: "18px", background: "linear-gradient(135deg, #00843D, #0D6B3A)",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#fff", fontWeight: 800, fontSize: "24px", flexShrink: 0,
                boxShadow: "0 14px 24px rgba(0,132,61,0.22)",
              }}>
                {favori.numPmu}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800, fontSize: "28px", color: DARK, lineHeight: 1.05, letterSpacing: "-0.8px" }}>{favori.nom}</div>
                <div style={{ fontSize: "14px", color: "#64748B", marginTop: "6px" }}>
                  {data.courseInfo.estPlat
                    ? `Jockey: ${favori.jockey || "N/A"}`
                    : `Driver: ${favori.driver || "N/A"}`}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: "8px" }}>
                  {favori.placeCorde ? (
                    <span style={{ ...pillStyle, background: "#F3F4F6", color: "#475569" }}>
                      Stalle {favori.placeCorde}
                    </span>
                  ) : null}
                  {formatWeight(favori.poids) ? (
                    <span style={{ ...pillStyle, background: "#FFF8E1", color: "#A66B00" }}>
                      Poids {formatWeight(favori.poids)}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>

            {/* Confidence Gauge */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", marginBottom: "4px" }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, color: "#64748B", marginBottom: 10, lineHeight: 1.5 }}>
                  Lecture principale de l&apos;algo sur cette course. Plus la note est haute, plus le favori ressort proprement.
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  <div style={{
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
                  <div style={{ ...pillStyle, background: "#EEF2FF", color: "#4338CA" }}>
                    Score {confiance.score}/10
                  </div>
                </div>
              </div>
              <div style={{ flexShrink: 0 }}>
                <ConfidenceGauge score={confiance.score} />
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
                        <div>
                          <div style={{ fontWeight: 700, fontSize: "15px", color: DARK }}>{horse.nom}</div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
                            {horse.placeCorde ? (
                              <span style={{ fontSize: "11px", color: "#64748B", fontWeight: 600 }}>
                                Stalle {horse.placeCorde}
                              </span>
                            ) : null}
                            {formatWeight(horse.poids) ? (
                              <span style={{ fontSize: "11px", color: "#A66B00", fontWeight: 700 }}>
                                Poids {formatWeight(horse.poids)}
                              </span>
                            ) : null}
                          </div>
                        </div>
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

        {/* H. Lecture Algo */}
        {confiance && (
          <div style={cardStyle}>
            <div style={{ fontWeight: 700, fontSize: "16px", marginBottom: "16px" }}>
              &#x1F9E0; Lecture de l&apos;algo
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "14px" }}>
              <span style={{
                ...pillStyle,
                background: profils.lisibilite === "LISIBLE" ? "#E8F5E9"
                  : profils.lisibilite === "COMPLEXE" ? "#FFF8E1"
                  : "#FFEBEE",
                color: profils.lisibilite === "LISIBLE" ? GREEN
                  : profils.lisibilite === "COMPLEXE" ? "#F57F17"
                  : "#C62828",
              }}>
                Lisibilite {profils.lisibilite}
              </span>
              <span style={{
                ...pillStyle,
                background: profils.beton ? "#E8F5E9" : profils.pepite ? "#E3F2FD" : profils.sniper ? "#FFF3E0" : "#F5F5F5",
                color: profils.beton ? GREEN : profils.pepite ? "#1565C0" : profils.sniper ? "#E67E22" : "#666",
              }}>
                Profil {profils.beton ? "BETON" : profils.pepite ? "PEPITE" : profils.sniper ? "SNIPER" : "NEUTRE"}
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {confiance.facteurs.slice(0, 4).map((facteur, index) => (
                <div
                  key={index}
                  style={{
                    fontSize: "13px",
                    color: "#555",
                    lineHeight: 1.5,
                    padding: "10px 12px",
                    borderRadius: "10px",
                    background: "#FAFAFA",
                    border: "1px solid #EEEEEE",
                  }}
                >
                  {facteur}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* I. BET BUTTON */}
        {!data.isFinished && favori && !alreadyBet && (
          <div style={{ margin: "0 16px 16px" }}>
            <button
              onClick={() => openBetPanel(favori)}
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
        {alreadyBet && (
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

    const cote = betHorse.cote || data.analysis?.predictionsCotes[betHorse.numPmu]?.coteEstimee || 2;
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
          type_pari: betType,
          mise: betMise,
          cote,
        }),
      });
      const result = await res.json();
      if (result.success) {
        setBetMessage({ type: "success", text: `Pari placé ! Solde: ${result.solde}€` });
        setAlreadyBet(true);
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
    const cote = betHorse.cote || data.analysis?.predictionsCotes[betHorse.numPmu]?.coteEstimee || 2;
    const gainPotentiel = betType === "GAGNANT"
      ? Math.round((betMise * cote - betMise) * 100) / 100
      : Math.round((betMise * cote * 0.3 - betMise) * 100) / 100;

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
              <div style={{ fontSize: 13, color: "#888" }}>Cote: {cote}</div>
              {(betHorse.placeCorde || formatWeight(betHorse.poids)) && (
                <div style={{ fontSize: 12, color: "#64748B", marginTop: 4 }}>
                  {[betHorse.placeCorde ? `Stalle ${betHorse.placeCorde}` : null, formatWeight(betHorse.poids) ? `Poids ${formatWeight(betHorse.poids)}` : null]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
              )}
            </div>
          </div>

          {/* Type pari */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#555", marginBottom: 8 }}>Type de pari</div>
            <div style={{ display: "flex", gap: 8 }}>
              {(["PLACE", "GAGNANT"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setBetType(t)}
                  style={{
                    flex: 1, padding: "12px", borderRadius: 12,
                    border: `2px solid ${betType === t ? GREEN : "#E0E0E0"}`,
                    background: betType === t ? "#E8F5E9" : "#fff",
                    color: betType === t ? GREEN : "#888",
                    fontWeight: 700, fontSize: 14, cursor: "pointer",
                  }}
                >
                  {t === "PLACE" ? "Placé (Top 3)" : "Gagnant (1er)"}
                </button>
              ))}
            </div>
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
            disabled={betLoading}
            style={{
              width: "100%", padding: 16, borderRadius: 12,
              border: "none", background: betLoading ? "#999" : GREEN,
              color: "#fff", fontSize: 16, fontWeight: 700, cursor: betLoading ? "not-allowed" : "pointer",
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
        height: "70px",
        background: "rgba(255,255,255,0.92)",
        backdropFilter: "blur(18px)",
        borderTop: "1px solid rgba(15,23,42,0.08)",
        boxShadow: "0 -14px 30px rgba(15,23,42,0.08)",
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
              color: tab.active ? GREEN : "#64748B",
            }}
          >
            <span style={{ fontSize: "20px" }}>{tab.icon}</span>
            <span style={{ fontSize: "11px", fontWeight: tab.active ? 800 : 600 }}>{tab.label}</span>
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
