export function HomeLoadingSkeleton() {
  return (
    <div
      className="mx-auto flex w-full max-w-[96rem] flex-col gap-6 lg:gap-8"
      aria-busy="true"
      aria-label="Chargement du programme"
    >
      <div className="app-card h-44 animate-pulse bg-[var(--pmu-surface-highlight)]" />
      <div className="grid gap-5 xl:grid-cols-[0.37fr,0.63fr]">
        <div className="app-card h-[30rem] animate-pulse bg-[var(--pmu-surface-highlight)]" />
        <div className="app-card h-[30rem] animate-pulse bg-[var(--pmu-surface-highlight)]" />
      </div>
      <div className="grid gap-5 2xl:grid-cols-2">
        {Array.from({ length: 4 }, (_, index) => (
          <div
            key={index}
            className="app-card h-72 animate-pulse bg-[var(--pmu-surface-highlight)]"
          />
        ))}
      </div>
    </div>
  );
}
