type KpiCardProps = {
  label: string;
  value: string;
  trend?: "up" | "down" | "flat";
  tone?: "default" | "success" | "warning";
};

const toneMap: Record<NonNullable<KpiCardProps["tone"]>, string> = {
  default: "text-[var(--pmu-text)]",
  success: "text-[var(--pmu-primary)]",
  warning: "text-[var(--pmu-orange)]",
};

const trendMap: Record<NonNullable<KpiCardProps["trend"]>, string> = {
  up: "▲",
  down: "▼",
  flat: "•",
};

export function KpiCard({ label, value, trend, tone = "default" }: KpiCardProps) {
  return (
    <div className="app-card p-5">
      <p className="app-label">{label}</p>
      <div className="mt-4 flex items-end justify-between gap-4">
        <p className={`text-4xl font-black tracking-tight ${toneMap[tone]}`}>{value}</p>
        {trend ? <span className="text-sm font-bold text-[var(--pmu-text-muted)]">{trendMap[trend]}</span> : null}
      </div>
    </div>
  );
}
