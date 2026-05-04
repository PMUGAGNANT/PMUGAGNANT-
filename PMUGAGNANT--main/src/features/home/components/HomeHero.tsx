import Image from "next/image";

import type { HomeStats } from "@/features/home/components/home-page-types";
import {
  formatCourseMeta,
  formatMinutesLabel,
  formatRaceCode,
  formatStake,
  type FeaturedRace,
} from "@/features/home/lib/home-page-model";
import { formatLiveRoi, hasLiveStatsData, type LiveStatsSnapshot } from "@/lib/live-stats";

type HomeHeroProps = {
  stats: HomeStats;
  liveStats: LiveStatsSnapshot;
  focusRace: FeaturedRace | null;
  programmeRaces: FeaturedRace[];
  onOpenPremium: () => void;
  onOpenFocus: () => void;
  onOpenRace: (race: FeaturedRace) => void;
};

function getHeroDecision(focusRace: FeaturedRace | null) {
  if (!focusRace) {
    return {
      label: "Analyse",
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
      text: "Le signal est interessant, mais le moteur attend confirmation.",
    };
  }

  return {
    label: "PASSER",
    tone: "neutral" as const,
    text: "Pas assez de signal pour engager une mise.",
  };
}

function getStatusLabel(status: FeaturedRace["status"]) {
  if (status === "jouable") return "Jouer";
  if (status === "surveillance") return "A suivre";
  if (status === "resultat") return "Resultat";
  return "Passer";
}

