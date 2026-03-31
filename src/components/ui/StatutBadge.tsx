type StatutBadgeType = "jouable" | "surveillance" | "passer" | "resultat";

type StatutBadgeProps = {
  type: StatutBadgeType;
};

const labelMap: Record<StatutBadgeType, string> = {
  jouable: "JOUABLE",
  surveillance: "À SURVEILLER",
  passer: "PASSER",
  resultat: "RÉSULTAT",
};

const toneMap: Record<StatutBadgeType, string> = {
  jouable: "border-[rgba(13,148,136,0.35)] bg-[rgba(13,148,136,0.1)] text-[var(--pmu-primary)]",
  surveillance: "border-[rgba(217,119,6,0.3)] bg-[rgba(217,119,6,0.1)] text-[var(--pmu-orange)]",
  passer: "border-[rgba(100,116,139,0.35)] bg-[rgba(148,163,184,0.12)] text-[#64748b]",
  resultat: "border-[rgba(37,99,235,0.28)] bg-[rgba(37,99,235,0.08)] text-[var(--pmu-blue)]",
};

export function StatutBadge({ type }: StatutBadgeProps) {
  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-bold uppercase tracking-[0.14em] ${toneMap[type]}`}>
      {labelMap[type]}
    </span>
  );
}
