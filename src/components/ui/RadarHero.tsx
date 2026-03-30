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
  return (
    <section className="overflow-hidden rounded-[2rem] border border-[rgba(0,255,136,0.16)] bg-[radial-gradient(circle_at_top_right,rgba(0,255,136,0.18),transparent_30%),linear-gradient(135deg,#0d1d16_0%,#0f1411_48%,#0a0a0a_100%)] p-6 shadow-[0_28px_72px_rgba(0,0,0,0.36)] md:p-8">
      <div className="grid gap-6 lg:grid-cols-[1.6fr,0.8fr] lg:items-end">
        <div className="space-y-4">
          <p className="app-kicker">Radar du jour</p>
          <div className="space-y-3">
            <h1 className="max-w-3xl text-3xl font-black leading-[0.98] tracking-tight text-white md:text-5xl">
              {title}
            </h1>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm font-medium text-[var(--pmu-text-soft)] md:text-base">
              <span className="text-white">{hippodrome}</span>
              <span className="h-1 w-1 rounded-full bg-[#111111]" />
              <span>{raceMeta}</span>
            </div>
          </div>
          <p className="max-w-2xl text-sm leading-7 text-[var(--pmu-text-soft)] md:text-base">{summary}</p>
          <button type="button" onClick={onClick} className="app-button-primary">
            {ctaLabel}
          </button>
        </div>

        <div className="app-card-muted p-5">
          <p className="app-label">Indice confiance</p>
          <div className="mt-4 flex items-end gap-3">
            <span className="text-5xl font-black tracking-tight text-[var(--pmu-primary)] md:text-6xl">
              {Math.round(confidence)}
            </span>
            <span className="pb-1 text-lg font-semibold text-[var(--pmu-text-muted)]">/10</span>
          </div>
          <div className="mt-5">
            <ConfidenceBadge score={confidence} />
          </div>
        </div>
      </div>
    </section>
  );
}
