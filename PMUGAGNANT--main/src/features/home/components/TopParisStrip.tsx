import { asArray } from "@/lib/array-utils";
import { ConfidenceBadge } from "@/components/ui/ConfidenceBadge";

export type TopParisItem = {
  rank: number;
  raceCode: string;
  meetingLabel: string;
  courseLabel: string;
  trackLabel: string;
  timeLabel: string;
  metaLabel: string;
  title: string;
  subtitle: string;
  horse: string;
  stake: string;
  betType: string;
  confidence: number;
  sourceLabel: string;
  onClick: () => void;
};

type TopParisStripProps = {
  items: TopParisItem[];
};

export function TopParisStrip({ items }: TopParisStripProps) {
  const list = asArray<TopParisItem>(items);
  return (
    <section className="app-card p-4 md:p-5">
      <div className="app-section-heading">
        <div>
          <p className="app-kicker">Tickets clairs</p>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-[var(--pmu-text)]">
            Les 3 decisions les plus simples du programme
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--pmu-text-soft)]">
            Un cheval, une mise, une confiance. L&apos;objectif est de savoir vite
            quoi jouer et quoi laisser de cote.
          </p>
        </div>
        <span className="turf-decision-badge" data-tone="success">
          JOUER
        </span>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-3">
        {list.map((item) => (
          <button
            key={`${item.rank}-${item.raceCode}-${item.title}`}
            type="button"
            onClick={item.onClick}
            className="group flex h-full flex-col rounded-lg border border-[var(--pmu-border)] bg-[color-mix(in_srgb,var(--pmu-surface)_86%,transparent)] p-5 text-left transition duration-300 hover:-translate-y-0.5 hover:border-[color-mix(in_srgb,var(--pmu-primary)_40%,transparent)] hover:shadow-[var(--pmu-glow-soft)]"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-[color-mix(in_srgb,var(--pmu-primary)_30%,transparent)] bg-[var(--pmu-primary-soft)] text-base font-black text-[var(--pmu-primary)]">
                {item.rank}
              </div>
              <div className="flex flex-col items-end gap-2">
                <span className="rounded-lg border border-[color-mix(in_srgb,var(--pmu-primary)_35%,transparent)] bg-[var(--pmu-primary-fade)] px-3 py-1 text-[12px] font-black uppercase text-[var(--pmu-primary)]">
                  {item.raceCode}
                </span>
                <span className="rounded-lg border border-[var(--pmu-border)] px-2.5 py-1 text-[10px] font-bold uppercase text-[var(--pmu-text-muted)]">
                  {item.sourceLabel}
                </span>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 text-xs font-bold uppercase tracking-[0.12em] text-[var(--pmu-text-muted)]">
              <span className="rounded-[0.7rem] border border-[var(--pmu-border)] bg-[var(--pmu-surface)] px-3 py-2">
                {item.meetingLabel}
              </span>
              <span className="rounded-[0.7rem] border border-[var(--pmu-border)] bg-[var(--pmu-surface)] px-3 py-2">
                {item.courseLabel}
              </span>
            </div>

            <div className="mt-5 space-y-2">
              <h3 className="text-xl font-black leading-tight text-[var(--pmu-text)]">
                {item.horse}
              </h3>
              <p className="text-sm font-semibold text-[var(--pmu-text-muted)]">
                {item.title}
              </p>
              <p className="text-sm text-[var(--pmu-text-soft)]">
                {item.trackLabel} - {item.timeLabel} - {item.metaLabel}
              </p>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-2">
              <span className="rounded-lg border border-[color-mix(in_srgb,var(--pmu-primary)_35%,transparent)] bg-[var(--pmu-primary-fade)] px-3 py-1.5 text-xs font-bold uppercase text-[var(--pmu-primary)]">
                {item.betType}
              </span>
              <ConfidenceBadge score={item.confidence} compact />
            </div>

            <div className="mt-auto pt-6">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--pmu-text-muted)]">
                Mise a jouer
              </p>
              <p className="mt-2 text-3xl font-black tracking-tight text-[var(--pmu-primary)]">
                {item.stake}
              </p>
              <p className="mt-1 text-xs font-semibold text-[var(--pmu-text-muted)]">
                Ouvre la course pour voir le gain potentiel.
              </p>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
