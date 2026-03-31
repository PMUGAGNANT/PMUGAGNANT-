import { SEUIL_JOUABLE, SEUIL_SURVEILLANCE } from "@/lib/client-race-scoring";

type ConfidenceBadgeProps = {
  score: number;
  compact?: boolean;
};

function getTone(score: number) {
  if (score >= SEUIL_JOUABLE) {
    return {
      ring: "border-[rgba(0,255,136,0.45)]",
      bg: "bg-[rgba(0,255,136,0.1)]",
      text: "text-[#00FF88]",
      dot: "bg-[#00FF88]",
    };
  }

  if (score >= SEUIL_SURVEILLANCE) {
    return {
      ring: "border-[rgba(255,184,0,0.4)]",
      bg: "bg-[rgba(255,184,0,0.1)]",
      text: "text-[#FFB800]",
      dot: "bg-[#FFB800]",
    };
  }

  return {
    ring: "border-[#444444]",
    bg: "bg-[#161616]",
    text: "text-[#888888]",
    dot: "bg-[#666666]",
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
      <span>
        Confiance {Math.round(score * 10) / 10}/10
      </span>
    </div>
  );
}
