"use client";

import {
  formatLivePercent,
  formatLiveRoi,
  formatLiveTimestamp,
  hasLiveStatsData,
} from "@/lib/live-stats";
import { useLiveStats } from "@/lib/use-live-stats";

function ProofSkeletonCard() {
  return (
    <div className="app-card animate-pulse p-5 md:p-6">
      <div className="h-3 w-28 rounded-full bg-[color-mix(in_srgb,var(--pmu-text-muted)_16%,transparent)]" />
      <div className="mt-5 h-10 w-28 rounded-full bg-[color-mix(in_srgb,var(--pmu-text-muted)_18%,transparent)]" />
      <div className="mt-4 h-2 w-full rounded-full bg-[color-mix(in_srgb,var(--pmu-text-muted)_12%,transparent)]" />
      <div className="mt-3 h-3 w-32 rounded-full bg-[color-mix(in_srgb,var(--pmu-text-muted)_14%,transparent)]" />
    </div>
  );
}

function ProgressBar({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(100, value));

  return (
    <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--pmu-surface-2)_78%,transparent)]">
      <div
        className="h-full rounded-full bg-[linear-gradient(90deg,var(--pmu-primary-bright),var(--pmu-primary))] shadow-[0_0_18px_color-mix(in_srgb,var(--pmu-primary)_35%,transparent)] transition-[width] duration-700 ease-out"
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

function ProofCard({
  label,
  value,
  description,
  tone = "default",
  progress,
}: {
  label: string;
  value: string;
  description: string;
  tone?: "default" | "positive" | "negative";
  progress?: number;
}) {
  const valueClass =
    tone === "positive"
      ? "text-[var(--pmu-primary)]"
      : tone === "negative"
        ? "text-[var(--pmu-red)]"
        : "text-[var(--pmu-text)]";

  return (
    <div className="app-card p-5 md:p-6">
      <p className="app-label">{label}</p>
      <p className={`mt-4 font-mono text-4xl font-black tracking-tight ${valueClass}`}>{value}</p>
      {typeof progress === "number" ? <ProgressBar value={progress} /> : null}
      <p className="mt-3 text-sm leading-6 text-[var(--pmu-text-soft)]">{description}</p>
    </div>
  );
}

function CollectingCard({ label, description }: { label: string; description: string }) {
  return (
    <div className="app-card p-5 md:p-6">
      <p className="app-label">{label}</p>
      <p className="mt-4 text-lg font-black tracking-tight text-[var(--pmu-text)]">
        Donnees en cours de collecte
      </p>
      <p className="mt-3 text-sm leading-6 text-[var(--pmu-text-soft)]">{description}</p>
    </div>
  );
}

export function PerformanceProof() {
  const { data, isLoading, isRefreshing } = useLiveStats();
  const hasData = hasLiveStatsData(data);
  const lastUpdated = formatLiveTimestamp(data.lastUpdated);
  const roiTone = data.roi30d >= 0 ? "positive" : "negative";

  return (
    <section className="grid gap-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="app-kicker">Preuve de performance</p>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-[var(--pmu-text)] md:text-3xl">
            Des resultats publies, gains et pertes inclus
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-7 text-[var(--pmu-text-soft)] md:text-base">
            Les chiffres ci-dessous sont recalcules automatiquement a partir de nos pronostics valides des 30 derniers jours.
          </p>
        </div>

        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--pmu-text-muted)]">
          {lastUpdated ? `Mis a jour ${lastUpdated}` : isRefreshing ? "Mise a jour..." : "Actualisation auto"}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {isLoading ? (
          <>
            <ProofSkeletonCard />
            <ProofSkeletonCard />
            <ProofSkeletonCard />
            <ProofSkeletonCard />
          </>
        ) : hasData ? (
          <>
            <ProofCard
              label="Taux de reussite"
              value={formatLivePercent(data.winRate, 0)}
              progress={data.winRate}
              tone="positive"
              description="Sur 30 jours"
            />
            <ProofCard
              label="ROI"
              value={formatLiveRoi(data.roi30d)}
              tone={roiTone}
              description="Retour sur investissement"
            />
            <ProofCard
              label="Serie en cours"
              value={`${data.currentStreak}${data.currentStreak >= 3 ? " 🔥" : ""}`}
              tone={data.currentStreak >= 3 ? "positive" : "default"}
              description="Places consecutives"
            />
            <ProofCard
              label="Pronos valides"
              value={`${data.totalPredictions}`}
              tone="default"
              description="Ce mois"
            />
          </>
        ) : (
          <>
            <CollectingCard label="Taux de reussite" description="Sur 30 jours" />
            <CollectingCard label="ROI" description="Retour sur investissement" />
            <CollectingCard label="Serie en cours" description="Places consecutives" />
            <CollectingCard label="Pronos valides" description="Ce mois" />
          </>
        )}
      </div>

      <div className="app-card px-5 py-4 text-sm leading-6 text-[var(--pmu-text-soft)] md:px-6">
        Ces statistiques sont calculees automatiquement a partir de nos resultats reels. Nous publions nos gains ET nos pertes.
      </div>
    </section>
  );
}
