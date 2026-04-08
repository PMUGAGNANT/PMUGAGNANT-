"use client";

import {
  formatLivePercent,
  formatLiveRoi,
  formatLiveTimestamp,
  hasLiveStatsData,
} from "@/lib/live-stats";
import { useLiveStats } from "@/lib/use-live-stats";

function SkeletonItem({ widthClass }: { widthClass: string }) {
  return (
    <span
      className={`h-3 rounded-full bg-[color-mix(in_srgb,var(--pmu-text-muted)_20%,transparent)] motion-safe:animate-pulse ${widthClass}`}
    />
  );
}

function StatSegment({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "positive" | "negative" | "neutral";
}) {
  const colorClass =
    tone === "positive"
      ? "text-[var(--pmu-primary)]"
      : tone === "negative"
        ? "text-[var(--pmu-red)]"
        : "text-[var(--pmu-text)]";

  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span className="text-[var(--pmu-text-soft)]">{label}</span>
      <span className={`font-mono font-bold ${colorClass}`}>{value}</span>
    </span>
  );
}

export function LiveStatsBanner() {
  const { data, isLoading, isRefreshing } = useLiveStats();
  const hasData = hasLiveStatsData(data);
  const lastUpdated = formatLiveTimestamp(data.lastUpdated);
  const roiTone = data.roi30d >= 0 ? "positive" : "negative";
  const todayTone =
    data.todayPredictions > 0 &&
    data.todayWins / Math.max(data.todayPredictions, 1) >= 0.5
      ? "positive"
      : data.todayPredictions > 0
        ? "negative"
        : "neutral";

  return (
    <div className="sticky top-0 z-[100] px-3 pt-3 lg:pl-[21rem] lg:pr-4">
      <div
        className="h-11 overflow-x-auto overflow-y-hidden rounded-full border border-[var(--pmu-border)]"
        style={{
          background: "color-mix(in srgb, var(--pmu-bg) 86%, transparent)",
          backdropFilter: "blur(16px)",
          boxShadow: "var(--pmu-shadow-sm)",
        }}
      >
        <div
          className="mx-auto flex h-full min-w-max max-w-6xl items-center gap-2.5 px-4 text-[12px]"
          aria-live="polite"
        >
          <span className="inline-flex items-center gap-2 whitespace-nowrap rounded-full border border-[color-mix(in_srgb,var(--pmu-red)_30%,transparent)] bg-[color-mix(in_srgb,var(--pmu-red)_10%,transparent)] px-2 py-0.5 font-black uppercase tracking-[0.14em] text-[11px] text-[var(--pmu-text)]">
            <span className="relative flex h-2 w-2">
              <span className="absolute inset-0 rounded-full bg-[var(--pmu-red)] opacity-70 motion-safe:animate-ping" />
              <span className="relative h-2 w-2 rounded-full bg-[var(--pmu-red)]" />
            </span>
            <span>Live</span>
          </span>

          {isLoading ? (
            <>
              <SkeletonItem widthClass="w-24" />
              <span className="text-[var(--pmu-text-muted)]">|</span>
              <SkeletonItem widthClass="w-28" />
              <span className="text-[var(--pmu-text-muted)]">|</span>
              <SkeletonItem widthClass="w-20" />
              <span className="text-[var(--pmu-text-muted)]">|</span>
              <SkeletonItem widthClass="w-24" />
            </>
          ) : hasData ? (
            <>
              <span className="text-[var(--pmu-text-muted)]">|</span>
              <StatSegment
                label="Taux de réussite :"
                value={formatLivePercent(data.winRate, 0)}
                tone="positive"
              />
              <span className="text-[var(--pmu-text-muted)]">|</span>
              <StatSegment
                label="Série :"
                value={`${data.currentStreak} placés`}
                tone={data.currentStreak >= 3 ? "positive" : "neutral"}
              />
              <span className="text-[var(--pmu-text-muted)]">|</span>
              <StatSegment label="ROI :" value={formatLiveRoi(data.roi30d)} tone={roiTone} />
              <span className="text-[var(--pmu-text-muted)]">|</span>
              <StatSegment
                label="Aujourd’hui :"
                value={`${data.todayWins}/${data.todayPredictions}`}
                tone={todayTone}
              />
            </>
          ) : (
            <span className="whitespace-nowrap font-semibold text-[var(--pmu-text-soft)]">
              Données en cours de collecte
            </span>
          )}

          <span className="text-[var(--pmu-text-muted)]">|</span>
          <span className="whitespace-nowrap text-[10px] font-medium text-[var(--pmu-text-muted)]">
            {lastUpdated
              ? `Màj ${lastUpdated}`
              : isRefreshing
                ? "Mise à jour..."
                : "Màj auto 5 min"}
          </span>
        </div>
      </div>
    </div>
  );
}