export function HomeHero({
  stats,
  liveStats,
  focusRace,
  programmeRaces,
  onOpenPremium,
  onOpenFocus,
  onOpenRace,
}: HomeHeroProps) {
  const decision = getHeroDecision(focusRace);
  const hasStats = hasLiveStatsData(liveStats);
  const performanceValue = hasStats ? formatLiveRoi(liveStats.roi30d) : "--";
  const performanceLabel = hasStats
    ? `${liveStats.totalPredictions} tickets mesures sur 30 jours`
    : "Stats Supabase en cours";
  const focusPick = focusRace?.score?.pick;
  const focusStake = formatStake(
    focusPick?.confidence ? Math.max(6, Math.round(focusPick.confidence * 2.5)) : 8
  );
  const focusHorse =
    focusPick?.nom || focusPick?.numPmu
      ? `#${focusPick?.numPmu ?? "--"} ${focusPick?.nom ?? "Selection"}`
      : "Ticket du jour";
  const focusCode = focusRace ? formatRaceCode(focusRace.race) : "--";
  const focusMeta = focusRace ? formatCourseMeta(focusRace.race) : "Programme en attente";
  const focusTime = focusRace?.race.heureDepart ?? "--:--";
  const focusTitle = focusRace?.race.nomCourse ?? "Course prioritaire en preparation";
  const programme = programmeRaces.slice(0, 9);

  return (
    <section className="overflow-hidden rounded-lg border border-[var(--pmu-border)] bg-[var(--pmu-surface)] shadow-[var(--pmu-shadow-lg)]">
      <div className="grid min-h-[40rem] lg:grid-cols-[minmax(0,1fr)_27rem] 2xl:grid-cols-[minmax(0,1fr)_30rem]">
        <div className="relative min-h-[36rem] overflow-hidden bg-black lg:min-h-[40rem]">
          <Image
            src="/pmu-waiting-race.png"
            alt="Course hippique analysee par PMU Gagnant"
            fill
            priority
            sizes="(min-width: 1024px) calc(100vw - 27rem), 100vw"
            className="object-cover opacity-90"
          />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(2,8,18,0.96)_0%,rgba(2,8,18,0.72)_42%,rgba(2,8,18,0.18)_100%),linear-gradient(180deg,rgba(2,8,18,0.22),rgba(2,8,18,0.92))]" />
          <div className="absolute inset-x-0 top-0 border-b border-white/10 bg-black/18 px-4 py-3 backdrop-blur-sm md:px-8">
            <div className="grid gap-3 sm:grid-cols-4">
              <div>
                <p className="text-[0.68rem] font-black uppercase tracking-[0.12em] text-white/55">
                  Decision IA
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <span className="turf-decision-badge" data-tone={decision.tone}>
                    {decision.label}
                  </span>
                  <span className="text-xs font-black text-[var(--pmu-primary)]">V9.2</span>
                </div>
              </div>
              <div>
                <p className="text-[0.68rem] font-black uppercase tracking-[0.12em] text-white/55">
                  Course focus
                </p>
                <p className="mt-2 text-2xl font-black text-[var(--pmu-primary)]">{focusCode}</p>
              </div>
              <div>
                <p className="text-[0.68rem] font-black uppercase tracking-[0.12em] text-white/55">
                  Tickets valides
                </p>
                <p className="mt-2 text-2xl font-black text-white">{stats.playable}</p>
              </div>
              <div>
                <p className="text-[0.68rem] font-black uppercase tracking-[0.12em] text-white/55">
                  ROI reel
                </p>
                <p className="mt-2 text-2xl font-black text-[var(--pmu-gold)]">{performanceValue}</p>
              </div>
            </div>
          </div>

          <div className="relative z-[1] flex min-h-[36rem] flex-col justify-end px-5 pb-7 pt-32 md:px-8 md:pb-9 lg:min-h-[40rem]">
            <div className="max-w-4xl">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-lg bg-[var(--pmu-primary)] px-3 py-2 text-sm font-black uppercase text-black">
                  Programme IA
                </span>
                <span className="rounded-lg border border-white/20 bg-black/28 px-3 py-2 text-sm font-black uppercase text-white">
                  {focusMeta}
                </span>
                <span className="rounded-lg border border-white/20 bg-black/28 px-3 py-2 text-sm font-black uppercase text-white">
                  {focusTime}
                </span>
              </div>

              <p className="mt-6 text-sm font-black text-[var(--pmu-primary)]">
                Depart dans {formatMinutesLabel(focusRace?.minutesUntilStart)}
              </p>
              <h1 className="mt-3 max-w-3xl font-[var(--font-display)] text-[3.1rem] font-black leading-[0.9] text-white md:text-[4.8rem] 2xl:text-[5.4rem]">
                {focusCode} {focusTitle}
              </h1>
              <p className="mt-5 max-w-2xl text-base font-semibold leading-7 text-white/78">
                {decision.text} Choisis la course, verifie le cheval, ouvre le ticket. Le programme reste range a droite.
              </p>

              <div className="mt-6 grid gap-3 md:grid-cols-3">
                <div className="rounded-lg border border-white/15 bg-black/45 px-4 py-4 backdrop-blur">
                  <p className="text-[0.68rem] font-black uppercase tracking-[0.12em] text-white/48">
                    Cheval
                  </p>
                  <p className="mt-2 truncate text-xl font-black text-white">{focusHorse}</p>
                </div>
                <div className="rounded-lg border border-white/15 bg-black/45 px-4 py-4 backdrop-blur">
                  <p className="text-[0.68rem] font-black uppercase tracking-[0.12em] text-white/48">
                    Mise
                  </p>
                  <p className="mt-2 text-3xl font-black text-[var(--pmu-gold)]">{focusStake}</p>
                </div>
                <div className="rounded-lg border border-white/15 bg-black/45 px-4 py-4 backdrop-blur">
                  <p className="text-[0.68rem] font-black uppercase tracking-[0.12em] text-white/48">
                    Confiance
                  </p>
                  <p className="mt-2 text-3xl font-black text-[var(--pmu-primary)]">
                    {focusRace ? `${focusRace.scoreValue.toFixed(1)}/10` : "--"}
                  </p>
                </div>
              </div>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <button type="button" className="app-button-primary min-h-12" onClick={onOpenFocus}>
                  Ouvrir la course
                </button>
                <button type="button" className="app-button-secondary min-h-12" onClick={onOpenPremium}>
                  Debloquer premium
                </button>
              </div>
            </div>
          </div>
        </div>

        <aside className="flex min-h-[36rem] flex-col bg-[#e8f6f2] p-4 text-[#062f2a] lg:min-h-[40rem]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-[#05725f]">
                Programme du jour
              </p>
              <h2 className="mt-1 text-2xl font-black text-[#062f2a]">Courses IA</h2>
            </div>
            <div className="grid h-11 w-11 place-items-center rounded-lg bg-[#00594f] text-sm font-black text-white">
              {stats.total}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 rounded-lg bg-white/70 p-1 text-sm font-black">
            <span className="rounded-md bg-[#00594f] px-4 py-3 text-center text-white">Courses</span>
            <span className="px-4 py-3 text-center text-[#00594f]">Reunions</span>
          </div>

          <div className="mt-4 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
            {programme.length > 0 ? (
              programme.map((item) => {
                const code = formatRaceCode(item.race);
                const isFocus =
                  focusRace &&
                  item.race.reunion === focusRace.race.reunion &&
                  item.race.course === focusRace.race.course;

                return (
                  <button
                    key={`${item.race.reunion}-${item.race.course}-${item.race.dateStr}`}
                    type="button"
                    onClick={() => onOpenRace(item)}
                    className={`w-full rounded-lg p-3 text-left transition hover:-translate-y-0.5 ${
                      isFocus
                        ? "bg-[#00594f] text-white shadow-lg"
                        : "bg-white text-[#062f2a] shadow-sm"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={`grid h-14 w-14 shrink-0 place-items-center rounded-lg font-[var(--font-display)] text-xl font-black ${
                          isFocus ? "bg-white/16 text-white" : "bg-[#e7f4f1] text-[#00594f]"
                        }`}
                      >
                        {code}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-start justify-between gap-2">
                          <strong className="block truncate text-lg font-black">
                            {item.race.hippodrome}
                          </strong>
                          <em className="shrink-0 text-sm font-black not-italic">
                            {item.race.heureDepart}
                          </em>
                        </span>
                        <span className={`mt-1 block truncate text-sm font-bold ${isFocus ? "text-white/78" : "text-[#55706b]"}`}>
                          {item.race.nomCourse}
                        </span>
                        <span className="mt-2 flex flex-wrap gap-1.5">
                          <span className={`rounded-full px-2 py-1 text-[11px] font-black ${isFocus ? "bg-white/16 text-white" : "bg-[#e7f4f1] text-[#00594f]"}`}>
                            {getStatusLabel(item.status)}
                          </span>
                          <span className={`rounded-full px-2 py-1 text-[11px] font-black ${isFocus ? "bg-white/16 text-white" : "bg-[#e7f4f1] text-[#00594f]"}`}>
                            {item.race.nombrePartants} partants
                          </span>
                        </span>
                      </span>
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="rounded-lg bg-white p-5 text-sm font-bold text-[#55706b]">
                Le programme charge les courses du jour.
              </div>
            )}
          </div>

          <div className="mt-4 rounded-lg bg-white p-4">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[#55706b]">
              Preuve moteur
            </p>
            <p className="mt-2 text-xl font-black text-[#00594f]">{performanceValue}</p>
            <p className="mt-1 text-sm font-bold text-[#55706b]">{performanceLabel}</p>
          </div>
        </aside>
      </div>
    </section>
  );
}
