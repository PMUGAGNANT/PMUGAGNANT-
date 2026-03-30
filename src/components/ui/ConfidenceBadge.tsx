type ConfidenceBadgeProps = {
  score: number;
  compact?: boolean;
};

function getTone(score: number) {
  if (score >= 8) {
    return {
      ring: "border-[rgba(0,255,136,0.28)]",
      bg: "bg-[rgba(0,255,136,0.12)]",
      text: "text-[var(--pmu-primary)]",
      dot: "bg-[var(--pmu-primary)]",
    };
  }

  if (score >= 6) {
    return {
      ring: "border-[rgba(255,181,71,0.28)]",
      bg: "bg-[rgba(255,181,71,0.12)]",
      text: "text-[var(--pmu-orange)]",
      dot: "bg-[var(--pmu-orange)]",
    };
  }

  return {
    ring: "border-[rgba(255,92,92,0.28)]",
    bg: "bg-[rgba(255,92,92,0.12)]",
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
