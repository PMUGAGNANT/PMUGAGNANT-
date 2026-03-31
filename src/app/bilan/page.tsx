"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { asArray } from "@/lib/array-utils";
import {
  formatDateToPmu,
  fromIsoDate,
  getTodayDateStr,
  parsePmuDate,
  toIsoDate,
} from "@/lib/date-utils";

interface CourseInfo {
  dateStr: string;
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
  jockey?: string | null;
}

interface BilanResult {
  courseInfo: CourseInfo;
  favori: PickInfo;
  recommandation: string;
  confiance: number;
  resultat: "GAGNANT" | "PLACE" | "PERDU" | "INCONNU";
  ordreArrivee?: number | null;
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
  dashboard: {
    available: boolean;
    globalRoi: number;
    algoSuccessRate: number;
    randomSuccessRate: number;
    totalBets: number;
    totalStake: number;
    totalGain: number;
    bestTracks: Array<{ label: string; roi: number; sample: number }>;
    bestBetTypes: Array<{ label: string; roi: number; sample: number }>;
    bestJockeys: Array<{ label: string; roi: number; sample: number }>;
    timeline: Array<{
      date: string;
      gain: number;
      stake: number;
      profit: number;
      cumulativeProfit: number;
    }>;
  };
  results: BilanResult[];
}

type BilanTimelinePoint = BilanData["dashboard"]["timeline"][number];
type BilanDashboardStatRow = BilanData["dashboard"]["bestTracks"][number];

interface BacktestResponse {
  success: boolean;
  cached?: boolean;
  backtest?: {
    startDate: string;
    endDate: string;
    days: number;
    racesAnalyzed: number;
    racesSkipped: number;
    totalBets: number;
    totalStake: number;
    totalGain: number;
    totalProfit: number;
    roi: number;
    summarySentence: string;
    byBetType: Array<{
      betType: string;
      betsPlaced: number;
      winningBets: number;
      totalStake: number;
      totalGain: number;
      profit: number;
      roi: number;
      hitRate: number;
    }>;
  };
}

type BacktestByBetTypeRow = NonNullable<BacktestResponse["backtest"]>["byBetType"][number];

const GREEN = "#00FF88";
const GREEN_DARK = "#00CC6A";
const GOLD = "#FFB800";
const RED = "#FF4444";
const DARK = "#FFFFFF";
const CARD_BG = "#111111";
const BORDER = "#1E1E1E";

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

function shiftDate(dateStr: string, delta: number) {
  const date = parsePmuDate(dateStr);
  date.setDate(date.getDate() + delta);
  return formatDateToPmu(date);
}

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
  if (resultat === "GAGNANT") return "Ticket gagnant";
  if (resultat === "PLACE") return "Ticket place";
  if (resultat === "PERDU") return "Perdu";
  return "En attente";
}

function getResultStyle(resultat: BilanResult["resultat"]) {
  if (resultat === "GAGNANT") {
    return {
      border: GREEN,
      soft: "rgba(0,255,136,0.12)",
      strong: GREEN,
      badge: "rgba(0,255,136,0.15)",
      badgeText: GREEN,
    };
  }

  if (resultat === "PLACE") {
    return {
      border: GOLD,
      soft: "rgba(255,184,0,0.1)",
      strong: GOLD,
      badge: "rgba(255,184,0,0.15)",
      badgeText: GOLD,
    };
  }

  return {
    border: RED,
    soft: "rgba(255,68,68,0.1)",
    strong: RED,
    badge: "rgba(255,68,68,0.15)",
    badgeText: RED,
  };
}

function getHealthTone(successRate: number) {
  if (successRate >= 45) {
    return { background: "linear-gradient(135deg, #00FF88, #00AA5C)", text: "#000000", soft: "rgba(0,255,136,0.12)" };
  }

  if (successRate >= 30) {
    return { background: "linear-gradient(135deg, #FFB800, #CC9200)", text: "#000000", soft: "rgba(255,184,0,0.12)" };
  }

  return { background: "linear-gradient(135deg, #FF4444, #CC2222)", text: "#FFFFFF", soft: "rgba(255,68,68,0.12)" };
}

