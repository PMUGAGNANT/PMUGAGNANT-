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
  normalizePerformancePeriod,
  normalizePerformanceSegment,
  type PerformanceBetType,
  type PerformanceDashboard,
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

function segmentLabel(segment: PerformanceSegmentFilter) {
  if (segment === "ALL") return "Tous segments";
  return segment.replaceAll("_", " ");
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
  }, [period, segment, betType]);

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

  function updateFilters(next: Partial<{
    period: PerformancePeriod;
    segment: PerformanceSegmentFilter;
    betType: PerformanceBetType;
  }>) {
    const qs = new URLSearchParams({
      period: next.period ?? period,
      segment: next.segment ?? segment,
      bet_type: next.betType ?? betType,
    });
    router.replace(`/bilan?${qs.toString()}`, { scroll: false });
  }

  const kpis = data?.kpis;
  const roiTone = (kpis?.globalRoi ?? 0) >= 0 ? "good" : "bad";
  const gainTone = (kpis?.netGain ?? 0) >= 0 ? "good" : "bad";

  return (
    <div className="mx-auto flex w-full max-w-[96rem] flex-col gap-6 lg:gap-8">
      <section className="app-page-hero p-6 md:p-8">
        <div className="relative z-[1] grid gap-5 xl:grid-cols-[1.05fr,0.95fr] xl:items-end">
          <div>
            <p className="app-kicker">Cockpit ROI</p>
            <h1 className="max-w-4xl text-4xl font-black leading-[0.93] text-[var(--pmu-text)] md:text-6xl">
              Performance moteur, calibration et segments en un seul poste.
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--pmu-text-soft)] md:text-base">
              Les tickets valides, le ROI cumule, la frequence reelle de victoire
              et les segments se lisent ici sans refaire le calcul a la main.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
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
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <KpiCard label="ROI global" value={formatPercent(kpis.globalRoi)} tone={roiTone} />
            <KpiCard label="Paris valides" value={String(kpis.validatedBets)} />
            <KpiCard label="Reussite gagnant" value={formatRate(kpis.winRate)} tone="good" />
            <KpiCard label="Reussite place" value={formatRate(kpis.placeRate)} tone="warn" />
            <KpiCard label="Gain net" value={formatCurrency(kpis.netGain)} tone={gainTone} />
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
              <table className="w-full min-w-[46rem] text-left text-sm">
                <thead className="border-y border-[var(--pmu-border)] bg-[var(--pmu-surface-2)] text-[var(--pmu-text-muted)]">
                  <tr>
                    <th className="px-5 py-3">Segment</th>
                    <th className="px-5 py-3">Paris</th>
                    <th className="px-5 py-3">ROI</th>
                    <th className="px-5 py-3">Taux win</th>
                    <th className="px-5 py-3">Mise</th>
                    <th className="px-5 py-3">Gains</th>
                  </tr>
                </thead>
                <tbody>
                  {data.segments.map((row) => (
                    <tr key={row.segment} className="border-b border-[var(--pmu-border)] last:border-b-0">
                      <td className="px-5 py-4 font-black text-[var(--pmu-text)]">
                        {row.segment.replaceAll("_", " ")}
                      </td>
                      <td className="px-5 py-4 text-[var(--pmu-text-soft)]">{row.bets}</td>
                      <td className="px-5 py-4 font-black" style={{ color: row.roi >= 0 ? "var(--pmu-primary)" : "var(--pmu-red)" }}>
                        {formatPercent(row.roi)}
                      </td>
                      <td className="px-5 py-4 text-[var(--pmu-text-soft)]">{formatRate(row.winRate)}</td>
                      <td className="px-5 py-4 text-[var(--pmu-text-soft)]">{formatCurrency(row.stake)}</td>
                      <td className="px-5 py-4 text-[var(--pmu-text-soft)]">{formatCurrency(row.gain)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
