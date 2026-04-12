export function AccountSummaryCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string | number;
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
      <p className="mt-2 text-2xl font-black" style={{ color }}>
        {value}
      </p>
    </article>
  );
}
