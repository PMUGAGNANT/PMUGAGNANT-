import { asArray } from "@/lib/array-utils";
import { ConfidenceBadge } from "./ConfidenceBadge";

export type TopParisItem = {
  rank: number;
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
          <p className="app-kicker">Top 3 Paris du jour</p>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-[var(--pmu-text)]">Execution premium</h2>
        </div>
        <span className="app-pill text-xs">3 priorites</span>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-3">
        {list.map((item) => (
          <button
            key={`${item.rank}-${item.title}`}
            type="button"
            onClick={item.onClick}
            className="group flex h-full flex-col rounded-[1.6rem] border border-[var(--pmu-border)] bg-[linear-gradient(165deg,#ffffff_0%,#f8fafc_100%)] p-5 text-left transition duration-200 hover:-translate-y-0.5 hover:border-[rgba(13,148,136,0.3)] hover:shadow-[0_20px_44px_rgba(15,23,42,0.08)]"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[rgba(13,148,136,0.12)] text-lg font-bold text-[var(--pmu-primary)]">
                {item.rank}
              </div>
              <span className="app-pill text-[11px]">{item.sourceLabel}</span>
            </div>

            <div className="mt-5 space-y-2">
              <h3 className="text-xl font-black leading-tight text-[var(--pmu-text)]">{item.horse}</h3>
              <p className="text-sm font-medium text-[var(--pmu-text-muted)]">{item.title}</p>
              <p className="text-sm text-[var(--pmu-text-soft)]">{item.subtitle}</p>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-[rgba(13,148,136,0.28)] bg-[rgba(13,148,136,0.08)] px-3 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-[var(--pmu-primary)]">
                {item.betType}
              </span>
              <ConfidenceBadge score={item.confidence} compact />
            </div>

            <div className="mt-auto pt-6">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--pmu-text-muted)]">Mise conseillee</p>
              <p className="mt-2 text-3xl font-black tracking-tight text-[var(--pmu-text)]">{item.stake}</p>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
