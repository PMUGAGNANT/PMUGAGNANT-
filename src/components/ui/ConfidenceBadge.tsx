import { SEUIL_JOUABLE, SEUIL_SURVEILLANCE } from "@/lib/scoring-policy";

type ConfidenceBadgeProps = {
  score: number;
  compact?: boolean;
};

function getTone(score: number) {
  if (score >= SEUIL_JOUABLE) {
    return {
      ring: "border-[color-mix(in_srgb,var(--pmu-primary)_45%,transparent)]",
      bg: "bg-[var(--pmu-primary-soft)]",
      text: "text-[var(--pmu-primary)]",
      dot: "bg-[var(--pmu-primary)]",
    };
  }

  if (score >= SEUIL_SURVEILLANCE) {
    return {
      ring: "border-[color-mix(in_srgb,var(--pmu-orange)_40%,transparent)]",
      bg: "bg-[color-mix(in_srgb,var(--pmu-orange)_10%,transparent)]",
      text: "text-[var(--pmu-orange)]",
      dot: "bg-[var(--pmu-orange)]",
    };
  }

  return {
    ring: "border-[var(--pmu-border-strong)]",
    bg: "bg-[var(--pmu-surface-2)]",
    text: "text-[var(--pmu-text-muted)]",
    dot: "bg-[var(--pmu-text-soft)]",
  };
}

export function ConfidenceBadge({ score, compact = false }: ConfidenceBadgeProps) {
  const tone = getTone(score);

  return (
    <div
      className={`pmu-confidence-badge inline-flex items-center gap-2 rounded-full border px-3 py-1.5 font-semibold ${tone.ring} ${tone.bg} ${tone.text} ${
        compact ? "text-xs" : "text-sm"
      }`}
    >
      <span className={`h-2.5 w-2.5 rounded-full ${tone.dot}`} />
      <span>
        Confiance {Math.round(score * 10) / 10}/10
      </span>
    </div>
  );
}
