import type { RaceSummary } from "@/lib/types";
import { TopCoursesGrid } from "@/features/home/components/TopCoursesGrid";
import type {
  HomeLane,
  QuickFilter,
  QuickFilterOption,
} from "@/features/home/components/home-page-types";

function QuickFilterBar({
  value,
  options,
  onChange,
}: {
  value: QuickFilter;
  options: QuickFilterOption[];
  onChange: (next: QuickFilter) => void;
}) {
  const activeOption = options.find((option) => option.value === value);

  return (
    <section className="app-card p-4 md:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="app-kicker">Filtre express</p>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-[var(--pmu-text)]">
            Voir clair en un clic
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--pmu-text-soft)]">
            Choisis un angle de lecture : le board garde le focus et remet les
            courses importantes devant tes yeux.
          </p>
        </div>
        <div className="rounded-[0.8rem] border border-[color-mix(in_srgb,var(--pmu-primary)_24%,transparent)] bg-[var(--pmu-primary-fade)] px-4 py-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--pmu-text-muted)]">
            Vue active
          </p>
          <p className="mt-1 text-xl font-black text-[var(--pmu-primary)]">
            {activeOption?.count ?? 0} course{(activeOption?.count ?? 0) > 1 ? "s" : ""}
          </p>
        </div>
      </div>

      <div
        role="toolbar"
        aria-label="Filtre rapide du programme"
        className="mt-5 -mx-1 overflow-x-auto pb-1 [scrollbar-width:thin]"
      >
        <div className="flex min-w-max gap-2 px-1">
          {options.map((option) => {
            const active = option.value === value;
            const disabled = option.value !== "all" && option.count === 0;

            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={active}
                disabled={disabled}
                onClick={() => onChange(option.value)}
                className={`app-pill flex min-w-[9.5rem] flex-col items-start gap-1 whitespace-nowrap text-left disabled:cursor-not-allowed disabled:opacity-45 ${
                  active ? "app-pill--active" : ""
                }`}
              >
                <span className="flex w-full items-center justify-between gap-3">
                  <strong>{option.label}</strong>
                  <span>{option.count}</span>
                </span>
                <small className="text-[11px] font-medium normal-case tracking-normal text-[var(--pmu-text-soft)]">
                  {option.description}
                </small>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function ProgrammeTable({
  quickFilter,
  quickFilterOptions,
  lanes,
  playableCount,
  onQuickFilterChange,
  onOpenRace,
}: {
  quickFilter: QuickFilter;
  quickFilterOptions: QuickFilterOption[];
  lanes: HomeLane[];
  playableCount: number;
  onQuickFilterChange: (next: QuickFilter) => void;
  onOpenRace: (race: RaceSummary) => void;
}) {
  return (
    <>
      <QuickFilterBar
        value={quickFilter}
        options={quickFilterOptions}
        onChange={onQuickFilterChange}
      />

      {playableCount === 0 && lanes.some((lane) => lane.key === "surveillance") ? (
        <section className="app-card p-5 text-sm leading-6 text-[var(--pmu-text-soft)]">
          Aucune course verte pour l&apos;instant. La meilleure surveillance reste
          visible juste en dessous pour garder une ouverture prioritaire.
        </section>
      ) : null}

      {lanes.length > 0 ? (
        <section className="space-y-6">
          {lanes.map((lane) => (
            <TopCoursesGrid key={lane.key} lane={lane} onOpenRace={onOpenRace} />
          ))}
        </section>
      ) : (
        <section className="app-card p-5 text-sm leading-6 text-[var(--pmu-text-soft)]">
          Ce filtre ne sort aucune course sur cette date. Repasse en vue complete
          pour revoir tout le programme.
          <button
            type="button"
            className="app-button-secondary mt-4"
            onClick={() => onQuickFilterChange("all")}
          >
            Revoir tout
          </button>
        </section>
      )}
    </>
  );
}
