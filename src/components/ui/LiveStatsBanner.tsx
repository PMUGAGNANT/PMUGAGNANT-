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
      <span className={`font-mono text-[11px] font-extrabold ${colorClass}`}>
        {value}
      </span>
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
    <div className="sticky top-2 z-[100] px-3 pt-2 lg:pl-[22.25rem] lg:pr-5">
      <div
        className="overflow-x-auto overflow-y-hidden rounded-[1.35rem] border border-[var(--pmu-border)]"
        style={{
          background:
            "linear-gradient(180deg,color-mix(in_srgb,var(--pmu-surface)_92%,transparent)_0%,color-mix(in_srgb,var(--pmu-bg)_95%,transparent)_100%)",
          backdropFilter: "blur(12px)",
          boxShadow: "0 12px 26px rgba(15, 23, 42, 0.07)",
        }}
      >
        <div
          className="mx-auto flex h-10 min-w-max max-w-6xl items-center gap-2 px-3.5 text-[11px]"
          aria-live="polite"
        >
          <span className="inline-flex items-center gap-2 whitespace-nowrap rounded-full border border-[color-mix(in_srgb,var(--pmu-red)_28%,transparent)] bg-[color-mix(in_srgb,var(--pmu-red)_10%,transparent)] px-2.5 py-1 font-black uppercase tracking-[0.16em] text-[9px] text-[var(--pmu-text)]">
            <span className="relative flex h-2 w-2">
              <span className="absolute inset-0 rounded-full bg-[var(--pmu-red)] opacity-70 motion-safe:animate-ping" />
              <span className="relative h-2 w-2 rounded-full bg-[var(--pmu-red)]" />
            </span>
            <span>Live desk</span>
          </span>

          {isLoading ? (
            <>
              <SkeletonItem widthClass="w-20" />
              <span className="text-[var(--pmu-text-muted)]">|</span>
              <SkeletonItem widthClass="w-24" />
              <span className="text-[var(--pmu-text-muted)]">|</span>
              <SkeletonItem widthClass="w-20" />
              <span className="text-[var(--pmu-text-muted)]">|</span>
              <SkeletonItem widthClass="w-24" />
            </>
          ) : hasData ? (
            <>
              <span className="text-[var(--pmu-text-muted)]">|</span>
              <StatSegment
                label="Reussite"
                value={formatLivePercent(data.winRate, 0)}
                tone="positive"
              />
              <span className="text-[var(--pmu-text-muted)]">|</span>
              <StatSegment
                label="Serie"
                value={`${data.currentStreak} places`}
                tone={data.currentStreak >= 3 ? "positive" : "neutral"}
              />
              <span className="text-[var(--pmu-text-muted)]">|</span>
              <StatSegment label="ROI 30j" value={formatLiveRoi(data.roi30d)} tone={roiTone} />
              <span className="text-[var(--pmu-text-muted)]">|</span>
              <StatSegment
                label="Aujourd'hui"
                value={`${data.todayWins}/${data.todayPredictions}`}
                tone={todayTone}
              />
            </>
          ) : (
            <span className="whitespace-nowrap font-semibold text-[var(--pmu-text-soft)]">
              Donnees en cours de collecte
            </span>
          )}

          <span className="text-[var(--pmu-text-muted)]">|</span>
          <span className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--pmu-text-muted)]">
            {lastUpdated
              ? `Maj ${lastUpdated}`
              : isRefreshing
                ? "Mise a jour..."
                : "Maj auto 5 min"}
          </span>
        </div>
      </div>
    </div>
  );
}
