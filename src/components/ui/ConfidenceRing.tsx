import { SEUIL_JOUABLE, SEUIL_SURVEILLANCE } from "@/lib/scoring-policy";

type ConfidenceRingProps = {
  score: number;
};

export function ConfidenceRing({ score }: ConfidenceRingProps) {
  const display = Math.round(score * 10) / 10;
  const ringClass =
    score >= SEUIL_JOUABLE
      ? "border-[var(--pmu-primary)] shadow-[var(--pmu-glow)]"
      : score >= SEUIL_SURVEILLANCE
        ? "border-[var(--pmu-orange)] shadow-[0_0_16px_color-mix(in_srgb,var(--pmu-orange)_22%,transparent)]"
        : "border-[var(--pmu-border-strong)]";

  const textClass =
    score >= SEUIL_JOUABLE
      ? "text-[var(--pmu-primary)]"
      : score >= SEUIL_SURVEILLANCE
        ? "text-[var(--pmu-orange)]"
        : "text-[var(--pmu-text-muted)]";

  return (
    <div
      className={`pmu-confidence-ring flex h-[4.5rem] w-[4.5rem] shrink-0 flex-col items-center justify-center rounded-full ${ringClass}`}
      aria-label={`Confiance ${display} sur 10`}
    >
      <span className={`font-mono text-lg font-black leading-none tabular-nums ${textClass}`}>{display}</span>
      <span className="mt-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--pmu-text-muted)]">/10</span>
    </div>
  );
}
