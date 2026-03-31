import { ConfidenceBadge } from "./ConfidenceBadge";

type RadarHeroProps = {
  title: string;
  hippodrome: string;
  raceMeta: string;
  confidence: number;
  summary: string;
  ctaLabel: string;
  onClick: () => void;
};

export function RadarHero({
  title,
  hippodrome,
  raceMeta,
  confidence,
  summary,
  ctaLabel,
  onClick,
}: RadarHeroProps) {
  const scoreDisplay = Math.round(confidence * 10) / 10;

  return (
    <section
      className="w-full overflow-hidden rounded-[2rem] border border-[#1E1E1E] bg-[linear-gradient(165deg,rgba(0,255,136,0.14)_0%,rgba(0,40,24,0.35)_28%,#0A0A0A_72%)] p-6 shadow-[0_24px_64px_rgba(0,0,0,0.5)] md:p-10"
    >
      <div className="grid gap-8 lg:grid-cols-[1.55fr,0.85fr] lg:items-end">
        <div className="space-y-5">
          <div>
            <p className="app-kicker">Radar du jour</p>
            <p className="mt-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#888888]">
              Meilleur rapport confiance / enjeu
            </p>
          </div>
          <div className="space-y-4">
            <h1 className="max-w-3xl text-3xl font-black leading-[0.98] tracking-tight text-white md:text-5xl lg:text-6xl">
              {title}
            </h1>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm font-medium text-[#888888] md:text-base">
              <span className="text-white">{hippodrome}</span>
              <span className="h-1 w-1 rounded-full bg-[#444444]" />
              <span>{raceMeta}</span>
            </div>
          </div>
          <p className="max-w-2xl text-sm leading-7 text-[#888888] md:text-base">{summary}</p>
          <button type="button" onClick={onClick} className="app-button-primary px-8 py-4 text-base font-black">
            {ctaLabel}
          </button>
        </div>

        <div className="rounded-3xl border border-[#1E1E1E] bg-[#111111] p-6">
          <p className="app-label text-[#888888]">Indice confiance</p>
          <div className="mt-2 flex flex-wrap items-baseline gap-2">
            <span className="text-6xl font-black tabular-nums leading-none tracking-tight text-[#00FF88] md:text-7xl lg:text-8xl">
              {scoreDisplay}
            </span>
            <span className="text-2xl font-bold text-[#888888]">/10</span>
          </div>
          <div className="mt-6">
            <ConfidenceBadge score={confidence} />
          </div>
        </div>
      </div>
    </section>
  );
}
