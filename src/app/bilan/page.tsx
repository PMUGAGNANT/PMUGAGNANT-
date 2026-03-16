"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface CourseInfo {
  reunion: number;
  course: number;
  hippodrome: string;
  heureDepart: string;
}

interface HorseSelection {
  numPmu: number;
  nom: string;
}

interface BilanResult {
  courseInfo: CourseInfo;
  favori: HorseSelection;
  secondCheval?: HorseSelection | null;
  typePari?: string;
  recommandation: string;
  confiance: number;
  coteEstimee?: number | null;
  coteCheval?: number | null;
  coteSecondCheval?: number | null;
  resultat: "GAGNANT" | "PLACE" | "PERDU" | "INCONNU";
  ordreArrivee?: number;
  ordreArriveeSecond?: number;
}

interface BilanData {
  success: boolean;
  date: string;
  summary: {
    totalRaces: number;
    totalPlayed: number;
    totalPredictions?: number;
    wins: number;
    places: number;
    overallSuccess?: number;
    overallSuccessRate?: number;
    simplePlayed?: number;
    simpleWins?: number;
    simplePlaces?: number;
    simpleSuccess?: number;
    simpleSuccessRate?: number;
    couplePlayed?: number;
    coupleWins?: number;
    couplePlaces?: number;
    coupleSuccess?: number;
    coupleSuccessRate?: number;
    couplePlacePlayed?: number;
    couplePlaceSuccessRate?: number;
    coupleGagnantPlayed?: number;
    coupleGagnantSuccessRate?: number;
    bestType?: string | null;
    losses: number;
  };
  results: BilanResult[];
}

function SkeletonCards() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, padding: "0 16px", marginTop: 16 }}>
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          style={{
            background: "#fff",
            borderRadius: 16,
            padding: 16,
            boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
            textAlign: "center",
          }}
        >
          <div
            style={{
              width: 48,
              height: 12,
              background: "#e0e0e0",
              borderRadius: 6,
              margin: "0 auto 10px",
              animation: "pulse 1.5s ease-in-out infinite",
            }}
          />
          <div
            style={{
              width: 56,
              height: 28,
              background: "#e0e0e0",
              borderRadius: 8,
              margin: "0 auto",
              animation: "pulse 1.5s ease-in-out infinite",
            }}
          />
        </div>
      ))}
    </div>
  );
}

function getResultBorderColor(resultat: string): string {
  switch (resultat) {
    case "GAGNANT":
      return "#00843D";
    case "PLACE":
      return "#E67E22";
    case "PERDU":
      return "#E74C3C";
    default:
      return "#ccc";
  }
}

function getResultBadgeStyle(resultat: string): { bg: string; color: string } {
  switch (resultat) {
    case "GAGNANT":
      return { bg: "#E8F5E9", color: "#00843D" };
    case "PLACE":
      return { bg: "#FFF3CD", color: "#856404" };
    case "PERDU":
      return { bg: "#FDECEA", color: "#E74C3C" };
    default:
      return { bg: "#eee", color: "#888" };
  }
}

function getConfianceBadgeStyle(score: number): { bg: string; color: string } {
  const scaled = score * 10;
  if (scaled >= 75) return { bg: "#E8F5E9", color: "#00843D" };
  if (scaled >= 50) return { bg: "#FFF3CD", color: "#856404" };
  if (scaled >= 25) return { bg: "#FDECEA", color: "#E67E22" };
  return { bg: "#FDECEA", color: "#E74C3C" };
}

function getRecommandationEmoji(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes("couple place")) return "CP";
  if (lower.includes("couple gagnant")) return "CG";
  if (lower.includes("gagnant")) return "SG";
  if (lower.includes("jouer") || lower.includes("miser")) return "OK";
  if (lower.includes("prudence") || lower.includes("risqu")) return "!";
  if (lower.includes("eviter") || lower.includes("passer")) return "X";
  return "IA";
}

function formatTime(heureDepart: string): string {
  try {
    const d = new Date(heureDepart);
    if (isNaN(d.getTime())) return heureDepart;
    return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return heureDepart;
  }
}

