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
          <h2 className="mt-2 text-2xl font-black tracking-tight text-white">Uniquement JOUABLE</h2>
        </div>
        <span className="rounded-full border border-[#333333] bg-transparent px-3 py-1.5 text-xs font-semibold text-[#888888]">
          #1 · #2 · #3
        </span>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-3">
        {list.map((item) => (
          <button
            key={`${item.rank}-${item.title}`}
            type="button"
            onClick={item.onClick}
            className="group flex h-full flex-col rounded-[1.6rem] border border-[#1E1E1E] bg-[#161616] p-5 text-left transition duration-300 hover:-translate-y-0.5 hover:border-[#00FF88]/40 hover:shadow-[0_0_32px_rgba(0,255,136,0.1)]"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[rgba(0,255,136,0.35)] bg-[rgba(0,255,136,0.1)] text-lg font-black text-[#00FF88]">
                #{item.rank}
              </div>
              <span className="rounded-full border border-[#333333] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#888888]">
                {item.sourceLabel}
              </span>
            </div>

            <div className="mt-5 space-y-2">
              <h3 className="text-xl font-black leading-tight text-white">{item.horse}</h3>
              <p className="text-sm font-semibold text-[#888888]">{item.title}</p>
              <p className="text-sm text-[#666666]">{item.subtitle}</p>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-[rgba(0,255,136,0.35)] bg-[rgba(0,255,136,0.08)] px-3 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-[#00FF88]">
                {item.betType}
              </span>
              <ConfidenceBadge score={item.confidence} compact />
            </div>

            <div className="mt-auto pt-6">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#888888]">Mise conseillee</p>
              <p className="mt-2 text-3xl font-black tracking-tight text-[#00FF88]">{item.stake}</p>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
