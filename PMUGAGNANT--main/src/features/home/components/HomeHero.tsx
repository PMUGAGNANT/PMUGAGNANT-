import type { HomeStats } from "@/features/home/components/home-page-types";
import { formatStake, type FeaturedRace } from "@/features/home/lib/home-page-model";
import { formatLiveRoi, hasLiveStatsData, type LiveStatsSnapshot } from "@/lib/live-stats";

type HomeHeroProps = {
  stats: HomeStats;
  liveStats: LiveStatsSnapshot;
  focusRace: FeaturedRace | null;
  onOpenPremium: () => void;
  onOpenFocus: () => void;
};

function getHeroDecision(focusRace: FeaturedRace | null) {
  if (!focusRace) {
    return {
      label: "Analyse en cours",
      tone: "neutral" as const,
      text: "Le moteur attend les courses du jour.",
    };
  }

  if (focusRace.status === "jouable") {
    return {
      label: "JOUER",
      tone: "success" as const,
      text: "Une course claire, un cheval, une mise.",
    };
  }

  if (focusRace.status === "surveillance") {
    return {
      label: "SURVEILLER",
      tone: "warning" as const,
      text: "Le moteur garde la course, sans feu vert total.",
    };
  }

  return {
    label: "PASSER",
    tone: "neutral" as const,
    text: "Pas assez de signal pour engager une mise.",
  };
}

export function HomeHero({
  stats,
  liveStats,
  focusRace,
  onOpenPremium,
  onOpenFocus,
}: HomeHeroProps) {
  const decision = getHeroDecision(focusRace);
  const hasStats = hasLiveStatsData(liveStats);
  const performanceValue = hasStats ? formatLiveRoi(liveStats.roi30d) : "--";
  const performanceLabel = hasStats
    ? `${liveStats.totalPredictions} tickets mesures sur 30 jours`
    : "Stats Supabase en cours";
  const weeklyGain =
    hasStats && liveStats.predictions7d > 0
      ? `${liveStats.netGain7d >= 0 ? "+" : ""}${Math.round(liveStats.netGain7d)} EUR`
      : "--";
  const focusPick = focusRace?.score?.pick;
  const focusStake = formatStake(
    focusPick?.confidence ? Math.max(6, Math.round(focusPick.confidence * 2.5)) : 8
  );
  const focusHorse =
    focusPick?.nom || focusPick?.numPmu
      ? `#${focusPick?.numPmu ?? "--"} ${focusPick?.nom ?? "Selection"}`
      : "Ticket du jour";

  return (
    <section className="app-page-hero p-5 md:p-6">
      <div className="grid gap-4 xl:grid-cols-[1fr,0.82fr]">
        <div className="app-card p-5 md:p-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="turf-decision-badge" data-tone="success">
              IA PMU V9.2
            </span>
            <span className="turf-decision-badge" data-tone={decision.tone}>
              {decision.label}
            </span>
          </div>

          <h1 className="mt-4 max-w-4xl text-[2.35rem] font-black leading-[0.95] text-[var(--pmu-text)] md:text-[3.55rem]">
            Cockpit PMU du jour.
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-[var(--pmu-text-soft)]">
            Tout est range en fenetres : decision, ticket, radar, programme et
            preuves. Tu ouvres seulement le panneau utile.
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className="app-card-muted px-4 py-3">
              <p className="app-label">ROI 30 jours</p>
              <p className="mt-1 text-3xl font-black text-[var(--pmu-primary)]">
                {performanceValue}
              </p>
              <span className="text-xs font-semibold text-[var(--pmu-text-muted)]">
                {performanceLabel}
              </span>
            </div>
            <div className="app-card-muted px-4 py-3">
              <p className="app-label">A traiter</p>
              <p className="mt-1 text-3xl font-black text-[var(--pmu-text)]">
                {stats.playable}
              </p>
              <span className="text-xs font-semibold text-[var(--pmu-text-muted)]">
                tickets valides sur {stats.total || "--"}
              </span>
            </div>
            <div className="app-card-muted px-4 py-3">
              <p className="app-label">Gain 7 jours</p>
              <p className="mt-1 text-3xl font-black text-[var(--pmu-gold)]">
                {weeklyGain}
              </p>
              <span className="text-xs font-semibold text-[var(--pmu-text-muted)]">
                {hasStats ? `${liveStats.predictions7d} tickets mesures` : decision.text}
              </span>
            </div>
          </div>
        </div>

        <div className="app-card p-5 md:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="app-kicker">Fenetre prioritaire</p>
              <h2 className="mt-2 text-2xl font-black leading-tight text-[var(--pmu-text)]">
                {focusHorse}
              </h2>
            </div>
            <span className="turf-decision-badge" data-tone={decision.tone}>
              {decision.label}
            </span>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="result-chip px-3 py-3">
              <p className="app-label">Mise</p>
              <p className="mt-1 text-xl font-black text-[var(--pmu-gold)]">
                {focusStake}
              </p>
            </div>
            <div className="result-chip px-3 py-3">
              <p className="app-label">Confiance</p>
              <p className="mt-1 text-xl font-black text-[var(--pmu-primary)]">
                {focusRace ? `${focusRace.scoreValue.toFixed(1)}/10` : "--"}
              </p>
            </div>
            <div className="result-chip px-3 py-3">
              <p className="app-label">Action</p>
              <p className="mt-1 text-xl font-black text-[var(--pmu-text)]">
                Ouvrir
              </p>
            </div>
          </div>

          <p className="mt-4 text-sm leading-6 text-[var(--pmu-text-soft)]">
            {focusRace?.hint ??
              "Le moteur transforme le programme PMU en decisions simples, sans garantie de gain."}
          </p>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              className="app-button-primary min-h-12 w-full sm:w-auto"
              onClick={onOpenFocus}
            >
              Ouvrir la fenetre course
            </button>
            <button
              type="button"
              className="app-button-secondary min-h-12 w-full sm:w-auto"
              onClick={onOpenPremium}
            >
              Debloquer premium
            </button>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-2 text-sm font-bold text-[var(--pmu-text-soft)] sm:grid-cols-3">
        <span className="rounded-lg border border-[var(--pmu-border)] bg-[var(--pmu-surface)] px-3 py-2">
          1. Decision prioritaire
        </span>
        <span className="rounded-lg border border-[var(--pmu-border)] bg-[var(--pmu-surface)] px-3 py-2">
          2. Programme classe
        </span>
        <span className="rounded-lg border border-[var(--pmu-border)] bg-[var(--pmu-surface)] px-3 py-2">
          3. Preuves repliees
        </span>
      </div>
    </section>
  );
}
