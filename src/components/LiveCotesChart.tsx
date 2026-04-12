"use client";

import { useMemo } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { LiveCotesSeries } from "@/lib/live-cotes";

const COLORS = ["#2A4D12", "#8C6D2F", "#B85030", "#5A5444", "#C2B49A"];
const PEPITE_COLOR = "#FACC15";

type ChartPoint = {
  captured_at: string;
  heure: string;
} & Record<string, number | string | null>;

function formatHour(value: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatCote(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value.toFixed(1) : "--";
}

export function LiveCotesChart({
  series,
  pepiteNum,
}: {
  series?: LiveCotesSeries[] | null;
  pepiteNum?: number | string | null;
}) {
  const prepared = useMemo(() => {
    const limitedSeries = (series ?? []).slice(0, 5);
    const captureTimes = new Set(
      limitedSeries.flatMap((serie) => serie.points.map((point) => point.captured_at))
    );

    if (limitedSeries.length === 0 || captureTimes.size < 2) {
      return null;
    }

    const rowsByTime = new Map<string, ChartPoint>();
    const labels = new Map<string, string>();

    limitedSeries.forEach((serie) => {
      const key = `h${serie.cheval_num}`;
      labels.set(key, `#${serie.cheval_num} ${serie.cheval_nom}`);

      serie.points.forEach((point) => {
        const current =
          rowsByTime.get(point.captured_at) ?? {
            captured_at: point.captured_at,
            heure: formatHour(point.captured_at),
          };

        current[key] = point.cote;
        rowsByTime.set(point.captured_at, current);
      });
    });

    return {
      data: [...rowsByTime.values()].sort(
        (left, right) =>
          new Date(left.captured_at).getTime() - new Date(right.captured_at).getTime()
      ),
      labels,
      lines: limitedSeries.map((serie, index) => ({
        key: `h${serie.cheval_num}`,
        label: `#${serie.cheval_num} ${serie.cheval_nom}`,
        color:
          pepiteNum !== null && pepiteNum !== undefined && String(pepiteNum) === String(serie.cheval_num)
            ? PEPITE_COLOR
            : COLORS[index % COLORS.length],
      })),
    };
  }, [pepiteNum, series]);

  if (!prepared) {
    return null;
  }

  return (
    <section className="app-card overflow-hidden p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="app-kicker">Live cotes</p>
          <h3 className="mt-1 text-xl font-black text-[var(--pmu-text)]">
            Evolution des 2 dernieres heures
          </h3>
        </div>
        <span className="rounded-lg border border-[var(--pmu-border)] px-3 py-1 text-xs font-semibold uppercase text-[var(--pmu-text-soft)]">
          Top 5
        </span>
      </div>

      <div className="mt-4 h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={prepared.data} margin={{ top: 10, right: 12, bottom: 0, left: -18 }}>
            <CartesianGrid stroke="rgba(24,22,15,0.09)" vertical={false} />
            <XAxis
              dataKey="heure"
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--pmu-text-soft)", fontSize: 12 }}
            />
            <YAxis
              reversed
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--pmu-text-soft)", fontSize: 12 }}
              tickFormatter={(value) => formatCote(value)}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;

                return (
                  <div className="rounded-lg border border-[var(--pmu-border)] bg-[var(--pmu-surface)] p-3 text-sm text-[var(--pmu-text)]">
                    <p className="font-semibold">{label}</p>
                    <div className="mt-2 space-y-1">
                      {payload.map((item, index) => (
                        <p key={`${String(item.dataKey)}-${index}`} style={{ color: item.color }}>
                          {prepared.labels.get(String(item.dataKey)) ?? item.name} :{" "}
                          {formatCote(item.value)}
                        </p>
                      ))}
                    </div>
                  </div>
                );
              }}
            />
            {prepared.lines.map((line) => (
              <Line
                key={line.key}
                type="monotone"
                dataKey={line.key}
                name={line.label}
                stroke={line.color}
                strokeWidth={2.4}
                dot={false}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
