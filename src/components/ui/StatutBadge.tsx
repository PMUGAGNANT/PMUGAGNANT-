type StatutBadgeType = "jouable" | "surveillance" | "passer" | "resultat";

type StatutBadgeProps = {
  type: StatutBadgeType;
};

const labelMap: Record<StatutBadgeType, string> = {
  jouable: "✅ JOUABLE",
  surveillance: "⚠️ À surveiller",
  passer: "PASSER",
  resultat: "🏁 Résultat",
};

const toneMap: Record<StatutBadgeType, string> = {
  jouable:
    "border-[color-mix(in_srgb,var(--pmu-primary)_45%,transparent)] bg-[var(--pmu-primary-soft)] text-[var(--pmu-primary)]",
  surveillance:
    "border-[color-mix(in_srgb,var(--pmu-orange)_45%,transparent)] bg-[color-mix(in_srgb,var(--pmu-orange)_10%,transparent)] text-[var(--pmu-orange)]",
  passer: "border-[var(--pmu-border-strong)] bg-[var(--pmu-surface-2)] text-[var(--pmu-text-muted)]",
  resultat: "border-[var(--pmu-border-strong)] bg-[var(--pmu-surface-highlight)] text-[var(--pmu-text-muted)]",
};

export function StatutBadge({ type }: StatutBadgeProps) {
  return (
    <span
      className={`pmu-statut-badge inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-bold uppercase tracking-[0.14em] ${toneMap[type]}`}
    >
      {labelMap[type]}
    </span>
  );
}
