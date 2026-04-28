import Image from "next/image";

import type { HomeStats } from "@/features/home/components/home-page-types";
import { formatCourseMeta, formatStake, type FeaturedRace } from "@/features/home/lib/home-page-model";
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
  const focusCode = focusRace ? `R${focusRace.race.reunion}C${focusRace.race.course}` : "--";
  const focusMeta = focusRace ? formatCourseMeta(focusRace.race) : "Programme en attente";
  const focusTime = focusRace?.race.heureDepart ?? "--:--";
  const focusTitle = focusRace?.race.nomCourse ?? "Course prioritaire en preparation";

  return (
    <section className="app-page-hero overflow-hidden p-0">
      <div className="grid border-b border-[var(--pmu-border)] sm:grid-cols-2 xl:grid-cols-4">
        <div className="border-b border-[var(--pmu-border)] p-4 sm:border-r xl:border-b-0">
          <p className="app-label">Decision IA</p>
          <div className="mt-2 flex items-center gap-2">
            <span className="turf-decision-badge" data-tone={decision.tone}>
              {decision.label}
            </span>
            <span className="text-xs font-black uppercase text-[var(--pmu-primary)]">V9.2</span>
          </div>
          <p className="mt-3 text-sm font-semibold text-[var(--pmu-text-soft)]">{decision.text}</p>
        </div>

        <div className="border-b border-[var(--pmu-border)] p-4 xl:border-b-0 xl:border-r">
          <p className="app-label">Course focus</p>
          <p className="mt-2 text-3xl font-black text-[var(--pmu-primary)]">{focusCode}</p>
          <p className="mt-1 truncate text-sm font-semibold text-[var(--pmu-text-soft)]">{focusTime} - {focusRace?.race.hippodrome ?? "Hippodrome"}</p>
        </div>

        <div className="border-b border-[var(--pmu-border)] p-4 sm:border-r xl:border-b-0">
          <p className="app-label">Tickets valides</p>
          <p className="mt-2 text-3xl font-black text-[var(--pmu-text)]">{stats.playable}</p>
          <p className="mt-1 text-sm font-semibold text-[var(--pmu-text-soft)]">sur {stats.total || "--"} courses analysees</p>
        </div>

        <div className="p-4">
          <p className="app-label">ROI reel</p>
          <p className="mt-2 text-3xl font-black text-[var(--pmu-gold)]">{performanceValue}</p>
          <p className="mt-1 truncate text-sm font-semibold text-[var(--pmu-text-soft)]">{performanceLabel}</p>
        </div>
      </div>

      <div className="grid gap-0 xl:grid-cols-[1fr,25rem]">
        <div className="p-5 md:p-7">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-lg border border-[color-mix(in_srgb,var(--pmu-primary)_28%,transparent)] bg-[var(--pmu-primary-fade)] px-3 py-2 text-sm font-black uppercase text-[var(--pmu-primary)]">
              Programme trie
            </span>
            <span className="rounded-lg border border-[var(--pmu-border)] px-3 py-2 text-sm font-bold text-[var(--pmu-text-soft)]">
              {focusMeta}
            </span>
          </div>

          <h1 className="mt-5 max-w-4xl text-[2.3rem] font-black leading-[0.95] text-[var(--pmu-text)] md:text-[3.7rem]">
            {focusCode} - {focusTitle}
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-[var(--pmu-text-soft)]">
            Un seul ecran pour decider : course, cheval, mise, confiance et
            action. Le reste est range dans les fenetres plus bas.
          </p>

          <div className="mt-6 grid gap-3 md:grid-cols-3">
            <div className="result-chip px-4 py-3.5">
              <p className="app-label">Cheval</p>
              <p className="mt-1 truncate text-lg font-black text-[var(--pmu-text)]">{focusHorse}</p>
            </div>
            <div className="result-chip px-4 py-3.5">
              <p className="app-label">Mise</p>
              <p className="mt-1 text-2xl font-black text-[var(--pmu-gold)]">{focusStake}</p>
            </div>
            <div className="result-chip px-4 py-3.5">
              <p className="app-label">Confiance</p>
              <p className="mt-1 text-2xl font-black text-[var(--pmu-primary)]">
                {focusRace ? `${focusRace.scoreValue.toFixed(1)}/10` : "--"}
              </p>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              className="app-button-primary min-h-12 w-full sm:w-auto"
              onClick={onOpenFocus}
            >
              Ouvrir la course
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

        <aside className="border-t border-[var(--pmu-border)] bg-[color-mix(in_srgb,var(--pmu-surface-2)_78%,transparent)] p-5 xl:border-l xl:border-t-0">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="app-kicker">Ticket express</p>
              <h2 className="mt-2 text-2xl font-black text-[var(--pmu-text)]">A faire maintenant</h2>
            </div>
            <span className="turf-decision-badge" data-tone={decision.tone}>
              {decision.label}
            </span>
          </div>

          <div className="pmu-waiting-scene relative mt-5 h-36 overflow-hidden rounded-lg border border-[var(--pmu-border)] bg-black">
            <Image
              src="/pmu-waiting-race.png"
              alt="Chevaux au depart en attente du signal PMU"
              fill
              sizes="(min-width: 1280px) 25rem, 100vw"
              className="pmu-waiting-scene__image object-cover opacity-80"
            />
            <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(5,11,24,0.78),rgba(5,11,24,0.16)),linear-gradient(180deg,transparent,rgba(5,11,24,0.68))]" />
            <div className="pmu-waiting-scene__scan" aria-hidden />
            <div className="absolute right-3 top-3 flex items-center gap-1.5" aria-hidden>
              <span className="pmu-waiting-dot" />
              <span className="pmu-waiting-dot [animation-delay:0.18s]" />
              <span className="pmu-waiting-dot [animation-delay:0.36s]" />
            </div>
            <div className="absolute bottom-3 left-3 right-3">
              <p className="text-[0.68rem] font-black uppercase tracking-[0.16em] text-[var(--pmu-primary)]">
                En attente du feu vert
              </p>
              <p className="mt-1 text-sm font-black text-white">
                Le moteur garde la course sous surveillance.
              </p>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {[
              ["1", "Lire", `${focusCode} - ${focusTime}`],
              ["2", "Verifier", focusHorse],
              ["3", "Decider", decision.label],
            ].map(([step, title, value]) => (
              <div key={step} className="rounded-lg border border-[var(--pmu-border)] bg-[var(--pmu-surface)] p-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--pmu-primary)] text-sm font-black text-black">
                    {step}
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-black uppercase text-[var(--pmu-text-muted)]">{title}</p>
                    <p className="truncate text-sm font-black text-[var(--pmu-text)]">{value}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <p className="mt-5 text-sm leading-6 text-[var(--pmu-text-soft)]">
            {hasStats ? `${liveStats.predictions7d} tickets mesures cette semaine, resultat net ${weeklyGain}.` : "Les mesures live se rempliront quand Supabase renvoie les donnees."}
          </p>
        </aside>
      </div>
    </section>
  );
}
