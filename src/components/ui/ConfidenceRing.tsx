import { SEUIL_JOUABLE, SEUIL_SURVEILLANCE } from "@/lib/client-race-scoring";

type ConfidenceRingProps = {
  score: number;
};

export function ConfidenceRing({ score }: ConfidenceRingProps) {
  const display = Math.round(score * 10) / 10;
  const ringClass =
    score >= SEUIL_JOUABLE
      ? "border-[#00FF88] shadow-[0_0_20px_rgba(0,255,136,0.25)]"
      : score >= SEUIL_SURVEILLANCE
        ? "border-[#FFB800] shadow-[0_0_16px_rgba(255,184,0,0.15)]"
        : "border-[#444444]";

  const textClass = score >= SEUIL_JOUABLE ? "text-[#00FF88]" : score >= SEUIL_SURVEILLANCE ? "text-[#FFB800]" : "text-[#888888]";

  return (
    <div
      className={`flex h-[4.5rem] w-[4.5rem] shrink-0 flex-col items-center justify-center rounded-full border-[3px] bg-[#161616] ${ringClass}`}
      aria-label={`Confiance ${display} sur 10`}
    >
      <span className={`font-mono text-lg font-black leading-none tabular-nums ${textClass}`}>{display}</span>
      <span className="mt-0.5 text-[10px] font-bold uppercase tracking-wide text-[#888888]">/10</span>
    </div>
  );
}
