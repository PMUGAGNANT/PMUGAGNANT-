import Image from "next/image";

import type { HomeStats } from "@/features/home/components/home-page-types";
import type { TopParisItem } from "@/features/home/components/TopParisStrip";
import { formatStake, type FeaturedRace } from "@/features/home/lib/home-page-model";
import { formatLiveRoi, hasLiveStatsData, type LiveStatsSnapshot } from "@/lib/live-stats";

type HomeHeroProps = {
  stats: HomeStats;
  liveStats: LiveStatsSnapshot;
  focusRace: FeaturedRace | null;
  proofItems: TopParisItem[];
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
  proofItems,
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
    <section className="app-page-hero overflow-hidden p-0">
      <div className="grid gap-0 xl:grid-cols-[1.05fr,0.95fr]">
        <div className="flex min-h-[34rem] flex-col justify-between gap-8 p-6 md:p-8 lg:p-10">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="turf-decision-badge" data-tone="success">
                IA PMU V9.2
              </span>
              <span className="turf-decision-badge" data-tone={decision.tone}>
                {decision.label}
              </span>
            </div>

            <h1 className="mt-5 max-w-4xl text-[2.5rem] font-black leading-[0.95] text-[var(--pmu-text)] md:text-[4.2rem]">
              L&apos;IA qui te dit exactement quoi jouer au PMU.
            </h1>

            <p className="mt-5 max-w-2xl text-base leading-8 text-[var(--pmu-text-soft)] md:text-lg">
              TurfEdge analyse les courses, sort le cheval a jouer, explique la
              confiance et calcule la mise. En 30 secondes, tu sais si tu joues
              ou si tu passes.
            </p>

            <div className="mt-7 grid gap-3 sm:grid-cols-3">
              <div className="app-card-muted px-4 py-3">
                <p className="app-label">ROI reel 30 jours</p>
                <p className="mt-1 text-3xl font-black text-[var(--pmu-primary)]">
                  {performanceValue}
                </p>
                <span className="text-xs font-semibold text-[var(--pmu-text-muted)]">
                  {performanceLabel}
                </span>
              </div>
              <div className="app-card-muted px-4 py-3">
                <p className="app-label">Aujourd&apos;hui</p>
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

            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                className="app-button-primary min-h-12 w-full sm:w-auto"
                onClick={onOpenPremium}
              >
                Debloquer les tickets premium
              </button>
              <button
                type="button"
                className="app-button-secondary min-h-12 w-full sm:w-auto"
                onClick={onOpenFocus}
              >
                Voir la meilleure course
              </button>
            </div>
          </div>

          <div className="rounded-lg border border-[color-mix(in_srgb,var(--pmu-primary)_18%,transparent)] bg-[var(--pmu-primary-fade)] p-4">
            <p className="app-kicker">Dernieres selections fortes</p>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              {(proofItems.length > 0 ? proofItems.slice(0, 3) : []).map((item) => (
                <button
                  key={`${item.rank}-${item.raceCode}`}
                  type="button"
                  onClick={item.onClick}
                  className="rounded-lg border border-[var(--pmu-border)] bg-[var(--pmu-surface)] p-3 text-left shadow-[var(--pmu-shadow-sm)] transition duration-200 hover:-translate-y-0.5 hover:border-[color-mix(in_srgb,var(--pmu-primary)_34%,transparent)]"
                >
                  <span className="text-[0.72rem] font-black uppercase text-[var(--pmu-primary)]">
                    {item.raceCode}
                  </span>
                  <p className="mt-1 truncate text-sm font-black text-[var(--pmu-text)]">
                    {item.horse}
                  </p>
                  <p className="mt-1 text-xs font-semibold text-[var(--pmu-text-muted)]">
                    {item.stake} conseillee - confiance {item.confidence.toFixed(1)}/10
                  </p>
                </button>
              ))}
              {proofItems.length === 0 ? (
                <div className="rounded-lg border border-dashed border-[var(--pmu-border-strong)] bg-[var(--pmu-surface)] p-4 text-sm leading-6 text-[var(--pmu-text-soft)] md:col-span-3">
                  Les tickets gagnants remontent ici des que les arrivees
                  officielles sont enregistrees.
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="relative min-h-[28rem] overflow-hidden border-t border-[var(--pmu-border)] bg-[var(--pmu-primary)] xl:border-l xl:border-t-0">
          <Image
            src="/promo-poster.jpg"
            alt="Parieur consultant TurfEdge avant une course PMU"
            fill
            priority
            sizes="(min-width: 1280px) 48vw, 100vw"
            className="object-cover opacity-45"
          />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(7,94,54,0.18),rgba(7,94,54,0.82))]" />
          <div className="relative z-[1] flex h-full min-h-[28rem] items-end p-6 md:p-8">
            <div className="w-full rounded-lg border border-white/18 bg-[rgba(255,253,248,0.94)] p-5 shadow-[0_22px_46px_rgba(0,0,0,0.16)]">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="app-label">Ticket clair</p>
                  <p className="mt-1 text-3xl font-black text-[var(--pmu-text)]">
                    {focusHorse}
                  </p>
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
                  <p className="app-label">Prochaine etape</p>
                  <p className="mt-1 text-xl font-black text-[var(--pmu-text)]">
                    Ouvrir
                  </p>
                </div>
              </div>
              <p className="mt-4 text-sm leading-6 text-[var(--pmu-text-soft)]">
                {focusRace?.hint ??
                  "Le moteur transforme le programme PMU en decisions simples."}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
