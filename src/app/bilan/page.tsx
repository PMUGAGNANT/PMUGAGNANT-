"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

interface CourseInfo {
  reunion: number;
  course: number;
  hippodrome: string;
  heureDepart: string;
  discipline: string;
  nomCourse: string;
}

interface PickInfo {
  numPmu: number;
  nom: string;
  cotePmu: number | null;
  coteEstimee: number | null;
}

interface BilanResult {
  courseInfo: CourseInfo;
  favori: PickInfo;
  recommandation: string;
  confiance: number;
  resultat: "GAGNANT" | "PLACE" | "PERDU" | "INCONNU";
  ordreArrivee?: number | null;
  gainPour1Euro: number | null;
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
    successRate: number;
  };
  expert: {
    healthLabel: string;
    bestDiscipline: { discipline: string; played: number; success: number; rate: number } | null;
    worstDiscipline: { discipline: string; played: number; success: number; rate: number } | null;
    bestConfidenceBucket: { bucket: string; label: string; played: number; success: number; rate: number } | null;
    worstConfidenceBucket: { bucket: string; label: string; played: number; success: number; rate: number } | null;
    confidenceBuckets: Array<{ bucket: string; label: string; played: number; success: number; rate: number }>;
    disciplineBreakdown: Array<{ discipline: string; played: number; success: number; rate: number }>;
    insights: string[];
  };
  results: BilanResult[];
}

const GREEN = "#00843D";
const GREEN_DARK = "#006B31";
const GOLD = "#D4A017";
const RED = "#D64545";
const DARK = "#161616";

function disciplineLabel(discipline: string): string {
  if (discipline.includes("TROT_ATTELE")) return "Trot Attele";
  if (discipline.includes("TROT_MONTE")) return "Trot Monte";
  if (discipline === "PLAT") return "Plat";
  if (discipline.includes("OBSTACLE") || discipline.includes("HAIES") || discipline.includes("STEEPLE")) {
    return "Obstacle";
  }
  return discipline || "Autre";
}

function resultLabel(resultat: BilanResult["resultat"]): string {
  if (resultat === "GAGNANT") return "Simple gagnant";
  if (resultat === "PLACE") return "Simple place";
  if (resultat === "PERDU") return "Perdu";
  return "En attente";
}

function getResultStyle(resultat: BilanResult["resultat"]) {
  if (resultat === "GAGNANT") {
    return {
      border: GREEN,
      soft: "#E8F5E9",
      strong: GREEN,
      badge: "#E8F5E9",
      badgeText: GREEN,
    };
  }

  if (resultat === "PLACE") {
    return {
      border: GOLD,
      soft: "#FFF7E0",
      strong: "#A66B00",
      badge: "#FFF3CD",
      badgeText: "#8A5A00",
    };
  }

  return {
    border: RED,
    soft: "#FDECEA",
    strong: RED,
    badge: "#FDECEA",
    badgeText: RED,
  };
}

function getHealthTone(successRate: number) {
  if (successRate >= 45) {
    return { background: "linear-gradient(135deg, #0F9D58, #0B7A44)", text: "#FFFFFF", soft: "#E8F5E9" };
  }

  if (successRate >= 30) {
    return { background: "linear-gradient(135deg, #E0A800, #C78F00)", text: "#FFFFFF", soft: "#FFF8E1" };
  }

  return { background: "linear-gradient(135deg, #D64545, #B83434)", text: "#FFFFFF", soft: "#FDECEA" };
}

function getConfianceStyle(score: number) {
  if (score >= 7.5) return { background: "#E8F5E9", color: GREEN };
  if (score >= 5.5) return { background: "#FFF8E1", color: "#A66B00" };
  return { background: "#FDECEA", color: RED };
}

function formatTime(heureDepart: string): string {
  return heureDepart;
}

function formatOdds(value: number | null): string {
  if (value === null || value === undefined) return "-";
  const normalized = Number(value);
  if (!Number.isFinite(normalized)) return "-";
  return normalized.toFixed(1);
}

function formatEuroReturn(value: number | null): string {
  if (value === null || value === undefined) return "-";
  const normalized = Number(value);
  if (!Number.isFinite(normalized)) return "-";
  return `${normalized.toFixed(2)} EUR`;
}

function SummaryCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string | number;
  tone?: "default" | "good" | "warn" | "bad";
}) {
  const colors =
    tone === "good"
      ? { background: "#FFFFFF", value: GREEN }
      : tone === "warn"
        ? { background: "#FFFFFF", value: "#B27500" }
        : tone === "bad"
          ? { background: "#FFFFFF", value: RED }
          : { background: "#FFFFFF", value: DARK };

  return (
    <div
      style={{
        background: colors.background,
        borderRadius: 22,
        padding: 18,
        border: "1px solid rgba(15,23,42,0.05)",
        boxShadow: "0 16px 32px rgba(17, 24, 39, 0.07)",
      }}
    >
      <div style={{ fontSize: 12, color: "#7A7A7A", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: 34, fontWeight: 800, lineHeight: "36px", color: colors.value, letterSpacing: "-0.8px" }}>{value}</div>
    </div>
  );
}

function SkeletonCards() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, padding: "16px" }}>
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          key={index}
          style={{
            height: 112,
            borderRadius: 20,
            background: "linear-gradient(90deg, #ECECEC 25%, #F7F7F7 50%, #ECECEC 75%)",
            backgroundSize: "200% 100%",
            animation: "shimmer 1.6s linear infinite",
          }}
        />
      ))}
    </div>
  );
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

  const winners = useMemo(
    () => data?.results.filter((result) => result.resultat === "GAGNANT") ?? [],
    [data]
  );
  const placed = useMemo(
    () => data?.results.filter((result) => result.resultat === "PLACE") ?? [],
    [data]
  );

  const successRate = data?.summary.successRate ?? 0;
  const healthTone = getHealthTone(successRate);

  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top left, rgba(0,132,61,0.12), transparent 26%), radial-gradient(circle at top right, rgba(18,183,106,0.1), transparent 18%), #F6F7F8",
        maxWidth: 430,
        margin: "0 auto",
        position: "relative",
      }}
    >
      <style>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>

      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 100,
          background: "rgba(18, 22, 26, 0.88)",
          backdropFilter: "blur(18px)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          height: 64,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#FFFFFF",
          fontWeight: 800,
          fontSize: 19,
          letterSpacing: "-0.4px",
        }}
      >
        Bilan du jour
      </div>

      <div style={{ paddingBottom: 92 }}>
        {loading ? (
          <SkeletonCards />
        ) : error || !data ? (
          <div style={{ textAlign: "center", padding: 48, color: RED }}>
            Impossible de charger le bilan.
          </div>
        ) : (
          <>
            <div
              style={{
                margin: "16px 16px 0",
                borderRadius: 28,
                padding: 22,
                background: healthTone.background,
                color: healthTone.text,
                boxShadow: "0 24px 46px rgba(0,0,0,0.16)",
                border: "1px solid rgba(255,255,255,0.12)",
              }}
            >
              <div style={{ fontSize: 12, opacity: 0.85, marginBottom: 8 }}>Lecture de la journee</div>
              <div style={{ fontSize: 28, lineHeight: "30px", fontWeight: 800, marginBottom: 10 }}>
                {data.expert.healthLabel}
              </div>
              <div style={{ fontSize: 14, lineHeight: "20px", opacity: 0.92, marginBottom: 14 }}>
                {successRate}% de reussite sur {data.summary.totalPlayed} predictions analysees aujourd&apos;hui.
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {data.expert.bestDiscipline && (
                  <span
                    style={{
                      padding: "6px 10px",
                      borderRadius: 999,
                      background: "rgba(255,255,255,0.16)",
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    Point fort: {disciplineLabel(data.expert.bestDiscipline.discipline)}
                  </span>
                )}
                {data.expert.bestConfidenceBucket && (
                  <span
                    style={{
                      padding: "6px 10px",
                      borderRadius: 999,
                      background: "rgba(255,255,255,0.16)",
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    Zone fiable: {data.expert.bestConfidenceBucket.label}
                  </span>
                )}
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
                padding: "16px",
              }}
            >
              <SummaryCard label="Predictions IA" value={data.summary.totalPlayed} />
              <SummaryCard label="Taux global" value={`${successRate}%`} tone={successRate >= 40 ? "good" : successRate >= 25 ? "warn" : "bad"} />
              <SummaryCard label="Gagnants nets" value={data.summary.wins} tone="good" />
              <SummaryCard label="Places" value={data.summary.places} tone="warn" />
              <SummaryCard label="Perdus" value={data.summary.losses} tone={data.summary.losses > data.summary.wins + data.summary.places ? "bad" : "default"} />
              <SummaryCard label="Courses finies" value={data.results.length} />
            </div>

            <div style={{ margin: "0 16px 18px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: GREEN_DARK }}>Gagnants du jour</div>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: winners.length > 0 ? GREEN : "#666",
                    background: winners.length > 0 ? "#E8F5E9" : "#F0F0F0",
                    padding: "6px 10px",
                    borderRadius: 999,
                  }}
                >
                  {winners.length} gagnant{winners.length > 1 ? "s" : ""}
                </span>
              </div>

              {winners.length === 0 ? (
                <div
                  style={{
                    background: "#FFFFFF",
                    borderRadius: 20,
                    padding: 18,
                    color: "#666",
                    border: "1px solid rgba(0,0,0,0.05)",
                  }}
                >
                  Aucun simple gagnant valide pour le moment. Les places reussies restent visibles plus bas.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {winners.slice(0, 3).map((result, index) => (
                    <div
                      key={`${result.courseInfo.reunion}-${result.courseInfo.course}-${index}`}
                      style={{
                        background: "#FFFFFF",
                        borderRadius: 22,
                        padding: 18,
                        borderLeft: `5px solid ${GREEN}`,
                        boxShadow: "0 18px 36px rgba(15,23,42,0.08)",
                        border: "1px solid rgba(15,23,42,0.05)",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: GREEN, marginBottom: 8 }}>
                            SIMPLE GAGNANT
                          </div>
                          <div style={{ fontSize: 20, fontWeight: 800, color: DARK, lineHeight: "24px", marginBottom: 4 }}>
                            N{result.favori.numPmu} {result.favori.nom}
                          </div>
                          <div style={{ fontSize: 13, color: "#666", lineHeight: "18px" }}>
                            R{result.courseInfo.reunion}C{result.courseInfo.course} - {result.courseInfo.hippodrome}
                          </div>
                        </div>
                        <span
                          style={{
                            background: "#E8F5E9",
                            color: GREEN,
                            padding: "6px 10px",
                            borderRadius: 999,
                            fontSize: 12,
                            fontWeight: 800,
                            whiteSpace: "nowrap",
                          }}
                        >
                          1er
                        </span>
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
                        <span style={{ background: "#F6F7F8", color: "#444", padding: "6px 10px", borderRadius: 999, fontSize: 12, fontWeight: 700 }}>
                          PMU {formatOdds(result.favori.cotePmu)}
                        </span>
                        <span style={{ background: "#EAF4FF", color: "#1565C0", padding: "6px 10px", borderRadius: 999, fontSize: 12, fontWeight: 700 }}>
                          Cote IA {formatOdds(result.favori.coteEstimee)}
                        </span>
                        {result.gainPour1Euro !== null && (
                          <span style={{ background: "#E8F5E9", color: GREEN, padding: "6px 10px", borderRadius: 999, fontSize: 12, fontWeight: 800 }}>
                            Retour 1EUR {formatEuroReturn(result.gainPour1Euro)}
                          </span>
                        )}
                        <span style={{ background: "#F3F4F6", color: "#555", padding: "6px 10px", borderRadius: 999, fontSize: 12, fontWeight: 700 }}>
                          Confiance {result.confiance}/10
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div
              style={{
                margin: "0 16px 18px",
                background: "#FFFFFF",
                borderRadius: 20,
                padding: 18,
                boxShadow: "0 10px 28px rgba(0,0,0,0.06)",
              }}
            >
              <div style={{ fontSize: 18, fontWeight: 800, color: DARK, marginBottom: 12 }}>Bilan expert</div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                <div style={{ borderRadius: 16, background: "#F8FBF9", border: "1px solid #E4EFE7", padding: 14 }}>
                  <div style={{ fontSize: 11, color: "#78817B", textTransform: "uppercase", marginBottom: 6 }}>Discipline forte</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: DARK }}>
                    {data.expert.bestDiscipline ? disciplineLabel(data.expert.bestDiscipline.discipline) : "Aucune"}
                  </div>
                  {data.expert.bestDiscipline && (
                    <div style={{ fontSize: 12, color: GREEN, marginTop: 4 }}>
                      {data.expert.bestDiscipline.rate}% de reussite
                    </div>
                  )}
                </div>

                <div style={{ borderRadius: 16, background: "#FCF8F8", border: "1px solid #F3E2E2", padding: 14 }}>
                  <div style={{ fontSize: 11, color: "#8B7D7D", textTransform: "uppercase", marginBottom: 6 }}>Discipline fragile</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: DARK }}>
                    {data.expert.worstDiscipline ? disciplineLabel(data.expert.worstDiscipline.discipline) : "Aucune"}
                  </div>
                  {data.expert.worstDiscipline && (
                    <div style={{ fontSize: 12, color: RED, marginTop: 4 }}>
                      {data.expert.worstDiscipline.rate}% de reussite
                    </div>
                  )}
                </div>

                <div style={{ borderRadius: 16, background: "#F8FBF9", border: "1px solid #E4EFE7", padding: 14 }}>
                  <div style={{ fontSize: 11, color: "#78817B", textTransform: "uppercase", marginBottom: 6 }}>Zone fiable</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: DARK }}>
                    {data.expert.bestConfidenceBucket?.label ?? "Aucune"}
                  </div>
                  {data.expert.bestConfidenceBucket && (
                    <div style={{ fontSize: 12, color: GREEN, marginTop: 4 }}>
                      {data.expert.bestConfidenceBucket.rate}% de reussite
                    </div>
                  )}
                </div>

                <div style={{ borderRadius: 16, background: "#FCF8F8", border: "1px solid #F3E2E2", padding: 14 }}>
                  <div style={{ fontSize: 11, color: "#8B7D7D", textTransform: "uppercase", marginBottom: 6 }}>Zone a risque</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: DARK }}>
                    {data.expert.worstConfidenceBucket?.label ?? "Aucune"}
                  </div>
                  {data.expert.worstConfidenceBucket && (
                    <div style={{ fontSize: 12, color: RED, marginTop: 4 }}>
                      {data.expert.worstConfidenceBucket.rate}% de reussite
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {data.expert.insights.map((insight, index) => (
                  <div
                    key={index}
                    style={{
                      borderRadius: 14,
                      background: "#F7F8FA",
                      border: "1px solid #ECEEF2",
                      padding: "12px 14px",
                      fontSize: 13,
                      lineHeight: "18px",
                      color: "#51565C",
                    }}
                  >
                    {insight}
                  </div>
                ))}
              </div>
            </div>

            <div style={{ padding: "0 16px", marginBottom: 8 }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: DARK, marginBottom: 10 }}>
                Resultats des predictions
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                <span style={{ background: "#E8F5E9", color: GREEN, padding: "6px 10px", borderRadius: 999, fontSize: 12, fontWeight: 700 }}>
                  Gagnants: {winners.length}
                </span>
                <span style={{ background: "#FFF3CD", color: "#8A5A00", padding: "6px 10px", borderRadius: 999, fontSize: 12, fontWeight: 700 }}>
                  Places: {placed.length}
                </span>
                <span style={{ background: "#F3F4F6", color: "#555", padding: "6px 10px", borderRadius: 999, fontSize: 12, fontWeight: 700 }}>
                  Courses finies: {data.results.length}
                </span>
              </div>
            </div>

            {data.results.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 24px", color: "#666" }}>
                Pas encore de resultats termines pour aujourd&apos;hui.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "0 16px" }}>
                {data.results.map((result, index) => {
                  const tone = getResultStyle(result.resultat);
                  const confianceTone = getConfianceStyle(result.confiance);

                  return (
                    <div
                      key={`${result.courseInfo.reunion}-${result.courseInfo.course}-${index}`}
                      style={{
                        background: "#FFFFFF",
                        borderRadius: 22,
                        padding: 18,
                        borderLeft: `5px solid ${tone.border}`,
                        boxShadow: "0 18px 36px rgba(15,23,42,0.08)",
                        border: "1px solid rgba(15,23,42,0.05)",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start", marginBottom: 10 }}>
                        <div>
                          <div style={{ fontSize: 13, color: "#666", marginBottom: 4 }}>
                            R{result.courseInfo.reunion}C{result.courseInfo.course} - {result.courseInfo.hippodrome}
                          </div>
                          <div style={{ fontSize: 18, fontWeight: 800, color: DARK, lineHeight: "22px" }}>
                            {result.courseInfo.nomCourse}
                          </div>
                        </div>
                        <span style={{ fontSize: 13, color: "#777", whiteSpace: "nowrap" }}>{formatTime(result.courseInfo.heureDepart)}</span>
                      </div>

                      <div style={{ fontSize: 24, fontWeight: 800, color: DARK, marginBottom: 6 }}>
                        N{result.favori.numPmu} {result.favori.nom}
                      </div>

                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
                        <span
                          style={{
                            background: tone.badge,
                            color: tone.badgeText,
                            padding: "6px 10px",
                            borderRadius: 999,
                            fontSize: 12,
                            fontWeight: 800,
                          }}
                        >
                          {resultLabel(result.resultat)}
                        </span>
                        <span
                          style={{
                            background: confianceTone.background,
                            color: confianceTone.color,
                            padding: "6px 10px",
                            borderRadius: 999,
                            fontSize: 12,
                            fontWeight: 800,
                          }}
                        >
                          Confiance {result.confiance}/10
                        </span>
                        {result.ordreArrivee && (
                          <span
                            style={{
                              background: "#F3F4F6",
                              color: "#444",
                              padding: "6px 10px",
                              borderRadius: 999,
                              fontSize: 12,
                              fontWeight: 800,
                            }}
                          >
                            Arrivee {result.ordreArrivee}e
                          </span>
                        )}
                      </div>

                      <div style={{ fontSize: 13, color: "#666", lineHeight: "18px", marginBottom: 12 }}>
                        {result.recommandation}
                      </div>

                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: result.gainPour1Euro !== null ? "1fr 1fr 1fr" : "1fr 1fr",
                          gap: 8,
                        }}
                      >
                        <div style={{ background: tone.soft, borderRadius: 14, padding: 12 }}>
                          <div style={{ fontSize: 11, color: "#777", marginBottom: 4 }}>Cote PMU</div>
                          <div style={{ fontSize: 18, fontWeight: 800, color: DARK }}>{formatOdds(result.favori.cotePmu)}</div>
                        </div>
                        <div style={{ background: "#EEF5FF", borderRadius: 14, padding: 12 }}>
                          <div style={{ fontSize: 11, color: "#6A7480", marginBottom: 4 }}>Cote IA</div>
                          <div style={{ fontSize: 18, fontWeight: 800, color: "#1565C0" }}>{formatOdds(result.favori.coteEstimee)}</div>
                        </div>
                        {result.gainPour1Euro !== null && (
                          <div style={{ background: "#E8F5E9", borderRadius: 14, padding: 12 }}>
                            <div style={{ fontSize: 11, color: "#5D7462", marginBottom: 4 }}>Retour 1EUR</div>
                            <div style={{ fontSize: 18, fontWeight: 800, color: GREEN }}>{formatEuroReturn(result.gainPour1Euro)}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
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
          height: 68,
          background: "rgba(255,255,255,0.92)",
          backdropFilter: "blur(18px)",
          borderTop: "1px solid rgba(0,0,0,0.06)",
          boxShadow: "0 -14px 30px rgba(15,23,42,0.08)",
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
            color: "#888",
          }}
        >
          <span style={{ fontSize: 22 }}>🏇</span>
          <span style={{ fontSize: 11, fontWeight: 600 }}>Courses</span>
        </div>

        <div
          onClick={() => router.push("/mes-paris")}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            cursor: "pointer",
            gap: 2,
            color: "#888",
          }}
        >
          <span style={{ fontSize: 22 }}>💰</span>
          <span style={{ fontSize: 11, fontWeight: 600 }}>Mes Paris</span>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            cursor: "default",
            gap: 2,
            color: GREEN,
            position: "relative",
          }}
        >
          <span style={{ fontSize: 22 }}>📊</span>
          <span style={{ fontSize: 11, fontWeight: 800 }}>Bilan</span>
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
      </div>
    </div>
  );
}
