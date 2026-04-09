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
import {
  BILAN_DASHBOARD_HISTORY_DAYS_DEFAULT,
  BILAN_DASHBOARD_HISTORY_DAYS_MAX,
  BILAN_DASHBOARD_HISTORY_DAYS_MIN,
} from "@/lib/prediction-store";

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
  dashboardHistory?: {
    days: number;
    startIso: string;
    endIso: string;
  };
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

const HISTORY_PRESETS = [30, 90, 180, 365, 730] as const;

function clampHistoryDays(value: number) {
  return Math.min(
    BILAN_DASHBOARD_HISTORY_DAYS_MAX,
    Math.max(BILAN_DASHBOARD_HISTORY_DAYS_MIN, value)
  );
}

function parseHistoryDays(raw: string | null) {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return BILAN_DASHBOARD_HISTORY_DAYS_DEFAULT;
  }
  return clampHistoryDays(parsed);
}

function shiftDate(dateStr: string, delta: number) {
  const date = parsePmuDate(dateStr);
  date.setDate(date.getDate() + delta);
  return formatDateToPmu(date);
}

function formatDisplayDate(dateStr: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(parsePmuDate(dateStr));
}

function formatRelativeDay(dateStr: string) {
  const today = getTodayDateStr();
  if (dateStr === today) return "Aujourd'hui";
  if (dateStr === shiftDate(today, -1)) return "Hier";
  if (dateStr === shiftDate(today, 1)) return "Demain";
  return "Selection";
}

function formatShortIsoDate(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatOdds(value: number | null) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "--";
  return value.toFixed(1);
}

function formatSignedPercent(value: number) {
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function formatSignedCurrency(value: number) {
  const formatted = new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 2,
  }).format(value);
  return `${value > 0 ? "+" : ""}${formatted} EUR`;
}

function disciplineLabel(discipline: string) {
  if (discipline.includes("TROT_ATTELE")) return "Trot attele";
  if (discipline.includes("TROT_MONTE")) return "Trot monte";
  if (discipline === "PLAT") return "Plat";
  if (
    discipline.includes("OBSTACLE") ||
    discipline.includes("HAIES") ||
    discipline.includes("STEEPLE")
  ) {
    return "Obstacle";
  }
  return discipline || "Autre";
}

function resultTone(result: BilanResult["resultat"]) {
  if (result === "GAGNANT") return "var(--pmu-primary)";
  if (result === "PLACE") return "var(--pmu-orange)";
  if (result === "PERDU") return "var(--pmu-red)";
  return "var(--pmu-text-soft)";
}

function resultLabel(result: BilanResult["resultat"]) {
  if (result === "GAGNANT") return "Ticket gagnant";
  if (result === "PLACE") return "Ticket place";
  if (result === "PERDU") return "Perdu";
  return "En attente";
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
  const color =
    tone === "good"
      ? "var(--pmu-primary)"
      : tone === "warn"
        ? "var(--pmu-orange)"
        : tone === "bad"
          ? "var(--pmu-red)"
          : "var(--pmu-text)";

  return (
    <article className="app-stat-card px-5 py-4">
      <p className="app-label">{label}</p>
      <p className="mt-2 text-3xl font-black" style={{ color }}>
        {value}
      </p>
    </article>
  );
}

function WindowSelector({
  value,
  onChange,
}: {
  value: number;
  onChange: (next: number) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {HISTORY_PRESETS.map((days) => (
        <button
          key={days}
          type="button"
          onClick={() => onChange(days)}
          className={`app-pill text-xs ${value === days ? "app-pill--active" : ""}`}
        >
          {days} jours
        </button>
      ))}
    </div>
  );
}

