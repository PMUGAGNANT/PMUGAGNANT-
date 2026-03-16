"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface CourseInfo {
  reunion: number;
  course: number;
  hippodrome: string;
  heureDepart: string;
}

interface Favori {
  numPmu: number;
  nom: string;
}

interface BilanResult {
  courseInfo: CourseInfo;
  favori: Favori;
  recommandation: string;
  confiance: number;
  resultat: "GAGNANT" | "PLACE" | "PERDU" | "INCONNU";
  ordreArrivee?: number;
}

interface BilanData {
  success: boolean;
  date: string;
  summary: {
    totalRaces: number;
    totalPlayed: number;
    wins: number;
    places: number;
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
            textAlign: "center" as const,
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
    case "GAGNANT": return "#00843D";
    case "PLACE": return "#E67E22";
    case "PERDU": return "#E74C3C";
    default: return "#ccc";
  }
}

function getResultBadgeStyle(resultat: string): { bg: string; color: string } {
  switch (resultat) {
    case "GAGNANT": return { bg: "#E8F5E9", color: "#00843D" };
    case "PLACE": return { bg: "#FFF3CD", color: "#856404" };
    case "PERDU": return { bg: "#FDECEA", color: "#E74C3C" };
    default: return { bg: "#eee", color: "#888" };
  }
}

function getConfianceBadgeStyle(conf: any): { bg: string; color: string } {
  const score = typeof conf === 'number' ? conf : conf?.score ?? 0;
  const scaled = score * 10; // score is 0-10, scale to 0-100
  if (scaled >= 75) return { bg: "#E8F5E9", color: "#00843D" };
  if (scaled >= 50) return { bg: "#FFF3CD", color: "#856404" };
  if (scaled >= 25) return { bg: "#FDECEA", color: "#E67E22" };
  return { bg: "#FDECEA", color: "#E74C3C" };
}

function getRecommandationEmoji(rec: any): string {
  const text = typeof rec === 'string' ? rec : rec?.decision || '';
  const lower = text.toLowerCase();
  if (lower.includes("jouer") || lower.includes("miser")) return "✅";
  if (lower.includes("prudence") || lower.includes("risqu")) return "⚠️";
  if (lower.includes("éviter") || lower.includes("passer")) return "❌";
  return "💡";
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

  const totalPlayed = data?.summary.totalPlayed ?? 0;
  const wins = data?.summary.wins ?? 0;
  const places = data?.summary.places ?? 0;

  let roiText = "—";
  let roiColor = "#1A1A1A";
  if (totalPlayed > 0) {
    const roi = ((wins * 2 + places * 0.5 - totalPlayed) / totalPlayed) * 100;
    roiText = roi >= 0 ? `+${roi.toFixed(0)}%` : `${roi.toFixed(0)}%`;
    roiColor = roi >= 0 ? "#00843D" : "#E74C3C";
  }

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

      {/* HEADER */}
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
          📊 Bilan du jour
        </span>
      </div>

      {/* CONTENT */}
      <div style={{ paddingBottom: 80 }}>
        {/* STATS SECTION */}
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
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
                padding: "0 16px",
                marginTop: 16,
              }}
            >
              {/* Card 1 - Jouées */}
              <div
                style={{
                  background: "#fff",
                  borderRadius: 16,
                  padding: 16,
                  boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: 12, color: "#888", marginBottom: 4 }}>Jouées</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: "#1A1A1A" }}>
                  {totalPlayed}
                </div>
              </div>

              {/* Card 2 - Gagnants */}
              <div
                style={{
                  background: "#fff",
                  borderRadius: 16,
                  padding: 16,
                  boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: 12, color: "#888", marginBottom: 4 }}>Gagnants</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: "#00843D" }}>
                  {wins}
                </div>
              </div>

              {/* Card 3 - Placés */}
              <div
                style={{
                  background: "#fff",
                  borderRadius: 16,
                  padding: 16,
                  boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: 12, color: "#888", marginBottom: 4 }}>Placés</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: "#E67E22" }}>
                  {places}
                </div>
              </div>

              {/* Card 4 - ROI */}
              <div
                style={{
                  background: "#fff",
                  borderRadius: 16,
                  padding: 16,
                  boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: 12, color: "#888", marginBottom: 4 }}>ROI</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: roiColor }}>
                  {roiText}
                </div>
              </div>
            </div>

            {/* RESULTS LIST */}
            <div style={{ fontWeight: 700, fontSize: 18, margin: "24px 16px 8px" }}>
              Résultats
            </div>

            {data && data.results.length === 0 ? (
              /* EMPTY STATE */
              <div
                style={{
                  textAlign: "center",
                  padding: "48px 24px",
                }}
              >
                <div style={{ fontSize: 64, marginBottom: 16 }}>🏇</div>
                <div style={{ fontWeight: 700, fontSize: 18, color: "#1A1A1A", marginBottom: 8 }}>
                  Pas encore de résultats
                </div>
                <div style={{ fontSize: 14, color: "#888", lineHeight: 1.5 }}>
                  Les résultats apparaîtront au fur et à mesure des courses
                </div>
              </div>
            ) : (
              data?.results.map((r, idx) => {
                const borderColor = getResultBorderColor(r.resultat);
                const badge = getResultBadgeStyle(r.resultat);
                const confianceBadge = getConfianceBadgeStyle(r.confiance);
                const emoji = getRecommandationEmoji(r.recommandation);

                return (
                  <div
                    key={idx}
                    style={{
                      background: "#fff",
                      borderRadius: 16,
                      margin: "8px 16px",
                      padding: 16,
                      boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                      borderLeft: `4px solid ${borderColor}`,
                    }}
                  >
                    {/* Top line */}
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: 6,
                      }}
                    >
                      <span style={{ fontWeight: 700, fontSize: 15, color: "#1A1A1A" }}>
                        R{r.courseInfo.reunion}C{r.courseInfo.course} · {r.courseInfo.hippodrome}
                      </span>
                      <span style={{ fontSize: 13, color: "#888" }}>
                        {formatTime(r.courseInfo.heureDepart)}
                      </span>
                    </div>

                    {/* Horse line */}
                    <div style={{ fontWeight: 700, fontSize: 16, color: "#1A1A1A", marginBottom: 6 }}>
                      N°{r.favori.numPmu} {r.favori.nom}
                    </div>

                    {/* Decision */}
                    <div style={{ fontSize: 13, color: "#888", marginBottom: 8 }}>
                      {emoji} {r.recommandation || '—'}
                    </div>

                    {/* Confiance + Result badge */}
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
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
                        Confiance {r.confiance ?? '—'}/10
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
                        {r.resultat}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </>
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
          height: 64,
          background: "#fff",
          borderTop: "1px solid #eee",
          display: "flex",
          justifyContent: "space-around",
          alignItems: "center",
          zIndex: 200,
        }}
      >
        {/* Courses tab */}
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

        {/* Live tab */}
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
          <span style={{ fontSize: 22 }}>⚡</span>
          <span style={{ fontSize: 11, color: "#888", fontWeight: 500 }}>Live</span>
        </div>

        {/* Bilan tab (ACTIVE) */}
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
          <span style={{ fontSize: 22 }}>📊</span>
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
