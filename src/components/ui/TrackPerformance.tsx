"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { PublicResultsTrack } from "@/lib/use-public-results";

type TrackPerformanceProps = {
  tracks: PublicResultsTrack[];
  isLoading?: boolean;
};

export function TrackPerformance({ tracks, isLoading = false }: TrackPerformanceProps) {
  if (isLoading) {
    return <div className="h-[300px] animate-pulse rounded-[24px] bg-[var(--pmu-surface-2)]" />;
  }

  if (!tracks.length) {
    return (
      <div className="flex h-[300px] items-center justify-center rounded-[24px] border border-[var(--pmu-border)] bg-[var(--pmu-surface-2)] text-sm font-semibold text-[var(--pmu-text-soft)]">
        Donnees en cours de collecte
      </div>
    );
  }

  return (
    <div className="h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={tracks.slice(0, 10)}
          layout="vertical"
          margin={{ top: 12, right: 12, left: 20, bottom: 0 }}
        >
          <CartesianGrid stroke="color-mix(in srgb, var(--pmu-text) 8%, transparent)" horizontal={false} />
          <XAxis
            type="number"
            tick={{ fill: "var(--pmu-text-muted)", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            dataKey="label"
            type="category"
            width={110}
            tick={{ fill: "var(--pmu-text-soft)", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            cursor={{ fill: "color-mix(in srgb, var(--pmu-primary) 8%, transparent)" }}
            contentStyle={{
              background: "var(--pmu-surface)",
              border: "1px solid var(--pmu-border)",
              borderRadius: 16,
              color: "var(--pmu-text)",
            }}
            formatter={(value, _name, item) => [
              typeof value === "number" && Number.isFinite(value) ? `${value.toFixed(1)}%` : "—",
              `${item.payload.sample} courses`,
            ]}
          />
          <Bar dataKey="roi" fill="#00FF88" radius={[0, 12, 12, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
