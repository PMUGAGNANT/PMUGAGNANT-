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
    <section className="overflow-hidden rounded-[2rem] border border-[rgba(13,148,136,0.2)] bg-[radial-gradient(ellipse_75%_55%_at_100%_0%,rgba(13,148,136,0.12),transparent_50%),radial-gradient(ellipse_55%_40%_at_0%_100%,rgba(37,99,235,0.06),transparent_50%),linear-gradient(165deg,#ffffff_0%,#f8fafc_45%,#f1f5f9_100%)] p-6 shadow-[0_20px_50px_rgba(15,23,42,0.08)] md:p-8">
      <div className="grid gap-6 lg:grid-cols-[1.6fr,0.8fr] lg:items-end">
        <div className="space-y-4">
          <div>
            <p className="app-kicker">Radar du jour</p>
            <p className="mt-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--pmu-text-soft)]">
              Meilleur rapport confiance / enjeu
            </p>
          </div>
          <div className="space-y-3">
            <h1 className="max-w-3xl text-3xl font-black leading-[0.98] tracking-tight text-[var(--pmu-text)] md:text-5xl">
              {title}
            </h1>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm font-medium text-[var(--pmu-text-soft)] md:text-base">
              <span className="text-[var(--pmu-text)]">{hippodrome}</span>
              <span className="h-1 w-1 rounded-full bg-[var(--pmu-border-strong)]" />
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
              {Math.round(confidence * 10) / 10}
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
