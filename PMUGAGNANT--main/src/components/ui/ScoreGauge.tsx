type ScoreGaugeProps = {
  score: number;
  label?: string;
};

export default function ScoreGauge({ score, label = "confiance" }: ScoreGaugeProps) {
  const radius = 43;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.max(0, Math.min(score, 100));
  const dashOffset = circumference - (progress / 100) * circumference;

  return (
    <div
      className="relative grid aspect-square w-32 place-items-center rounded-full"
      aria-label={`Score ${Math.round(progress)} sur 100`}
    >
      <svg className="absolute inset-0 -rotate-90" viewBox="0 0 112 112">
        <circle
          cx="56"
          cy="56"
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.12)"
          strokeWidth="10"
        />
        <circle
          cx="56"
          cy="56"
          r={radius}
          fill="none"
          stroke="#00C851"
          strokeLinecap="round"
          strokeWidth="10"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
        />
      </svg>
      <strong className="font-[var(--font-display)] text-5xl font-black leading-none text-[#F6F2E8]">
        {Math.round(progress)}
      </strong>
      <span className="absolute bottom-7 text-[0.68rem] font-black uppercase text-slate-400">
        {label}
      </span>
    </div>
  );
}
