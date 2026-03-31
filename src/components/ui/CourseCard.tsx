import { ConfidenceBadge } from "./ConfidenceBadge";
import { StatutBadge } from "./StatutBadge";

type CourseCardProps = {
  timeLabel: string;
  hippodrome: string;
  raceTitle: string;
  raceMeta: string;
  horseLabel: string;
  betTypeLabel: string;
  confidence: number;
  status: "jouable" | "surveillance" | "passer" | "resultat";
  noteLabel?: string;
  allocationLabel?: string;
  summary: string;
  onClick: () => void;
};

export function CourseCard({
  timeLabel,
  hippodrome,
  raceTitle,
  raceMeta,
  horseLabel,
  betTypeLabel,
  confidence,
  status,
  noteLabel,
  allocationLabel,
  summary,
  onClick,
}: CourseCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group app-card flex h-full w-full flex-col gap-5 p-5 text-left transition duration-200 hover:-translate-y-0.5 hover:border-[rgba(13,148,136,0.35)] hover:shadow-[0_20px_48px_rgba(15,23,42,0.1)]"
    >
      <div className="grid gap-4 xl:grid-cols-[0.78fr,1.2fr,0.95fr] xl:items-start">
        <div className="space-y-2">
          <p className="text-3xl font-black leading-none tracking-tight text-[var(--pmu-text)]">{timeLabel}</p>
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[var(--pmu-primary)]">{hippodrome}</p>
          <p className="text-sm leading-6 text-[var(--pmu-text-muted)]">{raceMeta}</p>
        </div>

        <div className="space-y-3">
          <div>
            <h3 className="text-2xl font-black leading-tight tracking-tight text-[var(--pmu-text)]">{raceTitle}</h3>
            <p className="mt-2 text-sm leading-6 text-[var(--pmu-text-soft)]">{summary}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-[rgba(13,148,136,0.28)] bg-[rgba(13,148,136,0.08)] px-3 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-[var(--pmu-primary)]">
              {betTypeLabel}
            </span>
            <span className="text-sm font-semibold text-[var(--pmu-text)]">{horseLabel}</span>
          </div>
        </div>

        <div className="flex flex-col gap-3 xl:items-end">
          <StatutBadge type={status} />
          <ConfidenceBadge score={confidence} />
          <div className="flex flex-wrap gap-2 xl:justify-end">
            {noteLabel ? <span className="app-pill text-xs">{noteLabel}</span> : null}
            {allocationLabel ? <span className="app-pill text-xs">{allocationLabel}</span> : null}
          </div>
        </div>
      </div>
    </button>
  );
}
