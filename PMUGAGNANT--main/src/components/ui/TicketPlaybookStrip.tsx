import { asArray } from "@/lib/array-utils";
import { ConfidenceBadge } from "./ConfidenceBadge";

export type TicketPlaybookItem = {
  profile: "prudent" | "equilibre" | "offensif";
  title: string;
  subtitle: string;
  horse: string;
  stake: string;
  betType: string;
  confidence: number;
  summary: string;
  onClick: () => void;
};

const PROFILE_META: Record<
  TicketPlaybookItem["profile"],
  { kicker: string; badge: string; accent: string; surface: string }
> = {
  prudent: {
    kicker: "Ticket prudent",
    badge: "Base discipline",
    accent: "var(--pmu-orange)",
    surface: "color-mix(in srgb, var(--pmu-orange) 10%, var(--pmu-surface-2))",
  },
  equilibre: {
    kicker: "Ticket equilibre",
    badge: "Signal central",
    accent: "var(--pmu-accent-blue)",
    surface: "color-mix(in srgb, var(--pmu-accent-blue) 10%, var(--pmu-surface-2))",
  },
  offensif: {
    kicker: "Ticket offensif",
    badge: "Value assumee",
    accent: "var(--pmu-primary)",
    surface: "color-mix(in srgb, var(--pmu-primary) 10%, var(--pmu-surface-2))",
  },
};

type TicketPlaybookStripProps = {
  items: TicketPlaybookItem[];
};

export function TicketPlaybookStrip({ items }: TicketPlaybookStripProps) {
  const list = asArray<TicketPlaybookItem>(items);

  return (
    <section className="app-card p-4 md:p-5">
      <div className="app-section-heading">
        <div>
          <p className="app-kicker">3 tickets du jour</p>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-[var(--pmu-text)]">
            Prudent, equilibre, offensif
          </h2>
        </div>
        <p className="max-w-xl text-sm leading-6 text-[var(--pmu-text-soft)]">
          Trois usages du meme moteur pour jouer avec plus de discipline selon ton niveau
          d&apos;engagement.
        </p>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-3">
        {list.map((item) => {
          const meta = PROFILE_META[item.profile];
          return (
            <button
              key={`${item.profile}-${item.horse}`}
              type="button"
              onClick={item.onClick}
              className="group flex h-full flex-col rounded-[1.6rem] border p-5 text-left transition duration-300 hover:-translate-y-0.5 hover:shadow-[var(--pmu-glow)]"
              style={{
                borderColor: `color-mix(in srgb, ${meta.accent} 30%, var(--pmu-border))`,
                background: meta.surface,
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p
                    className="text-[10px] font-black uppercase tracking-[0.18em]"
                    style={{ color: meta.accent }}
                  >
                    {meta.kicker}
                  </p>
                  <h3 className="mt-2 text-xl font-black leading-tight text-[var(--pmu-text)]">
                    {item.horse}
                  </h3>
                </div>
                <span
                  className="rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider"
                  style={{
                    color: meta.accent,
                    background: `color-mix(in srgb, ${meta.accent} 14%, transparent)`,
                    border: `1px solid color-mix(in srgb, ${meta.accent} 32%, transparent)`,
                  }}
                >
                  {meta.badge}
                </span>
              </div>

              <div className="mt-4 space-y-2">
                <p className="text-sm font-semibold text-[var(--pmu-text-muted)]">{item.title}</p>
                <p className="text-sm text-[var(--pmu-text-soft)]">{item.subtitle}</p>
                <p className="text-sm leading-6 text-[var(--pmu-text-soft)]">{item.summary}</p>
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-2">
                <span
                  className="rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-[0.14em]"
                  style={{
                    color: meta.accent,
                    background: `color-mix(in srgb, ${meta.accent} 12%, transparent)`,
                    border: `1px solid color-mix(in srgb, ${meta.accent} 28%, transparent)`,
                  }}
                >
                  {item.betType}
                </span>
                <ConfidenceBadge score={item.confidence} compact />
              </div>

              <div className="mt-auto pt-6">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--pmu-text-muted)]">
                  Mise conseillee
                </p>
                <p
                  className="mt-2 text-3xl font-black tracking-tight"
                  style={{ color: meta.accent }}
                >
                  {item.stake}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