function getSelectionLabel(result: BilanResult): string {
  if (result.secondCheval) {
    return `N${result.favori.numPmu} ${result.favori.nom} + N${result.secondCheval.numPmu} ${result.secondCheval.nom}`;
  }

  return `N${result.favori.numPmu} ${result.favori.nom}`;
}

function getResultDisplayLabel(result: BilanResult): string {
  const type = (result.typePari || "").toLowerCase();

  if (result.resultat === "GAGNANT") {
    if (type.includes("couple")) return "COUPLE GAGNANT";
    return "SIMPLE GAGNANT";
  }

  if (result.resultat === "PLACE") {
    if (type.includes("couple")) return "COUPLE PLACE";
    return "PLACE";
  }

  if (result.resultat === "PERDU") {
    if (type.includes("couple")) return "COUPLE PERDU";
    return "PERDU";
  }

  return "INCONNU";
}

function getArrivalLabel(result: BilanResult): string | null {
  if (!result.ordreArrivee && !result.ordreArriveeSecond) {
    return null;
  }

  const parts: string[] = [];
  if (result.ordreArrivee) {
    parts.push(`N${result.favori.numPmu} -> ${result.ordreArrivee}`);
  }
  if (result.secondCheval && result.ordreArriveeSecond) {
    parts.push(`N${result.secondCheval.numPmu} -> ${result.ordreArriveeSecond}`);
  }

  return parts.length ? `Arrivee: ${parts.join(" | ")}` : null;
}

function getOddsLabel(result: BilanResult): string | null {
  const parts: string[] = [];

  if (result.coteEstimee != null) {
    parts.push(`Cote IA ${result.coteEstimee}`);
  }

  if (result.secondCheval) {
    if (result.coteCheval != null) {
      parts.push(`N${result.favori.numPmu} @ ${result.coteCheval}`);
    }
    if (result.coteSecondCheval != null) {
      parts.push(`N${result.secondCheval.numPmu} @ ${result.coteSecondCheval}`);
    }
  } else if (result.coteCheval != null) {
    parts.push(`Cote cheval ${result.coteCheval}`);
  }

  return parts.length > 0 ? parts.join(" · ") : null;
}

function getResultPriority(resultat: BilanResult["resultat"]) {
  switch (resultat) {
    case "GAGNANT":
      return 0;
    case "PLACE":
      return 1;
    case "PERDU":
      return 2;
    default:
      return 3;
  }
}

