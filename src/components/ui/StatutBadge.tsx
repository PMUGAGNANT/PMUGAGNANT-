type StatutBadgeType = "jouable" | "surveillance" | "resultat";

type StatutBadgeProps = {
  type: StatutBadgeType;
};

const labelMap: Record<StatutBadgeType, string> = {
  jouable: "Jouable",
  surveillance: "Sous surveillance",
  resultat: "Resultat",
};

const toneMap: Record<StatutBadgeType, string> = {
  jouable: "border-[rgba(0,255,136,0.26)] bg-[rgba(0,255,136,0.1)] text-[var(--pmu-primary)]",
  surveillance: "border-[rgba(255,181,71,0.26)] bg-[rgba(255,181,71,0.1)] text-[var(--pmu-orange)]",
  resultat: "border-[rgba(92,163,255,0.26)] bg-[rgba(92,163,255,0.1)] text-[var(--pmu-blue)]",
};

export function StatutBadge({ type }: StatutBadgeProps) {
  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-bold uppercase tracking-[0.14em] ${toneMap[type]}`}>
      {labelMap[type]}
    </span>
  );
}
