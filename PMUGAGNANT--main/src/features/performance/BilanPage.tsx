"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  PERFORMANCE_SEGMENTS,
  normalizePerformanceBetType,
  normalizePerformanceDistance,
  normalizePerformanceHippodrome,
  normalizePerformancePeriod,
  normalizePerformanceSegment,
  type PerformanceBetType,
  type PerformanceDashboard,
  type PerformanceDistanceFilter,
  type PerformancePeriod,
  type PerformanceSegmentFilter,
} from "@/features/performance/performance-model";

type BilanApiResponse =
  | { success: true; performance: PerformanceDashboard }
  | { success: false; error?: string };

const PERIOD_OPTIONS: Array<{ value: PerformancePeriod; label: string }> = [
  { value: "7j", label: "7j" },
  { value: "30j", label: "30j" },
  { value: "90j", label: "90j" },
  { value: "all", label: "Tout" },
];

const BET_TYPE_OPTIONS: Array<{ value: PerformanceBetType; label: string }> = [
  { value: "ALL", label: "Tous" },
  { value: "GAGNANT", label: "Gagnant" },
  { value: "PLACE", label: "Place" },
];

const DISTANCE_OPTIONS: Array<{ value: PerformanceDistanceFilter; label: string }> = [
  { value: "ALL", label: "Toutes" },
  { value: "SPRINT", label: "Sprint <= 1600m" },
  { value: "MILE", label: "Mile 1601-2200m" },
  { value: "LONG", label: "Long 2200m+" },
];

function formatPercent(value: number) {
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function formatRate(value: number) {
  return `${value.toFixed(1)}%`;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatShortDate(value: string | null) {
  if (!value) return "--";
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
  }).format(date);
}

function segmentLabel(segment: PerformanceSegmentFilter) {
  if (segment === "ALL") return "Tous segments";
  return segment.replaceAll("_", " ");
}

function formatResult(value: string) {
  if (value === "EN_ATTENTE") return "En attente";
  if (value === "GAGNANT") return "Gagnant";
  if (value === "PLACE") return "Place";
  return "Perdu";
}

function KpiCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
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

function FilterSelect<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-[var(--pmu-text-muted)]">
        {label}
      </span>
      <select
        className="app-input"
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex h-72 items-center justify-center rounded-[1rem] border border-dashed border-[var(--pmu-border)] text-sm text-[var(--pmu-text-soft)]">
      {text}
    </div>
  );
}

function BilanPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const period = normalizePerformancePeriod(searchParams.get("period"));
  const segment = normalizePerformanceSegment(searchParams.get("segment"));
  const betType = normalizePerformanceBetType(searchParams.get("bet_type"));
  const hippodrome = normalizePerformanceHippodrome(searchParams.get("hippodrome"));
  const distance = normalizePerformanceDistance(searchParams.get("distance"));

  const [data, setData] = useState<PerformanceDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    let cancelled = false;

    async function loadDashboard() {
      setLoading(true);
      setError(null);

      try {
        const qs = new URLSearchParams({
          mode: "performance",
          period,
          segment,
          bet_type: betType,
          hippodrome,
          distance,
        });
        const response = await fetch(`/api/bilan?${qs.toString()}`, {
          cache: "no-store",
          signal: ac.signal,
        });
        const payload = (await response.json()) as BilanApiResponse;

        if (cancelled) return;
        if (!response.ok || !payload.success) {
          throw new Error(payload.success ? "Cockpit indisponible." : payload.error ?? "Cockpit indisponible.");
        }

        setData(payload.performance);
      } catch (loadError) {
        if (cancelled) return;
        if (loadError instanceof Error && loadError.name === "AbortError") return;
        setData(null);
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Impossible de charger le cockpit performance."
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadDashboard();
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [period, segment, betType, hippodrome, distance]);

  const segmentOptions = useMemo(
    () => [
      { value: "ALL" as const, label: "Tous" },
      ...PERFORMANCE_SEGMENTS.map((value) => ({
        value,
        label: value.replaceAll("_", " "),
      })),
    ],
    []
  );
  const hippodromeOptions = useMemo(
    () => [
      { value: "ALL", label: "Tous" },
      ...(data?.availableHippodromes ?? []).map((value) => ({
        value,
        label: value,
      })),
    ],
    [data?.availableHippodromes]
  );

  function updateFilters(next: Partial<{
    period: PerformancePeriod;
    segment: PerformanceSegmentFilter;
    betType: PerformanceBetType;
    hippodrome: string;
    distance: PerformanceDistanceFilter;
  }>) {
    const qs = new URLSearchParams({
      period: next.period ?? period,
      segment: next.segment ?? segment,
      bet_type: next.betType ?? betType,
      hippodrome: next.hippodrome ?? hippodrome,
      distance: next.distance ?? distance,
    });
    router.replace(`/bilan?${qs.toString()}`, { scroll: false });
  }

  function exportMonthlyPdf() {
    window.print();
  }

  const kpis = data?.kpis;
  const roiTone = (kpis?.globalRoi ?? 0) >= 0 ? "good" : "bad";
  const gainTone = (kpis?.netGain ?? 0) >= 0 ? "good" : "bad";
  const weeklySummary = data?.rangeSummaries.find((summary) => summary.period === "7j") ?? null;
  const weeklyNetGain = weeklySummary?.netGain ?? 0;
  const weeklyStake = weeklySummary?.stake ?? 0;

  return (
    <div className="mx-auto flex w-full max-w-[96rem] flex-col gap-6 lg:gap-8">
      <section className="app-page-hero p-6 md:p-8">
        <div className="relative z-[1] grid gap-5 xl:grid-cols-[1.05fr,0.95fr] xl:items-end">
          <div>
            <p className="app-kicker">Bilan des gains</p>
            <h1 className="max-w-4xl text-4xl font-black leading-[0.93] text-[var(--pmu-text)] md:text-6xl">
              Ce que TurfEdge aurait change sur tes tickets.
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--pmu-text-soft)] md:text-base">
              Lis d&apos;abord les gains reels, puis le ROI. Le cockpit garde les
              details pour comprendre quand l&apos;algo est fort, prudent ou a eviter.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-5">
            <FilterSelect
              label="Periode"
              value={period}
              options={PERIOD_OPTIONS}
              onChange={(value) => updateFilters({ period: value })}
            />
            <FilterSelect
              label="Segment"
              value={segment}
              options={segmentOptions}
              onChange={(value) => updateFilters({ segment: value })}
            />
            <FilterSelect
              label="Pari"
              value={betType}
              options={BET_TYPE_OPTIONS}
              onChange={(value) => updateFilters({ betType: value })}
            />
            <FilterSelect
              label="Hippodrome"
              value={hippodrome}
              options={hippodromeOptions}
              onChange={(value) => updateFilters({ hippodrome: value })}
            />
            <FilterSelect
              label="Distance"
              value={distance}
              options={DISTANCE_OPTIONS}
              onChange={(value) => updateFilters({ distance: value })}
            />
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="app-card-muted px-4 py-3">
              <p className="app-label">Fenetre analysee</p>
              <p className="mt-1 text-sm font-black text-[var(--pmu-text)]">
                {data
                  ? `${formatShortDate(data.range.startIso)} - ${formatShortDate(data.range.endIso)}`
                  : "--"}
              </p>
            </div>
            <div className="app-card-muted px-4 py-3">
              <p className="app-label">Dernier ticket settle</p>
              <p className="mt-1 text-sm font-black text-[var(--pmu-text)]">
                {data ? formatShortDate(data.range.lastSettledDate) : "--"}
              </p>
            </div>
            <div className="app-card-muted px-4 py-3">
              <p className="app-label">Calibration</p>
              <p className="mt-1 text-sm font-black text-[var(--pmu-text)]">
                {data ? `${data.risk.calibrationSampleSize} lignes` : "--"}
              </p>
            </div>
          </div>
          <div className="flex justify-start xl:justify-end">
            <button type="button" className="app-button-secondary w-full md:w-auto" onClick={exportMonthlyPdf}>
              Export PDF mensuel
            </button>
          </div>
        </div>
      </section>

      {loading ? (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {Array.from({ length: 5 }, (_, index) => (
            <div key={index} className="app-card h-32 animate-pulse bg-[var(--pmu-surface-highlight)]" />
          ))}
        </section>
      ) : error ? (
        <section className="app-card p-6" role="alert">
          <p className="app-kicker">Bilan</p>
          <h2 className="mt-2 text-3xl font-black text-[var(--pmu-text)]">
            Cockpit indisponible
          </h2>
          <p className="mt-3 text-sm leading-7 text-[var(--pmu-text-soft)]">{error}</p>
        </section>
      ) : data && kpis ? (
        <>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
            <KpiCard label="ROI global" value={formatPercent(kpis.globalRoi)} tone={roiTone} />
            <KpiCard label="Paris valides" value={String(kpis.validatedBets)} />
            <KpiCard label="Reussite gagnant" value={formatRate(kpis.winRate)} tone="good" />
            <KpiCard label="Reussite place" value={formatRate(kpis.placeRate)} tone="warn" />
            <KpiCard label="Gain net" value={formatCurrency(kpis.netGain)} tone={gainTone} />
            <KpiCard label="Rendement" value={formatRate(kpis.paybackRate)} tone={kpis.paybackRate >= 100 ? "good" : "bad"} />
          </section>

          <section className="grid gap-4 lg:grid-cols-[1.1fr,0.9fr]">
            <article className="app-page-hero p-5 md:p-7">
              <p className="app-kicker">Cette semaine</p>
              <h2 className="mt-2 text-3xl font-black leading-tight text-[var(--pmu-text)] md:text-5xl">
                Si tu avais suivi nos conseils :{" "}
                <span style={{ color: weeklyNetGain >= 0 ? "var(--pmu-primary)" : "var(--pmu-red)" }}>
                  {formatCurrency(weeklyNetGain)}
                </span>
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--pmu-text-soft)]">
                Calcul base sur les tickets valides, les mises conseillees et les
                resultats officiels deja rapproches dans l&apos;historique.
              </p>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <div className="result-chip px-4 py-3">
                  <p className="app-label">Mises conseillees</p>
                  <p className="mt-1 text-xl font-black text-[var(--pmu-text)]">
                    {formatCurrency(weeklyStake)}
                  </p>
                </div>
                <div className="result-chip px-4 py-3">
                  <p className="app-label">Tickets valides</p>
                  <p className="mt-1 text-xl font-black text-[var(--pmu-text)]">
                    {weeklySummary?.bets ?? 0}
                  </p>
                </div>
                <div className="result-chip px-4 py-3">
                  <p className="app-label">ROI 7 jours</p>
                  <p className="mt-1 text-xl font-black text-[var(--pmu-primary)]">
                    {formatPercent(weeklySummary?.roi ?? 0)}
                  </p>
                </div>
              </div>
            </article>

            <article className="app-card p-5 md:p-6">
              <p className="app-kicker">Sans TurfEdge vs avec TurfEdge</p>
              <div className="mt-4 grid gap-3">
                <div className="rounded-lg border border-[var(--pmu-border)] bg-[var(--pmu-surface-2)] p-4">
                  <p className="app-label">Sans TurfEdge</p>
                  <p className="mt-1 text-2xl font-black text-[var(--pmu-text-muted)]">
                    0,00 EUR suivi
                  </p>
                  <p className="mt-1 text-xs leading-5 text-[var(--pmu-text-soft)]">
                    Pas de filtre, pas de mise calculee, pas de bilan mesure.
                  </p>
                </div>
                <div className="rounded-lg border border-[color-mix(in_srgb,var(--pmu-primary)_28%,transparent)] bg-[var(--pmu-primary-fade)] p-4">
                  <p className="app-label">Avec TurfEdge</p>
                  <p className="mt-1 text-2xl font-black text-[var(--pmu-primary)]">
                    {formatCurrency(weeklyNetGain)}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-[var(--pmu-text-soft)]">
                    Des courses filtrees, une mise conseillee, un resultat verifie.
                  </p>
                </div>
              </div>
            </article>
          </section>

          <section className="grid gap-4 md:grid-cols-3">
            {data.rangeSummaries.map((summary) => (
              <article key={summary.period} className="app-card p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="app-kicker">ROI {summary.label}</p>
                    <p className="mt-2 text-3xl font-black" style={{ color: summary.roi >= 0 ? "var(--pmu-primary)" : "var(--pmu-red)" }}>
                      {formatPercent(summary.roi)}
                    </p>
                  </div>
                  <span className="app-pill text-xs">{summary.bets} paris</span>
                </div>
                <div className="mt-4 h-24">
                  {summary.timeline.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={summary.timeline}>
                        <Line
                          type="monotone"
                          dataKey="cumulativeRoi"
                          stroke={summary.roi >= 0 ? "var(--pmu-primary)" : "var(--pmu-red)"}
                          strokeWidth={2}
                          dot={false}
                        />
                        <Tooltip
                          contentStyle={{
                            background: "var(--pmu-surface)",
                            border: "1px solid var(--pmu-border)",
                            color: "var(--pmu-text)",
                          }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-full items-center text-sm text-[var(--pmu-text-soft)]">
                      Aucun ticket regle
                    </div>
                  )}
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="app-card-muted px-3 py-2">
                    <p className="app-label">Mises</p>
                    <p className="font-black text-[var(--pmu-text)]">{formatCurrency(summary.stake)}</p>
                  </div>
                  <div className="app-card-muted px-3 py-2">
                    <p className="app-label">Net</p>
                    <p className="font-black" style={{ color: summary.netGain >= 0 ? "var(--pmu-primary)" : "var(--pmu-red)" }}>
                      {formatCurrency(summary.netGain)}
                    </p>
                  </div>
                </div>
              </article>
            ))}
          </section>

          <section className="grid gap-5 xl:grid-cols-[1.05fr,0.95fr]">
            <section className="app-card p-5 md:p-6">
              <div className="app-section-heading">
                <div>
                  <p className="app-kicker">ROI cumule</p>
                  <h2 className="app-section-title">Evolution dans le temps</h2>
                </div>
                <span className="app-pill text-xs">{segmentLabel(segment)}</span>
              </div>

              {data.timeline.length > 0 ? (
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data.timeline}>
                      <CartesianGrid stroke="var(--pmu-border)" strokeDasharray="4 4" />
                      <XAxis dataKey="date" tick={{ fill: "var(--pmu-text-soft)", fontSize: 12 }} />
                      <YAxis tick={{ fill: "var(--pmu-text-soft)", fontSize: 12 }} unit="%" />
                      <Tooltip
                        contentStyle={{
                          background: "var(--pmu-surface)",
                          border: "1px solid var(--pmu-border)",
                          color: "var(--pmu-text)",
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="cumulativeRoi"
                        name="ROI cumule"
                        stroke="var(--pmu-primary)"
                        strokeWidth={3}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <EmptyState text="Pas encore de tickets settles pour cette fenetre." />
              )}

              <div className="mt-5 grid gap-3 md:grid-cols-4">
                <div className="app-card-muted px-4 py-3">
                  <p className="app-label">Profit cumule</p>
                  <p className="mt-1 text-lg font-black text-[var(--pmu-text)]">
                    {formatCurrency(kpis.netGain)}
                  </p>
                </div>
                <div className="app-card-muted px-4 py-3">
                  <p className="app-label">Drawdown max</p>
                  <p className="mt-1 text-lg font-black text-[var(--pmu-red)]">
                    {formatCurrency(data.risk.maxDrawdown)}
                  </p>
                </div>
                <div className="app-card-muted px-4 py-3">
                  <p className="app-label">Meilleur jour</p>
                  <p className="mt-1 text-lg font-black text-[var(--pmu-primary)]">
                    {formatCurrency(data.risk.bestDayProfit)}
                  </p>
                </div>
                <div className="app-card-muted px-4 py-3">
                  <p className="app-label">Pire jour</p>
                  <p className="mt-1 text-lg font-black text-[var(--pmu-red)]">
                    {formatCurrency(data.risk.worstDayProfit)}
                  </p>
                </div>
              </div>
            </section>

            <section className="app-card p-5 md:p-6">
              <div className="app-section-heading">
                <div>
                  <p className="app-kicker">Calibration</p>
                  <h2 className="app-section-title">Probabilite estimee vs victoire</h2>
                </div>
              </div>

              {data.calibration.some((bin) => bin.sampleSize > 0) ? (
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.calibration}>
                      <CartesianGrid stroke="var(--pmu-border)" strokeDasharray="4 4" />
                      <XAxis dataKey="label" tick={{ fill: "var(--pmu-text-soft)", fontSize: 12 }} />
                      <YAxis tick={{ fill: "var(--pmu-text-soft)", fontSize: 12 }} unit="%" />
                      <Tooltip
                        contentStyle={{
                          background: "var(--pmu-surface)",
                          border: "1px solid var(--pmu-border)",
                          color: "var(--pmu-text)",
                        }}
                      />
                      <Legend />
                      <Bar dataKey="averageProbability" name="Proba estimee" fill="var(--pmu-orange)" radius={6} />
                      <Bar dataKey="actualWinRate" name="Victoire reelle" fill="var(--pmu-primary)" radius={6} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <EmptyState text="Pas assez d'historique pour calibrer cette vue." />
              )}

              <div className="mt-5 grid gap-3 md:grid-cols-3">
                <div className="app-card-muted px-4 py-3">
                  <p className="app-label">Erreur calibration</p>
                  <p className="mt-1 text-lg font-black text-[var(--pmu-text)]">
                    {formatRate(data.risk.calibrationError)}
                  </p>
                </div>
                <div className="app-card-muted px-4 py-3">
                  <p className="app-label">Paris en attente</p>
                  <p className="mt-1 text-lg font-black text-[var(--pmu-text)]">
                    {data.risk.pendingBets}
                  </p>
                </div>
                <div className="app-card-muted px-4 py-3">
                  <p className="app-label">Mise moyenne</p>
                  <p className="mt-1 text-lg font-black text-[var(--pmu-text)]">
                    {formatCurrency(data.risk.averageStake)}
                  </p>
                </div>
              </div>
            </section>
          </section>

          <section className="app-card overflow-hidden p-0">
            <div className="app-section-heading p-5 md:p-6">
              <div>
                <p className="app-kicker">Segments</p>
                <h2 className="app-section-title">ROI et taux gagnant par profil de course</h2>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[64rem] text-left text-sm">
                <thead className="border-y border-[var(--pmu-border)] bg-[var(--pmu-surface-2)] text-[var(--pmu-text-muted)]">
                  <tr>
                    <th className="px-5 py-3">Segment</th>
                    <th className="px-5 py-3">Paris</th>
                    <th className="px-5 py-3">G/P</th>
                    <th className="px-5 py-3">ROI</th>
                    <th className="px-5 py-3">Taux win</th>
                    <th className="px-5 py-3">Taux place</th>
                    <th className="px-5 py-3">Conf.</th>
                    <th className="px-5 py-3">Cote moy.</th>
                    <th className="px-5 py-3">Mise</th>
                    <th className="px-5 py-3">Net</th>
                  </tr>
                </thead>
                <tbody>
                  {data.segments.map((row) => (
                    <tr key={row.segment} className="border-b border-[var(--pmu-border)] last:border-b-0">
                      <td className="px-5 py-4 font-black text-[var(--pmu-text)]">
                        {row.segment.replaceAll("_", " ")}
                      </td>
                      <td className="px-5 py-4 text-[var(--pmu-text-soft)]">{row.bets}</td>
                      <td className="px-5 py-4 text-[var(--pmu-text-soft)]">
                        {row.wins}/{row.places}
                      </td>
                      <td className="px-5 py-4 font-black" style={{ color: row.roi >= 0 ? "var(--pmu-primary)" : "var(--pmu-red)" }}>
                        {formatPercent(row.roi)}
                      </td>
                      <td className="px-5 py-4 text-[var(--pmu-text-soft)]">{formatRate(row.winRate)}</td>
                      <td className="px-5 py-4 text-[var(--pmu-text-soft)]">{formatRate(row.placeRate)}</td>
                      <td className="px-5 py-4 text-[var(--pmu-text-soft)]">{row.averageConfidence.toFixed(1)}</td>
                      <td className="px-5 py-4 text-[var(--pmu-text-soft)]">
                        {row.averageOdds === null ? "--" : row.averageOdds.toFixed(1)}
                      </td>
                      <td className="px-5 py-4 text-[var(--pmu-text-soft)]">{formatCurrency(row.stake)}</td>
                      <td className="px-5 py-4 font-black" style={{ color: row.netGain >= 0 ? "var(--pmu-primary)" : "var(--pmu-red)" }}>
                        {formatCurrency(row.netGain)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="app-card overflow-hidden p-0">
            <div className="app-section-heading p-5 md:p-6">
              <div>
                <p className="app-kicker">Mises et resultats</p>
                <h2 className="app-section-title">Conseil moteur vs ticket joue</h2>
              </div>
              <span className="app-pill text-xs">{data.comparisonRows.length} lignes</span>
            </div>
            {data.comparisonRows.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[70rem] text-left text-sm">
                  <thead className="border-y border-[var(--pmu-border)] bg-[var(--pmu-surface-2)] text-[var(--pmu-text-muted)]">
                    <tr>
                      <th className="px-5 py-3">Date</th>
                      <th className="px-5 py-3">Course</th>
                      <th className="px-5 py-3">Cheval</th>
                      <th className="px-5 py-3">Pari</th>
                      <th className="px-5 py-3">Decision</th>
                      <th className="px-5 py-3">Mise conseillee</th>
                      <th className="px-5 py-3">Mise jouee</th>
                      <th className="px-5 py-3">Gain</th>
                      <th className="px-5 py-3">Net</th>
                      <th className="px-5 py-3">Resultat</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.comparisonRows.map((row) => (
                      <tr key={row.id} className="border-b border-[var(--pmu-border)] last:border-b-0">
                        <td className="px-5 py-4 text-[var(--pmu-text-soft)]">{formatShortDate(row.date)}</td>
                        <td className="px-5 py-4">
                          <p className="font-black text-[var(--pmu-text)]">{row.raceLabel}</p>
                          <p className="text-xs text-[var(--pmu-text-muted)]">{row.hippodrome}</p>
                        </td>
                        <td className="px-5 py-4 font-black text-[var(--pmu-text)]">{row.cheval}</td>
                        <td className="px-5 py-4 text-[var(--pmu-text-soft)]">{row.betType ?? "--"}</td>
                        <td className="px-5 py-4 text-[var(--pmu-text-soft)]">{row.decision}</td>
                        <td className="px-5 py-4 text-[var(--pmu-text-soft)]">{formatCurrency(row.suggestedStake)}</td>
                        <td className="px-5 py-4 font-black text-[var(--pmu-text)]">{formatCurrency(row.actualStake)}</td>
                        <td className="px-5 py-4 text-[var(--pmu-text-soft)]">{formatCurrency(row.gain)}</td>
                        <td className="px-5 py-4 font-black" style={{ color: row.netGain >= 0 ? "var(--pmu-primary)" : "var(--pmu-red)" }}>
                          {formatCurrency(row.netGain)}
                        </td>
                        <td className="px-5 py-4 text-[var(--pmu-text-soft)]">{formatResult(row.result)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-5 md:p-6">
                <EmptyState text="Aucune mise a comparer sur cette fenetre." />
              </div>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}

export default function BilanPage() {
  return (
    <Suspense fallback={<div className="min-h-[60vh] w-full rounded-[2rem] bg-transparent" />}>
      <BilanPageContent />
    </Suspense>
  );
}
