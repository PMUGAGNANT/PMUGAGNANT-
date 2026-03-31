type ConfidenceBadgeProps = {
  score: number;
  compact?: boolean;
};

function getTone(score: number) {
  if (score >= 8) {
    return {
      ring: "border-[rgba(13,148,136,0.35)]",
      bg: "bg-[rgba(13,148,136,0.1)]",
      text: "text-[var(--pmu-primary)]",
      dot: "bg-[var(--pmu-primary)]",
    };
  }

  if (score >= 6) {
    return {
      ring: "border-[rgba(217,119,6,0.3)]",
      bg: "bg-[rgba(217,119,6,0.1)]",
      text: "text-[var(--pmu-orange)]",
      dot: "bg-[var(--pmu-orange)]",
    };
  }

  return {
    ring: "border-[rgba(225,29,72,0.28)]",
    bg: "bg-[rgba(225,29,72,0.08)]",
    text: "text-[var(--pmu-red)]",
    dot: "bg-[var(--pmu-red)]",
  };
}

export function ConfidenceBadge({ score, compact = false }: ConfidenceBadgeProps) {
  const tone = getTone(score);

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 font-semibold ${tone.ring} ${tone.bg} ${tone.text} ${
        compact ? "text-xs" : "text-sm"
      }`}
    >
      <span className={`h-2.5 w-2.5 rounded-full ${tone.dot}`} />
      <span>Confiance {score.toFixed(1)}/10</span>
    </div>
  );
}
