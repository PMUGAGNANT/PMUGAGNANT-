export function CourseDetailSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-[96rem] flex-col gap-6">
      <div className="app-page-hero h-64 animate-pulse" />
      <div className="grid gap-5 xl:grid-cols-[1.12fr,0.88fr]">
        <div className="app-card h-[28rem] animate-pulse bg-[linear-gradient(180deg,var(--pmu-surface-highlight)_0%,var(--pmu-surface)_100%)]" />
        <div className="grid gap-5">
          <div className="app-card h-56 animate-pulse bg-[linear-gradient(180deg,var(--pmu-surface-highlight)_0%,var(--pmu-surface)_100%)]" />
          <div className="app-card h-56 animate-pulse bg-[linear-gradient(180deg,var(--pmu-surface-highlight)_0%,var(--pmu-surface)_100%)]" />
        </div>
      </div>
      <div className="app-card h-[34rem] animate-pulse bg-[linear-gradient(180deg,var(--pmu-surface-highlight)_0%,var(--pmu-surface)_100%)]" />
    </div>
  );
}
