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
  jouable: "border-[rgba(0,255,136,0.45)] bg-[rgba(0,255,136,0.1)] text-[#00FF88]",
  surveillance: "border-[rgba(255,184,0,0.45)] bg-[rgba(255,184,0,0.1)] text-[#FFB800]",
  passer: "border-[#333333] bg-[#161616] text-[#888888]",
  resultat: "border-[#333333] bg-[#1a1a1a] text-[#888888]",
};

export function StatutBadge({ type }: StatutBadgeProps) {
  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-bold uppercase tracking-[0.14em] ${toneMap[type]}`}>
      {labelMap[type]}
    </span>
  );
}