function MiniTimeline({
  points,
}: {
  points: BilanData["dashboard"]["timeline"];
}) {
  const list = asArray<BilanData["dashboard"]["timeline"][number]>(points);
  if (list.length === 0) {
    return (
      <div className="app-card-muted px-4 py-5 text-sm text-[var(--pmu-text-soft)]">
        Pas assez d&apos;historique pour tracer la courbe.
      </div>
    );
  }

  const maxAbs = Math.max(
    ...list.map((point) => Math.abs(point.cumulativeProfit)),
    1
  );

  return (
    <div className="flex h-44 items-end gap-2">
      {list.map((point) => {
        const positive = point.cumulativeProfit >= 0;
        const height = `${Math.max(
          (Math.abs(point.cumulativeProfit) / maxAbs) * 100,
          8
        )}%`;

        return (
          <div key={point.date} className="grid flex-1 justify-items-center gap-2">
            <div
              className="w-full rounded-full"
              style={{
                height,
                background: positive
                  ? "linear-gradient(180deg, var(--pmu-primary), var(--pmu-primary-bright))"
                  : "linear-gradient(180deg, color-mix(in srgb, var(--pmu-red) 82%, white), var(--pmu-red))",
              }}
            />
            <span className="text-[11px] font-semibold text-[var(--pmu-text-muted)]">
              {point.date.slice(5)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function InsightList({ items }: { items: string[] }) {
  const list = asArray<string>(items);
  if (list.length === 0) {
    return null;
  }

  return (
    <div className="grid gap-3">
      {list.map((item, index) => (
        <div
          key={`${item}-${index}`}
          className="rounded-[1rem] border border-[var(--pmu-border)] bg-[color-mix(in_srgb,var(--pmu-surface-2)_92%,transparent)] px-4 py-3 text-sm leading-6 text-[var(--pmu-text-soft)]"
        >
          {item}
        </div>
      ))}
    </div>
  );
}

function ResultCard({
  result,
  onOpen,
}: {
  result: BilanResult;
  onOpen: (result: BilanResult) => void;
}) {
  const tone = resultTone(result.resultat);

  return (
    <button
      type="button"
      onClick={() => onOpen(result)}
      className="app-card flex w-full flex-col items-start gap-3 p-5 text-left"
      style={{ borderLeft: `4px solid ${tone}` }}
    >
      <div className="flex w-full items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[var(--pmu-text-soft)]">
            R{result.courseInfo.reunion}C{result.courseInfo.course} - {result.courseInfo.hippodrome}
          </p>
          <h3 className="mt-1 text-xl font-black text-[var(--pmu-text)]">
            {result.courseInfo.nomCourse}
          </h3>
        </div>
        <span
          className="rounded-full px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.14em]"
          style={{
            color: tone,
            background: `color-mix(in srgb, ${tone} 12%, var(--pmu-surface))`,
          }}
        >
          {resultLabel(result.resultat)}
        </span>
      </div>

      <div>
        <p className="text-2xl font-black text-[var(--pmu-text)]">
          N{result.favori.numPmu} {result.favori.nom}
        </p>
        <p className="mt-1 text-sm leading-6 text-[var(--pmu-text-soft)]">
          {result.recommandation}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <span className="app-pill text-xs">Confiance {result.confiance}/10</span>
        <span className="app-pill text-xs">PMU {formatOdds(result.favori.cotePmu)}</span>
        <span className="app-pill text-xs">IA {formatOdds(result.favori.coteEstimee)}</span>
        {result.ordreArrivee ? (
          <span className="app-pill text-xs">Arrivee {result.ordreArrivee}e</span>
        ) : null}
      </div>
    </button>
  );
}

function BilanPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlDate = searchParams.get("date") || getTodayDateStr();
  const historyDays = useMemo(
    () => parseHistoryDays(searchParams.get("dashboard_days")),
    [searchParams]
  );

  const [selectedDate, setSelectedDate] = useState(urlDate);
  const [data, setData] = useState<BilanData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fetchRevision, setFetchRevision] = useState(0);

  useEffect(() => {
    setSelectedDate(urlDate);
  }, [urlDate]);

  useEffect(() => {
    const ac = new AbortController();
    let cancelled = false;

    async function loadBilan() {
      setLoading(true);
      setError(null);

      try {
        const qs = new URLSearchParams({
          date: selectedDate,
          dashboard_days: String(historyDays),
        });
        const res = await fetch(`/api/bilan?${qs.toString()}`, {
          cache: "no-store",
          signal: ac.signal,
        });
        const json = (await res.json()) as BilanData;

        if (cancelled) return;
        if (!res.ok || !json.success) {
          throw new Error("Le serveur n'a pas pu renvoyer le bilan.");
        }

        setData(json);
      } catch (loadError) {
        if (cancelled) return;
        if (loadError instanceof Error && loadError.name === "AbortError") return;
        setData(null);
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Impossible de charger le bilan."
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadBilan();
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [selectedDate, historyDays, fetchRevision]);

  const results = useMemo(() => asArray<BilanResult>(data?.results), [data]);
  const winners = useMemo(
    () => results.filter((item) => item.resultat === "GAGNANT"),
    [results]
  );
  const places = useMemo(
    () => results.filter((item) => item.resultat === "PLACE"),
    [results]
  );
  const losses = useMemo(
    () => results.filter((item) => item.resultat === "PERDU"),
    [results]
  );

  function updateDate(nextDate: string) {
    const qs = new URLSearchParams({
      date: nextDate,
      dashboard_days: String(historyDays),
    });
    router.replace(`/bilan?${qs.toString()}`, { scroll: false });
  }

  function updateHistory(nextDays: number) {
    const qs = new URLSearchParams({
      date: selectedDate,
      dashboard_days: String(clampHistoryDays(nextDays)),
    });
    router.replace(`/bilan?${qs.toString()}`, { scroll: false });
  }

  function openCourse(result: BilanResult) {
    router.push(
      `/course/${result.courseInfo.reunion}/${result.courseInfo.course}?date=${result.courseInfo.dateStr}`
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[96rem] flex-col gap-6 lg:gap-8">
      <section className="app-page-hero p-6 md:p-8">
        <div className="relative z-[1] grid gap-6 xl:grid-cols-[1.12fr,0.88fr] xl:items-end">
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-[color-mix(in_srgb,var(--pmu-primary)_26%,transparent)] bg-[var(--pmu-primary-soft)] px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.16em] text-[var(--pmu-primary)]">
                Bilan moteur
              </span>
              <span className="app-pill text-xs">{formatRelativeDay(selectedDate)}</span>
              <span className="app-pill text-xs">{historyDays} jours dashboard</span>
            </div>

            <div>
              <p className="app-kicker">Lecture de performance</p>
              <h1 className="max-w-4xl text-4xl font-black leading-[0.93] text-[var(--pmu-text)] md:text-6xl">
                Une page pour verifier le moteur, pas pour enjoliver les resultats.
              </h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--pmu-text-soft)] md:text-base">
                On garde les tickets, les pertes, les zones fortes et la lecture
                longue periode dans une seule page plus propre.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => updateDate(shiftDate(selectedDate, -1))}
                className="app-button-secondary"
              >
                Jour precedent
              </button>
              <button
                type="button"
                onClick={() => updateDate(getTodayDateStr())}
                className="app-button-secondary"
              >
                Aujourd&apos;hui
              </button>
              <button
                type="button"
                onClick={() => updateDate(shiftDate(selectedDate, 1))}
                className="app-button-secondary"
              >
                Jour suivant
              </button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="app-stat-card px-5 py-4">
              <p className="app-label">Date active</p>
              <p className="mt-2 text-xl font-black capitalize text-[var(--pmu-text)]">
                {formatDisplayDate(selectedDate)}
              </p>
            </div>
            <div className="app-stat-card px-5 py-4">
              <p className="app-label">Etat moteur</p>
              <p className="mt-2 text-xl font-black text-[var(--pmu-text)]">
                {data?.expert.healthLabel ?? "En attente"}
              </p>
            </div>
            <div className="app-stat-card px-5 py-4">
              <p className="app-label">Courses finies</p>
              <p className="mt-2 text-3xl font-black text-[var(--pmu-text)]">
                {results.length}
              </p>
            </div>
            <div className="app-stat-card px-5 py-4">
              <p className="app-label">Reussite</p>
              <p className="mt-2 text-3xl font-black text-[var(--pmu-primary)]">
                {data ? `${data.summary.successRate.toFixed(0)}%` : "--"}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,16rem),1fr] lg:items-center">
        <label className="block">
          <span className="sr-only">Choisir une date</span>
          <input
            type="date"
            value={toIsoDate(selectedDate)}
            onChange={(event) => updateDate(fromIsoDate(event.target.value))}
            className="app-input"
          />
        </label>
        <WindowSelector value={historyDays} onChange={updateHistory} />
      </section>

      {loading ? (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }, (_, index) => (
            <div
              key={index}
              className="app-card h-36 animate-pulse bg-[linear-gradient(180deg,var(--pmu-surface-highlight)_0%,var(--pmu-surface)_100%)]"
            />
          ))}
        </section>
      ) : error ? (
        <section className="app-card p-6">
          <p className="app-kicker">Bilan</p>
          <h2 className="mt-2 text-3xl font-black text-[var(--pmu-text)]">
            Impossible de charger le bilan
          </h2>
          <p className="mt-3 text-sm leading-7 text-[var(--pmu-text-soft)]">
            {error}
          </p>
          <button
            type="button"
            className="app-button-primary mt-5"
            onClick={() => setFetchRevision((revision) => revision + 1)}
          >
            Reessayer
          </button>
        </section>
      ) : data ? (
        <>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
            <SummaryCard label="Courses analysees" value={data.summary.totalRaces} />
            <SummaryCard label="Tickets joues" value={data.summary.totalPlayed} />
            <SummaryCard label="Gagnants" value={data.summary.wins} tone="good" />
            <SummaryCard label="Places" value={data.summary.places} tone="warn" />
            <SummaryCard label="Perdus" value={data.summary.losses} tone="bad" />
            <SummaryCard
              label="Taux de reussite"
              value={`${data.summary.successRate.toFixed(1)}%`}
              tone={data.summary.successRate >= 40 ? "good" : data.summary.successRate >= 28 ? "warn" : "bad"}
            />
          </section>

          <section className="grid gap-5 xl:grid-cols-[1.05fr,0.95fr]">
            <section className="app-card p-5 md:p-6">
              <div className="app-section-heading">
                <div>
                  <p className="app-kicker">Dashboard long terme</p>
                  <h2 className="app-section-title">ROI, edge et volume</h2>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="app-card-muted px-4 py-4">
                  <p className="app-label">ROI global</p>
                  <p className="mt-2 text-2xl font-black text-[var(--pmu-text)]">
                    {formatSignedPercent(data.dashboard.globalRoi)}
                  </p>
                </div>
                <div className="app-card-muted px-4 py-4">
                  <p className="app-label">Algo vs hasard</p>
                  <p className="mt-2 text-2xl font-black text-[var(--pmu-text)]">
                    {(data.dashboard.algoSuccessRate - data.dashboard.randomSuccessRate) > 0 ? "+" : ""}
                    {(data.dashboard.algoSuccessRate - data.dashboard.randomSuccessRate).toFixed(1)} pts
                  </p>
                </div>
                <div className="app-card-muted px-4 py-4">
                  <p className="app-label">Capital engage</p>
                  <p className="mt-2 text-2xl font-black text-[var(--pmu-text)]">
                    {formatSignedCurrency(data.dashboard.totalStake).replace("+", "")}
                  </p>
                </div>
                <div className="app-card-muted px-4 py-4">
                  <p className="app-label">Gain total</p>
                  <p className="mt-2 text-2xl font-black text-[var(--pmu-text)]">
                    {formatSignedCurrency(data.dashboard.totalGain).replace("+", "")}
                  </p>
                </div>
              </div>

              <div className="mt-5">
                <MiniTimeline points={data.dashboard.timeline} />
              </div>

              {data.dashboardHistory ? (
                <p className="mt-4 text-sm leading-6 text-[var(--pmu-text-soft)]">
                  Fenetre analysee: du {formatShortIsoDate(data.dashboardHistory.startIso)} au{" "}
                  {formatShortIsoDate(data.dashboardHistory.endIso)}.
                </p>
              ) : null}
            </section>

            <section className="grid gap-5">
              <section className="app-card p-5 md:p-6">
                <div className="app-section-heading">
                  <div>
                    <p className="app-kicker">Lecture expert</p>
                    <h2 className="app-section-title">Points forts et zones fragiles</h2>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="app-card-muted px-4 py-4">
                    <p className="app-label">Discipline forte</p>
                    <p className="mt-2 text-lg font-black text-[var(--pmu-text)]">
                      {data.expert.bestDiscipline
                        ? disciplineLabel(data.expert.bestDiscipline.discipline)
                        : "Aucune"}
                    </p>
                    {data.expert.bestDiscipline ? (
                      <p className="mt-2 text-sm text-[var(--pmu-primary)]">
                        {data.expert.bestDiscipline.rate}% de reussite
                      </p>
                    ) : null}
                  </div>
                  <div className="app-card-muted px-4 py-4">
                    <p className="app-label">Discipline fragile</p>
                    <p className="mt-2 text-lg font-black text-[var(--pmu-text)]">
                      {data.expert.worstDiscipline
                        ? disciplineLabel(data.expert.worstDiscipline.discipline)
                        : "Aucune"}
                    </p>
                    {data.expert.worstDiscipline ? (
                      <p className="mt-2 text-sm text-[var(--pmu-red)]">
                        {data.expert.worstDiscipline.rate}% de reussite
                      </p>
                    ) : null}
                  </div>
                  <div className="app-card-muted px-4 py-4">
                    <p className="app-label">Zone fiable</p>
                    <p className="mt-2 text-lg font-black text-[var(--pmu-text)]">
                      {data.expert.bestConfidenceBucket?.label ?? "Aucune"}
                    </p>
                  </div>
                  <div className="app-card-muted px-4 py-4">
                    <p className="app-label">Zone a risque</p>
                    <p className="mt-2 text-lg font-black text-[var(--pmu-text)]">
                      {data.expert.worstConfidenceBucket?.label ?? "Aucune"}
                    </p>
                  </div>
                </div>

                <div className="mt-5">
                  <InsightList items={data.expert.insights} />
                </div>
              </section>

              <section className="app-card p-5 md:p-6">
                <div className="app-section-heading">
                  <div>
                    <p className="app-kicker">Lecture rapide</p>
                    <h2 className="app-section-title">Repartition des tickets</h2>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="app-card-muted px-4 py-4">
                    <p className="app-label">Gagnants</p>
                    <p className="mt-2 text-2xl font-black text-[var(--pmu-primary)]">
                      {winners.length}
                    </p>
                  </div>
                  <div className="app-card-muted px-4 py-4">
                    <p className="app-label">Places</p>
                    <p className="mt-2 text-2xl font-black text-[var(--pmu-orange)]">
                      {places.length}
                    </p>
                  </div>
                  <div className="app-card-muted px-4 py-4">
                    <p className="app-label">Perdus</p>
                    <p className="mt-2 text-2xl font-black text-[var(--pmu-red)]">
                      {losses.length}
                    </p>
                  </div>
                </div>
              </section>
            </section>
          </section>

          {results.length === 0 ? (
            <section className="app-card p-8 text-center">
              <p className="text-xl font-black text-[var(--pmu-text)]">
                Pas encore de resultats termines pour cette date
              </p>
              <p className="mt-3 text-sm leading-6 text-[var(--pmu-text-soft)]">
                Essaie une autre journee ou reviens plus tard pour voir le bilan.
              </p>
            </section>
          ) : (
            <section className="space-y-4">
              <div className="app-section-heading">
                <div>
                  <p className="app-kicker">Tickets du jour</p>
                  <h2 className="app-section-title">Lecture complete des resultats</h2>
                </div>
              </div>
              <div className="grid gap-4 xl:grid-cols-2">
                {results.map((result, index) => (
                  <ResultCard
                    key={`${result.courseInfo.reunion}-${result.courseInfo.course}-${index}`}
                    result={result}
                    onOpen={openCourse}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      ) : null}
    </div>
  );
}

export default function BilanPage() {
  return (
    <Suspense
      fallback={<div className="min-h-[60vh] w-full rounded-[2rem] bg-transparent" />}
    >
      <BilanPageContent />
    </Suspense>
  );
}