export default function BilanPage() {
  const router = useRouter();
  const [data, setData] = useState<BilanData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch("/api/bilan")
      .then((res) => res.json())
      .then((json) => {
        if (json.success) {
          setData(json);
        } else {
          setError(true);
        }
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  const totalPlayed = data?.summary.totalPredictions ?? data?.summary.totalPlayed ?? 0;
  const wins = data?.summary.wins ?? 0;
  const places = data?.summary.places ?? 0;
  const losses = data?.summary.losses ?? 0;
  const overallSuccess = data?.summary.overallSuccess ?? wins + places;
  const overallSuccessRate = data?.summary.overallSuccessRate ?? 0;
  const simplePlayed = data?.summary.simplePlayed ?? 0;
  const simpleWins = data?.summary.simpleWins ?? 0;
  const simplePlaces = data?.summary.simplePlaces ?? 0;
  const simpleSuccess = data?.summary.simpleSuccess ?? wins + places;
  const simpleSuccessRate = data?.summary.simpleSuccessRate ?? 0;
  const couplePlayed = data?.summary.couplePlayed ?? 0;
  const coupleWins = data?.summary.coupleWins ?? 0;
  const couplePlaces = data?.summary.couplePlaces ?? 0;
  const coupleSuccess = data?.summary.coupleSuccess ?? 0;
  const coupleSuccessRate = data?.summary.coupleSuccessRate ?? 0;
  const bestType = data?.summary.bestType ?? null;
  const sortedResults = [...(data?.results ?? [])].sort((a, b) => {
    const priorityDiff = getResultPriority(a.resultat) - getResultPriority(b.resultat);
    if (priorityDiff !== 0) return priorityDiff;
    return `${a.courseInfo.reunion}-${a.courseInfo.course}`.localeCompare(
      `${b.courseInfo.reunion}-${b.courseInfo.course}`
    );
  });
  const winnerResults = sortedResults.filter((result) => result.resultat === "GAGNANT");
  const placedResults = sortedResults.filter((result) => result.resultat === "PLACE");
  const lostResults = sortedResults.filter((result) => result.resultat === "PERDU");

  let dayTone = {
    bg: "#FDECEA",
    color: "#E74C3C",
    title: "Journee difficile",
    text: "Peu de predictions ont tenu aujourd'hui.",
  };

  if (overallSuccessRate >= 55) {
    dayTone = {
      bg: "#E8F5E9",
      color: "#00843D",
      title: "Journee solide",
      text: "Les predictions du jour tiennent bien la route.",
    };
  } else if (overallSuccessRate >= 30) {
    dayTone = {
      bg: "#FFF3CD",
      color: "#856404",
      title: "Journee mitigee",
      text: "Il y a du dechet, mais certains signaux restent exploitables.",
    };
  }

  const bestTypeText = bestType
    ? `Type le plus fiable du jour: ${bestType}`
    : "Pas assez de recul pour designer un meilleur type.";

  const summaryCards = [
    { label: "Predictions IA", value: totalPlayed, color: "#1A1A1A" },
    { label: "Gagnants nets", value: wins, color: "#00843D" },
    { label: "Places", value: places, color: "#E67E22" },
    { label: "Perdus", value: losses, color: "#E74C3C" },
    { label: "Simples gagnants", value: simpleWins, color: "#00843D" },
    { label: "Simples places", value: simplePlaces, color: "#E67E22" },
    { label: "Couples gagnants", value: coupleWins, color: "#00843D" },
    { label: "Couples places", value: couplePlaces, color: "#E67E22" },
    { label: "Taux simples", value: `${simpleSuccessRate}%`, color: simpleSuccessRate >= 30 ? "#00843D" : "#E74C3C" },
    { label: "Taux couples", value: `${coupleSuccessRate}%`, color: coupleSuccessRate >= 20 ? "#00843D" : "#E74C3C" },
  ];

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f5f5f5",
        fontFamily: "system-ui, -apple-system, sans-serif",
        maxWidth: 430,
        margin: "0 auto",
        position: "relative",
      }}
    >
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>

      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 100,
          background: "#1A1A1A",
          height: 56,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span style={{ color: "#fff", fontWeight: 700, fontSize: 17 }}>
          Bilan du jour
        </span>
      </div>

      <div style={{ paddingBottom: 80 }}>
        {loading ? (
          <SkeletonCards />
        ) : error ? (
          <div style={{ textAlign: "center", padding: 40, color: "#E74C3C" }}>
            Erreur de chargement
          </div>
        ) : (
          <>
            <div
              style={{
                margin: "16px",
                padding: "18px",
                borderRadius: 18,
                background: "linear-gradient(135deg, #1A1A1A, #2F2F2F)",
                color: "#fff",
              }}
            >
              <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 6, letterSpacing: 0.3 }}>
                Lecture rapide
              </div>
              <div style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>
                {wins} gagnant{wins > 1 ? "s" : ""} visible{wins > 1 ? "s" : ""}
              </div>
              <div style={{ fontSize: 14, opacity: 0.92, lineHeight: 1.5 }}>
                {places} place{places > 1 ? "s" : ""}, {losses} perdu{losses > 1 ? "s" : ""}, meilleur type:
                {" "}
                <span style={{ color: "#7CFFB2", fontWeight: 700 }}>
                  {bestType ?? "Aucun net"}
                </span>
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
                padding: "0 16px",
                marginTop: 8,
              }}
            >
              {summaryCards.map((card) => (
                <div
                  key={card.label}
                  style={{
                    background: "#fff",
                    borderRadius: 16,
                    padding: 16,
                    boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                    textAlign: "center",
                  }}
                >
                  <div style={{ fontSize: 12, color: "#888", marginBottom: 4 }}>{card.label}</div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: card.color }}>{card.value}</div>
                </div>
              ))}
            </div>

            <div
              style={{
                margin: "16px",
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
              }}
            >
              <div
                style={{
                  background: "#E8F5E9",
                  borderRadius: 16,
                  padding: 16,
                  border: "1px solid #CDEBD6",
                }}
              >
                <div style={{ fontSize: 12, color: "#2E7D32", fontWeight: 700, marginBottom: 6 }}>
                  Gagnants du jour
                </div>
                <div style={{ fontSize: 28, fontWeight: 800, color: "#00843D", marginBottom: 4 }}>
                  {winnerResults.length}
                </div>
                <div style={{ fontSize: 12, color: "#2E7D32", lineHeight: 1.4 }}>
                  Les vrais gagnants sont mis en tete de liste juste en dessous.
                </div>
              </div>

              <div
                style={{
                  background: "#FFF8E1",
                  borderRadius: 16,
                  padding: 16,
                  border: "1px solid #F6E3A3",
                }}
              >
                <div style={{ fontSize: 12, color: "#9A6A00", fontWeight: 700, marginBottom: 6 }}>
                  Reussite globale
                </div>
                <div style={{ fontSize: 28, fontWeight: 800, color: overallSuccessRate >= 30 ? "#00843D" : "#C05C00", marginBottom: 4 }}>
                  {overallSuccessRate}%
                </div>
                <div style={{ fontSize: 12, color: "#9A6A00", lineHeight: 1.4 }}>
                  {overallSuccess} prediction{overallSuccess > 1 ? "s" : ""} tenue{overallSuccess > 1 ? "s" : ""} sur {totalPlayed}
                </div>
              </div>
            </div>

            <div
              style={{
                margin: "16px",
                padding: "14px 16px",
                borderRadius: 16,
                background: dayTone.bg,
                color: dayTone.color,
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>{dayTone.title}</div>
              <div style={{ fontSize: 13, lineHeight: 1.5 }}>{dayTone.text}</div>
              <div style={{ fontSize: 13, lineHeight: 1.5, marginTop: 6, fontWeight: 600 }}>{bestTypeText}</div>
            </div>

            <div style={{ fontWeight: 700, fontSize: 18, margin: "24px 16px 8px" }}>
              Resultats des predictions IA
            </div>

            <div
              style={{
                margin: "0 16px 12px",
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
              }}
            >
              <span
                style={{
                  background: "#E8F5E9",
                  color: "#00843D",
                  padding: "8px 12px",
                  borderRadius: 999,
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                Reussite globale: {overallSuccess}/{totalPlayed}
              </span>
              <span
                style={{
                  background: "#FFF3CD",
                  color: "#856404",
                  padding: "8px 12px",
                  borderRadius: 999,
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                Taux simples: {simpleSuccessRate}%
              </span>
              <span
                style={{
                  background: "#E3F2FD",
                  color: "#1565C0",
                  padding: "8px 12px",
                  borderRadius: 999,
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                Taux couples: {coupleSuccessRate}%
              </span>
            </div>

            {winnerResults.length > 0 && (
              <div style={{ margin: "0 16px 16px" }}>
                <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 10, color: "#00843D" }}>
                  Gagnants du jour
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {winnerResults.slice(0, 4).map((result, idx) => (
                    (() => {
                      const oddsLabel = getOddsLabel(result);
                      return (
                    <div
                      key={`winner-${result.courseInfo.reunion}-${result.courseInfo.course}-${idx}`}
                      style={{
                        background: "#FFFFFF",
                        borderRadius: 16,
                        padding: 14,
                        borderLeft: "5px solid #00843D",
                        boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 6 }}>
                        <div style={{ fontWeight: 700, color: "#1A1A1A" }}>
                          R{result.courseInfo.reunion}C{result.courseInfo.course} · {result.courseInfo.hippodrome}
                        </div>
                        <div style={{ fontSize: 12, color: "#666" }}>{formatTime(result.courseInfo.heureDepart)}</div>
                      </div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: "#00843D", marginBottom: 4 }}>
                        {getResultDisplayLabel(result)}
                      </div>
                      <div style={{ fontSize: 14, color: "#1A1A1A", fontWeight: 600 }}>
                        {getSelectionLabel(result)}
                      </div>
                      {oddsLabel && (
                        <div style={{ fontSize: 12, color: "#666", marginTop: 6, fontWeight: 600 }}>
                          {oddsLabel}
                        </div>
                      )}
                    </div>
                      );
                    })()
                  ))}
                </div>
              </div>
            )}

            {data && data.results.length === 0 ? (
              <div style={{ textAlign: "center", padding: "48px 24px" }}>
                <div style={{ fontSize: 64, marginBottom: 16 }}>Bilan</div>
                <div style={{ fontWeight: 700, fontSize: 18, color: "#1A1A1A", marginBottom: 8 }}>
                  Pas encore de resultats
                </div>
                <div style={{ fontSize: 14, color: "#888", lineHeight: 1.5 }}>
                  Les resultats apparaitront au fur et a mesure des courses.
                </div>
              </div>
            ) : (
              sortedResults.map((result, idx) => {
                const borderColor = getResultBorderColor(result.resultat);
                const badge = getResultBadgeStyle(result.resultat);
                const confianceBadge = getConfianceBadgeStyle(result.confiance);
                const emoji = getRecommandationEmoji(result.recommandation);
                const arrivalLabel = getArrivalLabel(result);
                const oddsLabel = getOddsLabel(result);

                return (
                  <div
                    key={`${result.courseInfo.reunion}-${result.courseInfo.course}-${result.typePari || "simple"}-${idx}`}
                    style={{
                      background: "#fff",
                      borderRadius: 16,
                      margin: "8px 16px",
                      padding: 16,
                      boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                      borderLeft: `4px solid ${borderColor}`,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: 6,
                      }}
                    >
                      <span style={{ fontWeight: 700, fontSize: 15, color: "#1A1A1A" }}>
                        R{result.courseInfo.reunion}C{result.courseInfo.course} · {result.courseInfo.hippodrome}
                      </span>
                      <span style={{ fontSize: 13, color: "#888" }}>
                        {formatTime(result.courseInfo.heureDepart)}
                      </span>
                    </div>

                    <div style={{ fontSize: 12, color: "#888", marginBottom: 4, fontWeight: 600 }}>
                      {result.typePari || "Simple gagnant"}
                    </div>

                    <div style={{ fontWeight: 700, fontSize: 16, color: "#1A1A1A", marginBottom: 6 }}>
                      {getSelectionLabel(result)}
                    </div>

                    {arrivalLabel && (
                      <div style={{ fontSize: 12, color: "#666", marginBottom: 8 }}>
                        {arrivalLabel}
                      </div>
                    )}

                    {oddsLabel && (
                      <div style={{ fontSize: 12, color: "#666", marginBottom: 8, fontWeight: 600 }}>
                        {oddsLabel}
                      </div>
                    )}

                    <div style={{ fontSize: 13, color: "#888", marginBottom: 8 }}>
                      {emoji} {result.recommandation || "-"}
                    </div>

                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <span
                        style={{
                          display: "inline-block",
                          background: confianceBadge.bg,
                          color: confianceBadge.color,
                          fontWeight: 600,
                          fontSize: 12,
                          padding: "4px 10px",
                          borderRadius: 20,
                        }}
                      >
                        Confiance {result.confiance ?? "-"} /10
                      </span>
                      <span
                        style={{
                          display: "inline-block",
                          background: badge.bg,
                          color: badge.color,
                          fontWeight: 700,
                          fontSize: 12,
                          padding: "4px 12px",
                          borderRadius: 20,
                        }}
                      >
                        {getResultDisplayLabel(result)}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </>
        )}
      </div>

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
          <span style={{ fontSize: 22 }}>Courses</span>
          <span style={{ fontSize: 11, color: "#888", fontWeight: 500 }}>Courses</span>
        </div>

        <div
          onClick={() => router.push("/live")}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            cursor: "pointer",
            gap: 2,
          }}
        >
          <span style={{ fontSize: 22 }}>Live</span>
          <span style={{ fontSize: 11, color: "#888", fontWeight: 500 }}>Live</span>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            cursor: "pointer",
            gap: 2,
            position: "relative",
          }}
        >
          <span style={{ fontSize: 22 }}>Bilan</span>
          <span style={{ fontSize: 11, color: "#00843D", fontWeight: 700 }}>Bilan</span>
          <div
            style={{
              width: 5,
              height: 5,
              borderRadius: "50%",
              background: "#00843D",
              position: "absolute",
              bottom: -4,
            }}
          />
        </div>
      </div>
    </div>
  );
}
