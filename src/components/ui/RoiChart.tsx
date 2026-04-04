"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { PublicResultsTimelinePoint } from "@/lib/use-public-results";

type RoiChartProps = {
  timeline: PublicResultsTimelinePoint[];
  isLoading?: boolean;
};

function formatAxisDate(value: string) {
  if (!/^\d{8}$/.test(value)) {
    return value;
  }

  return `${value.slice(0, 2)}/${value.slice(2, 4)}`;
}

function formatEuros(value: number) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)} €`;
}

function formatTooltipValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return formatEuros(value);
  }

  return "—";
}

export function RoiChart({ timeline, isLoading = false }: RoiChartProps) {
  if (isLoading) {
    return <div className="h-[300px] animate-pulse rounded-[24px] bg-[var(--pmu-surface-2)]" />;
  }

  if (!timeline.length) {
    return (
      <div className="flex h-[300px] items-center justify-center rounded-[24px] border border-[var(--pmu-border)] bg-[var(--pmu-surface-2)] text-sm font-semibold text-[var(--pmu-text-soft)]">
        Données en cours de collecte
      </div>
    );
  }

  const positive = (timeline[timeline.length - 1]?.cumulativeProfit ?? 0) >= 0;

  return (
    <div className="h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={timeline} margin={{ top: 12, right: 12, left: -16, bottom: 0 }}>
          <CartesianGrid stroke="color-mix(in srgb, var(--pmu-text) 8%, transparent)" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={formatAxisDate}
            tick={{ fill: "var(--pmu-text-muted)", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "var(--pmu-text-muted)", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            width={72}
          />
          <Tooltip
            cursor={{ stroke: "color-mix(in srgb, var(--pmu-primary) 22%, transparent)" }}
            contentStyle={{
              background: "var(--pmu-surface)",
              border: "1px solid var(--pmu-border)",
              borderRadius: 16,
              color: "var(--pmu-text)",
            }}
            formatter={(value) => [formatTooltipValue(value), "Profit cumulé"]}
            labelFormatter={(label) => `Date ${label}`}
          />
          <Line
            type="monotone"
            dataKey="cumulativeProfit"
            stroke={positive ? "#00FF88" : "#FF4444"}
            strokeWidth={3}
            dot={false}
            activeDot={{ r: 5, fill: positive ? "#00FF88" : "#FF4444" }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
