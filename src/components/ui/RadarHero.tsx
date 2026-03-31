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
      className="w-full overflow-hidden rounded-[2rem] border border-[var(--pmu-border)] bg-[linear-gradient(165deg,var(--pmu-primary-soft)_0%,color-mix(in_srgb,var(--pmu-surface-2)_88%,var(--pmu-primary)_12%)_32%,var(--pmu-bg)_72%)] p-6 shadow-[var(--pmu-shadow)] md:p-10"
    >
      <div className="grid gap-8 lg:grid-cols-[1.55fr,0.85fr] lg:items-end">
        <div className="space-y-5">
          <div>
            <p className="app-kicker">Radar du jour</p>
            <p className="mt-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--pmu-text-muted)]">
              Meilleur rapport confiance / enjeu
            </p>
          </div>
          <div className="space-y-4">
            <h1 className="max-w-3xl text-3xl font-black leading-[0.98] tracking-tight text-[var(--pmu-text)] md:text-5xl lg:text-6xl">
              {title}
            </h1>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm font-medium text-[var(--pmu-text-muted)] md:text-base">
              <span className="text-[var(--pmu-text)]">{hippodrome}</span>
              <span className="h-1 w-1 rounded-full bg-[var(--pmu-border-strong)]" />
              <span>{raceMeta}</span>
            </div>
          </div>
          <p className="max-w-2xl text-sm leading-7 text-[var(--pmu-text-muted)] md:text-base">{summary}</p>
          <button type="button" onClick={onClick} className="app-button-primary px-8 py-4 text-base font-black">
            {ctaLabel}
          </button>
        </div>

        <div className="pmu-radar-panel rounded-3xl border border-[var(--pmu-border)] bg-[var(--pmu-surface)] p-6">
          <p className="app-label text-[var(--pmu-text-muted)]">Indice confiance</p>
          <div className="mt-2 flex flex-wrap items-baseline gap-2">
            <span className="pmu-radar-score text-6xl font-black tabular-nums leading-none tracking-tight text-[var(--pmu-primary)] md:text-7xl lg:text-8xl">
              {scoreDisplay}
            </span>
            <span className="text-2xl font-bold text-[var(--pmu-text-muted)]">/10</span>
          </div>
          <div className="mt-6">
            <ConfidenceBadge score={confidence} />
          </div>
        </div>
      </div>
    </section>
  );
}
