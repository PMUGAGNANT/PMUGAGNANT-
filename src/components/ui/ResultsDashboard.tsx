"use client";

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

function CircularGauge({ value }: { value: number }) {
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, value));
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <svg width="96" height="96" viewBox="0 0 96 96" aria-hidden>
      <circle cx="48" cy="48" r={radius} fill="none" stroke="color-mix(in srgb, var(--pmu-text) 10%, transparent)" strokeWidth="8" />
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
      <text x="48" y="54" textAnchor="middle" fontSize="22" fontWeight="900" fill="var(--pmu-text)">
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
          <div className="font-mono text-4xl font-black tracking-tight" style={{ color: valueColor }}>
            {value}
          </div>
          <p className="mt-2 text-sm leading-6 text-[var(--pmu-text-soft)]">{description}</p>
        </div>
      </div>
    </article>
  );
}

export function ResultsDashboard() {
  const liveStats = useLiveStats();
  const bilan = usePublicResultsData();

  const kpiLoading = liveStats.isLoading;
  const hasLiveData = hasLiveStatsData(liveStats.data);
  const roiTone = liveStats.data.roi30d >= 0 ? "positive" : "negative";
  const bestStreakTone = liveStats.data.bestStreak >= 3 ? "positive" : "default";

  return (
    <div className="grid gap-6">
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
              description="Sur 30 jours"
              tone="positive"
              gaugeValue={liveStats.data.winRate}
            />
            <KpiCard
              label="ROI 30 jours"
              value={formatLiveRoi(liveStats.data.roi30d)}
              description="Retour sur investissement"
              tone={roiTone}
            />
            <KpiCard
              label="Pronos validés"
              value={`${liveStats.data.totalPredictions}`}
              description="Ce mois"
            />
            <KpiCard
              label="Meilleure série"
              value={`${liveStats.data.bestStreak}${liveStats.data.bestStreak >= 3 ? " 🔥" : ""}`}
              description="Série consécutive"
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

      <section className="app-card p-5 md:p-6">
        <div className="app-section-heading">
          <div>
            <p className="app-kicker">ROI cumulé</p>
            <h2 className="app-section-title">Évolution du profit jour après jour</h2>
          </div>
        </div>
        <div className="mt-4">
          <RoiChart timeline={bilan.data?.dashboard?.timeline ?? []} isLoading={bilan.isLoading} />
        </div>
      </section>

      <section className="app-card p-5 md:p-6">
        <div className="app-section-heading">
          <div>
            <p className="app-kicker">Derniers tickets</p>
            <h2 className="app-section-title">20 derniers résultats publiés</h2>
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
            <p className="app-kicker">Par hippodrome</p>
            <h2 className="app-section-title">Les pistes les plus performantes</h2>
          </div>
        </div>
        <div className="mt-4">
          <TrackPerformance tracks={bilan.data?.dashboard?.bestTracks ?? []} isLoading={bilan.isLoading} />
        </div>
      </section>
    </div>
  );
}