function getConfianceStyle(score: number) {
  if (score >= 7.5) return { background: "rgba(0,255,136,0.15)", color: GREEN };
  if (score >= 5.5) return { background: "rgba(255,184,0,0.15)", color: GOLD };
  return { background: "rgba(255,68,68,0.15)", color: RED };
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

function formatSignedPercent(value: number) {
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function formatSignedCurrency(value: number) {
  const formatted = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(value);
  return `${value > 0 ? "+" : ""}${formatted} EUR`;
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
        margin: "16px 16px 0",
      }}
    >
      <button
        onClick={() => onChange(shiftDate(dateStr, -1))}
        style={{
          height: 44,
          borderRadius: 16,
          border: `1px solid ${BORDER}`,
          background: CARD_BG,
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
          background: CARD_BG,
          borderRadius: 20,
          border: `1px solid ${BORDER}`,
          boxShadow: "0 16px 32px rgba(0,0,0,0.25)",
          padding: 12,
          display: "grid",
          gap: 8,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: "#888888", textTransform: "uppercase", letterSpacing: 0.4 }}>
              {formatRelativeDay(dateStr)}
            </div>
            <div style={{ fontSize: 16, fontWeight: 800, color: DARK }}>{formatDisplayDate(dateStr)}</div>
          </div>
          <button
            onClick={() => onChange(getTodayDateStr())}
            style={{
              border: "none",
              borderRadius: 999,
              background: "rgba(0,255,136,0.15)",
              color: GREEN,
              padding: "8px 12px",
              fontSize: 12,
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            {"Aujourd'hui"}
          </button>
        </div>
        <input
          type="date"
          value={toIsoDate(dateStr)}
          onChange={(event) => onChange(fromIsoDate(event.target.value))}
          style={{
            width: "100%",
            borderRadius: 14,
            border: `1px solid ${BORDER}`,
            background: "#161616",
            padding: "10px 12px",
            fontSize: 14,
            fontWeight: 700,
            color: DARK,
          }}
        />
      </div>

      <button
        onClick={() => onChange(shiftDate(dateStr, 1))}
        style={{
          height: 44,
          borderRadius: 16,
          border: `1px solid ${BORDER}`,
          background: CARD_BG,
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
      ? { background: CARD_BG, value: GREEN }
      : tone === "warn"
        ? { background: CARD_BG, value: GOLD }
        : tone === "bad"
          ? { background: CARD_BG, value: RED }
          : { background: CARD_BG, value: DARK };

  return (
    <div
      style={{
        background: colors.background,
        borderRadius: 22,
        padding: 18,
        border: `1px solid ${BORDER}`,
        boxShadow: "0 16px 32px rgba(0, 0, 0, 0.25)",
      }}
    >
      <div style={{ fontSize: 12, color: "#888888", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>{label}</div>
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
            background: "linear-gradient(90deg, #1a1a1a 25%, #262626 50%, #1a1a1a 75%)",
            backgroundSize: "200% 100%",
            animation: "shimmer 1.6s linear infinite",
          }}
        />
      ))}
    </div>
  );
}

function MiniBarChart({
  timeline,
}: {
  timeline: BilanData["dashboard"]["timeline"];
}) {
  const points = asArray<BilanTimelinePoint>(timeline);
  if (points.length === 0) return null;

  const maxAbs = Math.max(...points.map((point) => Math.abs(point.cumulativeProfit)), 1);

  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 160 }}>
      {points.map((point) => {
        const height = `${Math.max((Math.abs(point.cumulativeProfit) / maxAbs) * 100, 8)}%`;
        const positive = point.cumulativeProfit >= 0;
        return (
          <div key={point.date} style={{ flex: 1, display: "grid", gap: 8, justifyItems: "center" }}>
            <div
              style={{
                width: "100%",
                minWidth: 16,
                height,
                borderRadius: 12,
                background: positive ? "linear-gradient(180deg, #00FF88, #00AA5C)" : "linear-gradient(180deg, #FF6666, #FF4444)",
              }}
            />
            <div style={{ fontSize: 11, color: "#888888", textAlign: "center" }}>
              {point.date.slice(5)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function BilanPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlDate = searchParams.get("date") || getTodayDateStr();
  const [selectedDate, setSelectedDate] = useState(urlDate);
  const [data, setData] = useState<BilanData | null>(null);
  const [backtest, setBacktest] = useState<BacktestResponse["backtest"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    setSelectedDate(urlDate);
  }, [urlDate]);

  useEffect(() => {
    let cancelled = false;

    async function loadBilan() {
      setLoading(true);
      setError(false);

      try {
        const res = await fetch(`/api/bilan?date=${selectedDate}`, { cache: "no-store" });
        const json = (await res.json()) as BilanData;
        if (cancelled) return;
        if (json.success) {
          setData(json);
        } else {
          setError(true);
        }
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadBilan();
    return () => {
      cancelled = true;
    };
  }, [selectedDate]);

  useEffect(() => {
    let cancelled = false;

    async function loadBacktest() {
      try {
        const res = await fetch("/api/backtest?days=90", { cache: "no-store" });
        const json = (await res.json()) as BacktestResponse;
        if (!cancelled && json.success && json.backtest) {
          setBacktest(json.backtest);
        }
      } catch {
        if (!cancelled) setBacktest(null);
      }
    }

    void loadBacktest();
    return () => {
      cancelled = true;
    };
  }, []);

  const resultsList = useMemo(() => asArray<BilanResult>(data?.results), [data]);

  const winners = useMemo(
    () => resultsList.filter((result) => result.resultat === "GAGNANT"),
    [resultsList]
  );
  const placed = useMemo(
    () => resultsList.filter((result) => result.resultat === "PLACE"),
    [resultsList]
  );
  const misses = useMemo(
    () => resultsList.filter((result) => result.resultat === "PERDU"),
    [resultsList]
  );

  const bestTracksRows = useMemo(
    () => asArray<BilanDashboardStatRow>(data?.dashboard?.bestTracks),
    [data]
  );
  const bestBetTypesRows = useMemo(
    () => asArray<BilanDashboardStatRow>(data?.dashboard?.bestBetTypes),
    [data]
  );
  const bestJockeysRows = useMemo(
    () => asArray<BilanDashboardStatRow>(data?.dashboard?.bestJockeys),
    [data]
  );
  const expertInsights = useMemo(() => asArray<string>(data?.expert?.insights), [data]);
  const backtestByBetTypeRows = useMemo(
    () => asArray<BacktestByBetTypeRow>(backtest?.byBetType),
    [backtest]
  );

  const successRate = data?.summary.successRate ?? 0;
  const healthTone = getHealthTone(successRate);

  function updateDate(nextDate: string) {
    router.replace(`/bilan?date=${nextDate}`, { scroll: false });
  }

  function openCourse(result: BilanResult) {
    router.push(
      `/course/${result.courseInfo.reunion}/${result.courseInfo.course}?date=${result.courseInfo.dateStr}`
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top left, rgba(0,255,136,0.06), transparent 30%), radial-gradient(circle at top right, rgba(0,255,136,0.04), transparent 22%), #0A0A0A",
        width: "min(1180px, calc(100% - 24px))",
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
          background: "rgba(10,10,10,0.92)",
          backdropFilter: "blur(18px)",
          borderBottom: `1px solid ${BORDER}`,
          minHeight: 72,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          color: "#FFFFFF",
          fontWeight: 800,
          fontSize: 19,
          letterSpacing: "-0.4px",
          gap: 2,
          padding: "10px 0 8px",
        }}
      >
        <div>Bilan</div>
        <div style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.72)", letterSpacing: 0 }}>
          {formatRelativeDay(selectedDate)} - {formatDisplayDate(selectedDate)}
        </div>
      </div>

      <div style={{ paddingBottom: 92 }}>
        <DateNavigator dateStr={selectedDate} onChange={updateDate} />

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
              <div style={{ fontSize: 12, opacity: 0.85, marginBottom: 8 }}>Lecture de la seance</div>
              <div style={{ fontSize: 28, lineHeight: "30px", fontWeight: 800, marginBottom: 10 }}>
                {data.expert.healthLabel}
              </div>
              <div style={{ fontSize: 14, lineHeight: "20px", opacity: 0.92, marginBottom: 14 }}>
                {successRate}% de reussite sur {data.summary.totalPlayed} predictions analysees pour cette date.
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
              <SummaryCard label="Tickets lus" value={data.summary.totalPlayed} />
              <SummaryCard label="Taux global" value={`${successRate}%`} tone={successRate >= 40 ? "good" : successRate >= 25 ? "warn" : "bad"} />
              <SummaryCard label="Tickets gagnants" value={data.summary.wins} tone="good" />
              <SummaryCard label="Tickets places" value={data.summary.places} tone="warn" />
              <SummaryCard label="Tickets perdus" value={data.summary.losses} tone={data.summary.losses > data.summary.wins + data.summary.places ? "bad" : "default"} />
              <SummaryCard label="Courses finies" value={resultsList.length} />
            </div>

            {data.dashboard.available ? (
              <div style={{ margin: "0 16px 18px", display: "grid", gap: 14 }}>
                <div
                  style={{
                    background: CARD_BG,
                    borderRadius: 24,
                    padding: 18,
                    border: `1px solid ${BORDER}`,
                    boxShadow: "0 18px 36px rgba(15,23,42,0.08)",
                  }}
                >
                  <div style={{ fontSize: 22, fontWeight: 800, color: GREEN_DARK, marginBottom: 12 }}>
                    Dashboard performance
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <SummaryCard
                      label="ROI global"
                      value={formatSignedPercent(data.dashboard.globalRoi)}
                      tone={data.dashboard.globalRoi >= 0 ? "good" : "bad"}
                    />
                    <SummaryCard
                      label="Hasard estime"
                      value={`${data.dashboard.randomSuccessRate.toFixed(1)}%`}
                      tone="default"
                    />
                    <SummaryCard
                      label="Algo reussite"
                      value={`${data.dashboard.algoSuccessRate.toFixed(1)}%`}
                      tone={data.dashboard.algoSuccessRate >= data.dashboard.randomSuccessRate ? "good" : "warn"}
                    />
                    <SummaryCard label="Bets historiques" value={data.dashboard.totalBets} />
                    <SummaryCard label="Mises" value={formatSignedCurrency(data.dashboard.totalStake)} />
                    <SummaryCard
                      label="Gains"
                      value={formatSignedCurrency(data.dashboard.totalGain)}
                      tone={data.dashboard.totalGain >= data.dashboard.totalStake ? "good" : "warn"}
                    />
                  </div>
                </div>

                <div
                  style={{
                    background: CARD_BG,
                    borderRadius: 24,
                    padding: 18,
                    border: `1px solid ${BORDER}`,
                    boxShadow: "0 18px 36px rgba(15,23,42,0.08)",
                  }}
                >
                  <div style={{ fontSize: 18, fontWeight: 800, color: DARK, marginBottom: 12 }}>
                    Gains / pertes dans le temps
                  </div>
                  <MiniBarChart timeline={asArray<BilanTimelinePoint>(data.dashboard?.timeline)} />
                </div>

                <div
                  style={{
                    background: CARD_BG,
                    borderRadius: 24,
                    padding: 18,
                    border: `1px solid ${BORDER}`,
                    boxShadow: "0 18px 36px rgba(15,23,42,0.08)",
                    display: "grid",
                    gap: 14,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: DARK, marginBottom: 10 }}>
                      Meilleurs hippodromes
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {bestTracksRows.map((track) => (
                        <div key={track.label} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 14 }}>
                          <span style={{ color: DARK, fontWeight: 700 }}>{track.label}</span>
                          <span style={{ color: track.roi >= 0 ? GREEN : RED, fontWeight: 800 }}>
                            {formatSignedPercent(track.roi)} ({track.sample})
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: DARK, marginBottom: 10 }}>
                      Taux par type de pari
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {bestBetTypesRows.map((betType) => (
                        <div key={betType.label} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 14 }}>
                          <span style={{ color: DARK, fontWeight: 700 }}>{betType.label}</span>
                          <span style={{ color: betType.roi >= 0 ? GREEN : RED, fontWeight: 800 }}>
                            {formatSignedPercent(betType.roi)} ({betType.sample})
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: DARK, marginBottom: 10 }}>
                      Jockeys detectes
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {bestJockeysRows.length > 0 ? bestJockeysRows.map((jockey) => (
                        <div key={jockey.label} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 14 }}>
                          <span style={{ color: DARK, fontWeight: 700 }}>{jockey.label}</span>
                          <span style={{ color: jockey.roi >= 0 ? GREEN : RED, fontWeight: 800 }}>
                            {formatSignedPercent(jockey.roi)} ({jockey.sample})
                          </span>
                        </div>
                      )) : (
                        <div style={{ color: "#888888", fontSize: 14 }}>Pas assez de signal jockey exploitable pour cette date.</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {backtest ? (
              <div
                style={{
                  margin: "0 16px 18px",
                  background: CARD_BG,
                  borderRadius: 24,
                  padding: 18,
                  border: `1px solid ${BORDER}`,
                  boxShadow: "0 18px 36px rgba(15,23,42,0.08)",
                  display: "grid",
                  gap: 14,
                }}
              >
                <div style={{ fontSize: 22, fontWeight: 800, color: GREEN_DARK }}>
                  Backtest 90 jours
                </div>
                <div
                  style={{
                    borderRadius: 18,
                    padding: 16,
                    background: backtest.totalProfit >= 0 ? "rgba(0,255,136,0.08)" : "rgba(255,68,68,0.08)",
                    border: `1px solid ${backtest.totalProfit >= 0 ? "rgba(0,255,136,0.25)" : "rgba(255,68,68,0.25)"}`,
                    color: backtest.totalProfit >= 0 ? GREEN : RED,
                    fontSize: 16,
                    lineHeight: "22px",
                    fontWeight: 700,
                  }}
                >
                  {backtest.summarySentence}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <SummaryCard
                    label="ROI 90j"
                    value={formatSignedPercent(backtest.roi)}
                    tone={backtest.roi >= 0 ? "good" : "bad"}
                  />
                  <SummaryCard label="Courses" value={backtest.racesAnalyzed} />
                  <SummaryCard label="Mise totale" value={formatSignedCurrency(backtest.totalStake)} />
                  <SummaryCard
                    label="Profit"
                    value={formatSignedCurrency(backtest.totalProfit)}
                    tone={backtest.totalProfit >= 0 ? "good" : "bad"}
                  />
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {backtestByBetTypeRows.map((betType) => (
                    <div
                      key={betType.betType}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1.2fr 0.8fr 0.8fr",
                        gap: 10,
                        alignItems: "center",
                        borderRadius: 16,
                        padding: "12px 14px",
                        background: "#161616",
                        border: `1px solid ${BORDER}`,
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: DARK }}>{betType.betType}</div>
                        <div style={{ fontSize: 12, color: "#888888" }}>
                          {betType.betsPlaced} ticket{betType.betsPlaced > 1 ? "s" : ""} · hit {betType.hitRate}%
                        </div>
                      </div>
                      <div style={{ fontSize: 13, color: DARK, fontWeight: 700 }}>
                        Stake {betType.totalStake.toFixed(2)} EUR
                      </div>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 800,
                          color: betType.roi >= 0 ? GREEN : RED,
                          textAlign: "right",
                        }}
                      >
                        {formatSignedPercent(betType.roi)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div style={{ margin: "0 16px 18px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: GREEN_DARK }}>Coups gagnants</div>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: winners.length > 0 ? GREEN : "#888888",
                    background: winners.length > 0 ? "rgba(0,255,136,0.12)" : "#161616",
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
                    background: CARD_BG,
                    borderRadius: 20,
                    padding: 18,
                    color: "#888888",
                    border: "1px solid rgba(0,0,0,0.05)",
                  }}
                >
                  Aucun ticket gagnant propre pour le moment. Les tickets places utiles restent visibles plus bas.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {winners.slice(0, 3).map((result, index) => (
                    <button
                      key={`${result.courseInfo.reunion}-${result.courseInfo.course}-${index}`}
                      onClick={() => openCourse(result)}
                      style={{
                        width: "100%",
                        textAlign: "left",
                        border: `1px solid ${BORDER}`,
                        background: CARD_BG,
                        borderRadius: 22,
                        padding: 18,
                        borderLeft: `5px solid ${GREEN}`,
                        boxShadow: "0 18px 36px rgba(15,23,42,0.08)",
                        cursor: "pointer",
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
                            background: "rgba(0,255,136,0.15)",
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
                        <span style={{ background: "#161616", color: "#CCCCCC", padding: "6px 10px", borderRadius: 999, fontSize: 12, fontWeight: 700 }}>
                          PMU {formatOdds(result.favori.cotePmu)}
                        </span>
                        <span style={{ background: "rgba(59,130,246,0.15)", color: "#60a5fa", padding: "6px 10px", borderRadius: 999, fontSize: 12, fontWeight: 700 }}>
                          Cote IA {formatOdds(result.favori.coteEstimee)}
                        </span>
                        <span style={{ background: "#161616", color: "#888888", padding: "6px 10px", borderRadius: 999, fontSize: 12, fontWeight: 700 }}>
                          Confiance {result.confiance}/10
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {placed.length > 0 ? (
              <div style={{ margin: "0 16px 18px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: GOLD }}>Places utiles</div>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: GOLD,
                      background: "rgba(255,184,0,0.12)",
                      padding: "6px 10px",
                      borderRadius: 999,
                    }}
                  >
                    {placed.length} place{placed.length > 1 ? "s" : ""}
                  </span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {placed.slice(0, 3).map((result, index) => (
                    <button
                      key={`${result.courseInfo.reunion}-${result.courseInfo.course}-place-${index}`}
                      onClick={() => openCourse(result)}
                      style={{
                        width: "100%",
                        textAlign: "left",
                        border: `1px solid ${BORDER}`,
                        background: CARD_BG,
                        borderRadius: 22,
                        padding: 18,
                        borderLeft: "5px solid #D4A017",
                        boxShadow: "0 18px 36px rgba(15,23,42,0.08)",
                        cursor: "pointer",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: GOLD, marginBottom: 8 }}>
                            TICKET PLACE
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
                            background: "rgba(255,184,0,0.15)",
                            color: GOLD,
                            padding: "6px 10px",
                            borderRadius: 999,
                            fontSize: 12,
                            fontWeight: 800,
                            whiteSpace: "nowrap",
                          }}
                        >
                          Place
                        </span>
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
                        <span style={{ background: "#161616", color: "#CCCCCC", padding: "6px 10px", borderRadius: 999, fontSize: 12, fontWeight: 700 }}>
                          PMU {formatOdds(result.favori.cotePmu)}
                        </span>
                        <span style={{ background: "rgba(59,130,246,0.15)", color: "#60a5fa", padding: "6px 10px", borderRadius: 999, fontSize: 12, fontWeight: 700 }}>
                          Cote IA {formatOdds(result.favori.coteEstimee)}
                        </span>
                        <span style={{ background: "#161616", color: "#888888", padding: "6px 10px", borderRadius: 999, fontSize: 12, fontWeight: 700 }}>
                          Confiance {result.confiance}/10
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div
              style={{
                margin: "0 16px 18px",
                background: CARD_BG,
                borderRadius: 20,
                padding: 18,
                boxShadow: "0 10px 28px rgba(0,0,0,0.06)",
              }}
            >
              <div style={{ fontSize: 18, fontWeight: 800, color: DARK, marginBottom: 12 }}>Bilan expert</div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                <div style={{ borderRadius: 16, background: "rgba(0,255,136,0.06)", border: "1px solid rgba(0,255,136,0.2)", padding: 14 }}>
                  <div style={{ fontSize: 11, color: "#888888", textTransform: "uppercase", marginBottom: 6 }}>Discipline forte</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: DARK }}>
                    {data.expert.bestDiscipline ? disciplineLabel(data.expert.bestDiscipline.discipline) : "Aucune"}
                  </div>
                  {data.expert.bestDiscipline && (
                    <div style={{ fontSize: 12, color: GREEN, marginTop: 4 }}>
                      {data.expert.bestDiscipline.rate}% de reussite
                    </div>
                  )}
                </div>

                <div style={{ borderRadius: 16, background: "rgba(255,68,68,0.06)", border: "1px solid rgba(255,68,68,0.2)", padding: 14 }}>
                  <div style={{ fontSize: 11, color: "#888888", textTransform: "uppercase", marginBottom: 6 }}>Discipline fragile</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: DARK }}>
                    {data.expert.worstDiscipline ? disciplineLabel(data.expert.worstDiscipline.discipline) : "Aucune"}
                  </div>
                  {data.expert.worstDiscipline && (
                    <div style={{ fontSize: 12, color: RED, marginTop: 4 }}>
                      {data.expert.worstDiscipline.rate}% de reussite
                    </div>
                  )}
                </div>

                <div style={{ borderRadius: 16, background: "rgba(0,255,136,0.06)", border: "1px solid rgba(0,255,136,0.2)", padding: 14 }}>
                  <div style={{ fontSize: 11, color: "#888888", textTransform: "uppercase", marginBottom: 6 }}>Zone fiable</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: DARK }}>
                    {data.expert.bestConfidenceBucket?.label ?? "Aucune"}
                  </div>
                  {data.expert.bestConfidenceBucket && (
                    <div style={{ fontSize: 12, color: GREEN, marginTop: 4 }}>
                      {data.expert.bestConfidenceBucket.rate}% de reussite
                    </div>
                  )}
                </div>

                <div style={{ borderRadius: 16, background: "rgba(255,68,68,0.06)", border: "1px solid rgba(255,68,68,0.2)", padding: 14 }}>
                  <div style={{ fontSize: 11, color: "#888888", textTransform: "uppercase", marginBottom: 6 }}>Zone a risque</div>
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
                {expertInsights.map((insight, index) => (
                  <div
                    key={index}
                    style={{
                      borderRadius: 14,
                      background: "#161616",
                      border: `1px solid ${BORDER}`,
                      padding: "12px 14px",
                      fontSize: 13,
                      lineHeight: "18px",
                      color: "#888888",
                    }}
                  >
                    {insight}
                  </div>
                ))}
              </div>
            </div>

            <div style={{ padding: "0 16px", marginBottom: 8 }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: DARK, marginBottom: 10 }}>
                Lecture complete des tickets
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                <span style={{ background: "rgba(0,255,136,0.15)", color: GREEN, padding: "6px 10px", borderRadius: 999, fontSize: 12, fontWeight: 700 }}>
                  Gagnants: {winners.length}
                </span>
                <span style={{ background: "rgba(255,184,0,0.15)", color: GOLD, padding: "6px 10px", borderRadius: 999, fontSize: 12, fontWeight: 700 }}>
                  Places: {placed.length}
                </span>
                <span style={{ background: "rgba(255,68,68,0.15)", color: RED, padding: "6px 10px", borderRadius: 999, fontSize: 12, fontWeight: 700 }}>
                  Perdus: {misses.length}
                </span>
                <span style={{ background: "#161616", color: "#888888", padding: "6px 10px", borderRadius: 999, fontSize: 12, fontWeight: 700 }}>
                  Courses finies: {resultsList.length}
                </span>
              </div>
            </div>

            {resultsList.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 24px", color: "#666" }}>
                Pas encore de resultats termines pour cette date.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "0 16px" }}>
                {resultsList.map((result, index) => {
                  const tone = getResultStyle(result.resultat);
                  const confianceTone = getConfianceStyle(result.confiance);

                  return (
                    <button
                      key={`${result.courseInfo.reunion}-${result.courseInfo.course}-${index}`}
                      onClick={() => openCourse(result)}
                      style={{
                        width: "100%",
                        textAlign: "left",
                        border: `1px solid ${BORDER}`,
                        background: CARD_BG,
                        borderRadius: 22,
                        padding: 18,
                        borderLeft: `5px solid ${tone.border}`,
                        boxShadow: "0 18px 36px rgba(15,23,42,0.08)",
                        cursor: "pointer",
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
                        <span style={{ fontSize: 13, color: "#888888", whiteSpace: "nowrap" }}>{formatTime(result.courseInfo.heureDepart)}</span>
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
                              background: "#161616",
                              color: "#CCCCCC",
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

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                        <div style={{ background: tone.soft, borderRadius: 14, padding: 12 }}>
                          <div style={{ fontSize: 11, color: "#888888", marginBottom: 4 }}>Cote PMU</div>
                          <div style={{ fontSize: 18, fontWeight: 800, color: DARK }}>{formatOdds(result.favori.cotePmu)}</div>
                        </div>
                        <div style={{ background: "rgba(59,130,246,0.12)", borderRadius: 14, padding: 12 }}>
                          <div style={{ fontSize: 11, color: "#888888", marginBottom: 4 }}>Cote IA</div>
                          <div style={{ fontSize: 18, fontWeight: 800, color: "#60a5fa" }}>{formatOdds(result.favori.coteEstimee)}</div>
                        </div>
                      </div>
                    </button>
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
          maxWidth: 1180,
          background: "rgba(17,17,17,0.95)",
          backdropFilter: "blur(18px)",
          borderTop: `1px solid ${BORDER}`,
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          zIndex: 200,
        }}
      >
        {[
          { label: "Courses", active: false, href: `/?date=${selectedDate}` },
          { label: "Mes Paris", active: false, href: "/mes-paris" },
          { label: "Bilan", active: true, href: `/bilan?date=${selectedDate}` },
        ].map((item) => (
          <button
            key={item.label}
            onClick={() => !item.active && router.push(item.href)}
            style={{
              border: "none",
              background: "transparent",
              padding: "14px 10px 16px",
              fontWeight: item.active ? 900 : 700,
              color: item.active ? GREEN : "#888888",
              cursor: item.active ? "default" : "pointer",
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function BilanPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", background: "#0A0A0A" }} />}>
      <BilanPageContent />
    </Suspense>
  );
}

