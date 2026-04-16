export function RaceStatusPill({
  label,
  tone,
}: {
  label: string;
  tone: "primary" | "warning" | "danger" | "neutral";
}) {
  const color =
    tone === "primary"
      ? "var(--pmu-primary)"
      : tone === "warning"
        ? "var(--pmu-orange)"
        : tone === "danger"
          ? "var(--pmu-red)"
          : "var(--pmu-text-soft)";

  return (
    <span
      data-tone={tone}
      className="rounded-full border px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.16em]"
      style={{
        color,
        borderColor: `color-mix(in srgb, ${color} 26%, transparent)`,
        background: `color-mix(in srgb, ${color} 10%, var(--pmu-surface))`,
      }}
    >
      {label}
    </span>
  );
}
