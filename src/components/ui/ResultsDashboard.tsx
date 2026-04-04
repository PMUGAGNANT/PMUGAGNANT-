"use client";

import { useMemo } from "react";
import { RoiChart } from "@/components/ui/RoiChart";
import { RecentResultsTable } from "@/components/ui/RecentResultsTable";
import { TrackPerformance } from "@/components/ui/TrackPerformance";
import {
  formatLivePercent,
  formatLiveRoi,
  hasLiveStatsData,
} from "@/lib/live-stats";
import { useLiveStats } from "@/lib/use-live-stats";
import { usePublicResultsData } from "@/lib/use-public-results";

function KpiSkeleton() {
  return (
    <div className="app-card animate-pulse p-5 md:p-6">
      <div className="h-3 w-28 rounded-full bg-[color-mix(in_srgb,var(--pmu-text-muted)_14%,transparent)]" />
      <div className="mt-5 h-20 w-20 rounded-full bg-[color-mix(in_srgb,var(--pmu-text-muted)_14%,transparent)]" />
      <div className="mt-4 h-4 w-36 rounded-full bg-[color-mix(in_srgb,var(--pmu-text-muted)_14%,transparent)]" />
    </div>
  );
}

function formatEuro(value: number) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)} €`;
}

function formatShortDate(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }

  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function CircularGauge({ value }: { value: number }) {
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, value));
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <svg width="96" height="96" viewBox="0 0 96 96" aria-hidden>
      <circle
        cx="48"
        cy="48"
        r={radius}
        fill="none"
        stroke="color-mix(in srgb, var(--pmu-text) 10%, transparent)"
        strokeWidth="8"
      />
      <circle
        cx="48"
        cy="48"
        r={radius}
        fill="none"
        stroke="#00FF88"
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform="rotate(-90 48 48)"
      />
      <text
        x="48"
        y="54"
        textAnchor="middle"
        fontSize="22"
        fontWeight="900"
        fill="var(--pmu-text)"
      >
        {Math.round(clamped)}%
      </text>
    </svg>
  );
}

function KpiCard({
  label,
  value,
  description,
  tone = "default",
  gaugeValue,
}: {
  label: string;
  value: string;
  description: string;
  tone?: "default" | "positive" | "negative";
  gaugeValue?: number;
}) {
  const valueColor =
    tone === "positive"
      ? "var(--pmu-primary)"
      : tone === "negative"
        ? "#FF4444"
        : "var(--pmu-text)";

  return (
    <article className="app-card p-5 md:p-6">
      <p className="app-label">{label}</p>
      <div className="mt-4 flex items-center gap-4">
        {typeof gaugeValue === "number" ? <CircularGauge value={gaugeValue} /> : null}
        <div>
          <div
            className="font-mono text-4xl font-black tracking-tight"
            style={{ color: valueColor }}
          >
            {value}
          </div>
          <p className="mt-2 text-sm leading-6 text-[var(--pmu-text-soft)]">{description}</p>
        </div>
      </div>
    </article>
  );
}

function HighlightStat({
  label,
  value,
  tone = "default",
  detail,
}: {
  label: string;
  value: string;
  tone?: "default" | "positive" | "negative";
  detail?: string;
}) {
  const color =
    tone === "positive"
      ? "var(--pmu-primary)"
      : tone === "negative"
        ? "#FF4444"
        : "var(--pmu-text)";

  return (
    <div className="app-card-muted px-4 py-4">
      <p className="app-label">{label}</p>
      <div className="mt-3 font-mono text-2xl font-black tracking-tight" style={{ color }}>
        {value}
      </div>
      {detail ? (
        <p className="mt-2 text-sm leading-6 text-[var(--pmu-text-soft)]">{detail}</p>
      ) : null}
    </div>
  );
}

function InsightCard({
  label,
  title,
  value,
  detail,
  tone = "default",
}: {
  label: string;
  title: string;
  value: string;
  detail: string;
  tone?: "default" | "positive" | "negative";
}) {
  const color =
    tone === "positive"
      ? "var(--pmu-primary)"
      : tone === "negative"
        ? "#FF4444"
        : "var(--pmu-text)";

  return (
    <article className="app-card p-5">
      <p className="app-label">{label}</p>
      <h3 className="mt-3 text-xl font-black tracking-tight text-[var(--pmu-text)]">
        {title}
      </h3>
      <div className="mt-2 font-mono text-2xl font-black tracking-tight" style={{ color }}>
        {value}
      </div>
      <p className="mt-2 text-sm leading-6 text-[var(--pmu-text-soft)]">{detail}</p>
    </article>
  );
}

export function ResultsDashboard() {
  const liveStats = useLiveStats();
  const bilan = usePublicResultsData();
  const dashboard = bilan.data?.dashboard;
  const dashboardHistory = bilan.data?.dashboardHistory;

  const kpiLoading = liveStats.isLoading;
  const hasLiveData = hasLiveStatsData(liveStats.data);
  const hasLongWindowData = Boolean(dashboard?.available && dashboardHistory);
  const roiTone = liveStats.data.roi30d >= 0 ? "positive" : "negative";
  const bestStreakTone = liveStats.data.bestStreak >= 3 ? "positive" : "default";

  const profitNet = useMemo(() => {
    if (!dashboard) return 0;
    return dashboard.totalGain - dashboard.totalStake;
  }, [dashboard]);

  const edgeVsRandom = useMemo(() => {
    if (!dashboard) return 0;
    return dashboard.algoSuccessRate - dashboard.randomSuccessRate;
  }, [dashboard]);

  const topTrack = dashboard?.bestTracks?.[0] ?? null;
  const topBetType = dashboard?.bestBetTypes?.[0] ?? null;
  const topJockey = dashboard?.bestJockeys?.[0] ?? null;
  const dashboardSummary = hasLongWindowData && dashboard ? dashboard : null;
  const historySummary = hasLongWindowData && dashboardHistory ? dashboardHistory : null;

  return (
    <div className="grid gap-6">
      <section className="app-card overflow-hidden p-5 md:p-6">
        <div className="grid gap-5 xl:grid-cols-[1.08fr,0.92fr] xl:items-start">
          <div>
            <p className="app-kicker">Lecture 12 mois</p>
            <h2 className="app-section-title">Ce que raconte réellement une année de tickets</h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--pmu-text-soft)] md:text-base">
              Le moteur n&apos;a de valeur que s&apos;il garde un avantage sur la durée. Ici, on regarde
              la période complète, le profit net et l&apos;écart face à une sélection au hasard.
            </p>
            {historySummary && dashboardSummary ? (
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="app-pill app-pill--active">{historySummary.days} jours analysés</span>
                <span className="app-pill">
                  {formatShortDate(historySummary.startIso)} → {formatShortDate(historySummary.endIso)}
                </span>
                <span className="app-pill">{dashboardSummary.totalBets} tickets recalculés</span>
                <span className="app-pill">
                  {edgeVsRandom >= 0 ? "+" : ""}
                  {edgeVsRandom.toFixed(1)} pts vs hasard
                </span>
              </div>
            ) : (
              <div className="mt-4 inline-flex">
                <span className="app-pill">Données en cours de collecte</span>
              </div>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <HighlightStat
              label="Profit net"
              value={hasLongWindowData ? formatEuro(profitNet) : "—"}
              tone={profitNet >= 0 ? "positive" : "negative"}
              detail="Gains moins mises sur la période visible"
            />
            <HighlightStat
              label="Taux moteur"
              value={dashboardSummary ? formatLivePercent(dashboardSummary.algoSuccessRate, 1) : "—"}
              tone={
                dashboardSummary &&
                dashboardSummary.algoSuccessRate >= dashboardSummary.randomSuccessRate
                  ? "positive"
                  : "default"
              }
              detail="Réussite du moteur sur la période longue"
            />
            <HighlightStat
              label="Référence hasard"
              value={dashboardSummary ? formatLivePercent(dashboardSummary.randomSuccessRate, 1) : "—"}
              detail="Base de comparaison brute sur la même période"
            />
            <HighlightStat
              label="Capital engagé"
              value={dashboardSummary ? formatEuro(dashboardSummary.totalStake) : "—"}
              detail="Somme totale des mises simulées"
            />
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {kpiLoading ? (
          <>
            <KpiSkeleton />
            <KpiSkeleton />
            <KpiSkeleton />
            <KpiSkeleton />
          </>
        ) : hasLiveData ? (
          <>
            <KpiCard
              label="Taux de réussite"
              value={formatLivePercent(liveStats.data.winRate, 0)}
              description="Fenêtre glissante 30 jours"
              tone="positive"
              gaugeValue={liveStats.data.winRate}
            />
            <KpiCard
              label="ROI 30 jours"
              value={formatLiveRoi(liveStats.data.roi30d)}
              description="Retour sur investissement récent"
              tone={roiTone}
            />
            <KpiCard
              label="Pronos validés"
              value={`${liveStats.data.totalPredictions}`}
              description="Tickets réellement publiés"
            />
            <KpiCard
              label="Meilleure série"
              value={`${liveStats.data.bestStreak}${liveStats.data.bestStreak >= 3 ? " 🔥" : ""}`}
              description="Série récente la plus solide"
              tone={bestStreakTone}
            />
          </>
        ) : (
          <>
            <KpiCard label="Taux de réussite" value="—" description="Données en cours de collecte" />
            <KpiCard label="ROI 30 jours" value="—" description="Données en cours de collecte" />
            <KpiCard label="Pronos validés" value="—" description="Données en cours de collecte" />
            <KpiCard label="Meilleure série" value="—" description="Données en cours de collecte" />
          </>
        )}
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <InsightCard
          label="Piste la plus rentable"
          title={topTrack?.label ?? "En attente"}
          value={topTrack ? formatLiveRoi(topTrack.roi) : "—"}
          detail={topTrack ? `${topTrack.sample} tickets sur la période` : "Données en cours de collecte"}
          tone={topTrack ? (topTrack.roi >= 0 ? "positive" : "negative") : "default"}
        />
        <InsightCard
          label="Type de pari le plus fort"
          title={topBetType?.label ?? "En attente"}
          value={topBetType ? formatLiveRoi(topBetType.roi) : "—"}
          detail={topBetType ? `${topBetType.sample} tickets sur la période` : "Données en cours de collecte"}
          tone={topBetType ? (topBetType.roi >= 0 ? "positive" : "negative") : "default"}
        />
        <InsightCard
          label="Jockey / driver le plus rentable"
          title={topJockey?.label ?? "En attente"}
          value={topJockey ? formatLiveRoi(topJockey.roi) : "—"}
          detail={topJockey ? `${topJockey.sample} tickets sur la période` : "Données en cours de collecte"}
          tone={topJockey ? (topJockey.roi >= 0 ? "positive" : "negative") : "default"}
        />
      </section>

      <section className="app-card p-5 md:p-6">
        <div className="app-section-heading">
          <div>
            <p className="app-kicker">Courbe 12 mois</p>
            <h2 className="app-section-title">Évolution du profit jour après jour</h2>
            {historySummary ? (
              <p className="mt-2 text-sm leading-6 text-[var(--pmu-text-soft)]">
                Du {formatShortDate(historySummary.startIso)} au {formatShortDate(historySummary.endIso)}.
              </p>
            ) : null}
          </div>
        </div>
        <div className="mt-4">
          <RoiChart timeline={dashboard?.timeline ?? []} isLoading={bilan.isLoading} />
        </div>
      </section>

      <section className="app-card p-5 md:p-6">
        <div className="app-section-heading">
          <div>
            <p className="app-kicker">Transparence brute</p>
            <h2 className="app-section-title">20 derniers tickets publiés</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--pmu-text-soft)]">
              Les plus récents d&apos;abord, sans masquer les tickets perdants.
            </p>
          </div>
          {bilan.error ? (
            <p className="text-sm font-semibold text-[#FF4444]">{bilan.error}</p>
          ) : null}
        </div>
        <div className="mt-4">
          <RecentResultsTable results={bilan.data?.results ?? []} isLoading={bilan.isLoading} />
        </div>
      </section>

      <section className="app-card p-5 md:p-6">
        <div className="app-section-heading">
          <div>
            <p className="app-kicker">Où le moteur performe</p>
            <h2 className="app-section-title">Les hippodromes les plus rentables</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--pmu-text-soft)]">
              Un bon ROI n&apos;a de valeur que s&apos;il s&apos;appuie sur un volume de tickets suffisant.
            </p>
          </div>
        </div>
        <div className="mt-4">
          <TrackPerformance tracks={dashboard?.bestTracks ?? []} isLoading={bilan.isLoading} />
        </div>
      </section>
    </div>
  );
}
