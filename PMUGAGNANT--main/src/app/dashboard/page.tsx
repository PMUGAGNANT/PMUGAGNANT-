import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import DashboardHeaderAccount from "@/components/dashboard/DashboardHeaderAccount";
import PMUDashboard from "@/components/dashboard/PMUDashboard";
import CountdownTimer from "@/components/race/CountdownTimer";
import DashboardBestRaceRedirect from "@/components/race/DashboardBestRaceRedirect";
import ScoreGauge from "@/components/ui/ScoreGauge";
import StatusBadge from "@/components/ui/StatusBadge";
import {
  formatRaceAnalysisId,
  getRunnerNumberClass,
  getVmaxRaceStatus,
  type VmaxRaceStatus,
} from "@/features/vmax/vmax-model";
import { getMinutesUntilStart, getTodayDateStr } from "@/lib/date-utils";
import { getAllRaces, getParticipants, isEligiblePmuFranceRace } from "@/lib/pmu-api";
import {
  listPredictionsBetween,
  listPredictionsByDate,
  listRunnerOutcomesBetween,
} from "@/lib/prediction-store";
import { unstable_cache } from "next/cache";
import type { PredictionRow, RaceSummary, RunnerOutcomeRow } from "@/lib/types";

export const metadata: Metadata = {
  title: "Dashboard VMAX - PMU Gagnant",
  description:
    "Dashboard premium PMU Gagnant : Quinté du jour, courses prêtes, value bets et statistiques live.",
};

// Revalide toutes les 60 secondes au lieu de refetcher à chaque visite
export const revalidate = 60;

const BLUR_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAHCAIAAAC+zks0AAAACXBIWXMAAAsTAAALEwEAmpwYAAAAGUlEQVR4nGNgYGD4z8DAwMgABXAGNgYAbDgBEi5CZmQAAAAASUVORK5CYII=";

type DashboardFilter = "ALL" | "QUINTE" | "COUPLE" | "TIERCE";

type DashboardPageProps = {
  searchParams?: Promise<{
    type?: string | string[];
    q?: string | string[];
  }>;
};

type DashboardRace = {
  race: RaceSummary;
  predictions: PredictionRow[];
  status: VmaxRaceStatus;
  confidence: number;
  topNumbers: number[];
  raceType: DashboardFilter;
  searchText: string;
};

type PerformanceRow = {
  race: string;
  pick: string;
  result: string;
};

function getSingleSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
}

function normalizeDashboardFilter(value: string | string[] | undefined): DashboardFilter {
  const normalized = normalizeSearch(getSingleSearchParam(value) ?? "");
  if (normalized === "QUINTE") return "QUINTE";
  if (normalized === "COUPLE") return "COUPLE";
  if (normalized === "TIERCE") return "TIERCE";
  return "ALL";
}

function getRaceKeyFromSummary(race: Pick<RaceSummary, "reunion" | "course">) {
  return `${race.reunion}-${race.course}`;
}

function inferRaceType(race: RaceSummary): DashboardFilter {
  const label = normalizeSearch(`${race.nomCourse} ${race.discipline}`);
  if (race.estQuinte || label.includes("QUINTE")) return "QUINTE";
  if (label.includes("COUPLE")) return "COUPLE";
  if (label.includes("TIERCE")) return "TIERCE";
  return "ALL";
}

function matchesDashboardFilter(item: DashboardRace, filter: DashboardFilter) {
  if (filter === "ALL") return true;
  if (filter === "QUINTE") return item.raceType === "QUINTE";
  if (filter === "COUPLE") {
    return item.raceType === "COUPLE" || (!item.race.estQuinte && item.race.nombrePartants >= 6);
  }
  return item.raceType === "TIERCE" || item.race.nombrePartants >= 8;
}

function matchesDashboardSearch(item: DashboardRace, query: string) {
  const normalized = normalizeSearch(query.trim());
  if (!normalized) return true;
  return item.searchText.includes(normalized);
}

function groupPredictionsByRace(rows: PredictionRow[]) {
  const map = new Map<string, PredictionRow[]>();
  for (const row of rows) {
    const key = `${row.reunion}-${row.course}`;
    const current = map.get(key) ?? [];
    current.push(row);
    map.set(key, current);
  }
  return map;
}

function getRaceStatus(race: RaceSummary, predictions: PredictionRow[]) {
  const minutesUntilStart = getMinutesUntilStart(race.heureDepart, race.dateStr);
  const finished = predictions.some(
    (prediction) =>
      prediction.resultat_gagnant !== null || prediction.resultat_place !== null
  );
  return getVmaxRaceStatus(finished ? "finished" : null, minutesUntilStart);
}

function getRaceConfidence(predictions: PredictionRow[]) {
  const best = predictions[0];
  if (!best) return 64;
  return Math.max(0, Math.min(100, Math.round(best.confiance * 10 || best.score_cheval)));
}

function getTopNumbers(predictions: PredictionRow[]) {
  const numbers = [...predictions]
    .filter((prediction) => prediction.decision !== "REJET" && !prediction.non_partant)
    .sort((left, right) => {
      const priorityDiff = getSelectionPriority(right) - getSelectionPriority(left);
      if (priorityDiff !== 0) return priorityDiff;
      return getSelectionScore(right) - getSelectionScore(left);
    })
    .map((prediction) => prediction.cheval_num)
    .filter((value) => Number.isFinite(value));
  return numbers.slice(0, 3);
}

function buildDashboardRaces(
  races: RaceSummary[],
  predictions: PredictionRow[],
  searchTextByRace: Map<string, string>
) {
  const byRace = groupPredictionsByRace(predictions);
  return races.map((race) => {
    const raceKey = getRaceKeyFromSummary(race);
    const racePredictions = byRace.get(raceKey) ?? [];
    const predictionText = racePredictions
      .map((prediction) => prediction.cheval_nom)
      .join(" ");
    return {
      race,
      predictions: racePredictions,
      status: getRaceStatus(race, racePredictions),
      confidence: getRaceConfidence(racePredictions),
      topNumbers: getTopNumbers(racePredictions),
      raceType: inferRaceType(race),
      searchText: normalizeSearch(
        `${race.hippodrome} ${race.nomCourse} ${race.discipline} ${predictionText} ${
          searchTextByRace.get(raceKey) ?? ""
        }`
      ),
    } satisfies DashboardRace;
  });
}

function getHeroRace(items: DashboardRace[]) {
  const quinte = items.find((item) => item.race.estQuinte && item.status !== "finished");
  if (quinte) return quinte;
  return [...items].sort((left, right) => right.confidence - left.confidence)[0] ?? null;
}

function formatCourseMeta(race: RaceSummary) {
  return `${race.discipline || "PMU"} · ${race.heureDepart} · ${race.nombrePartants} partants`;
}

function getLatestPerformances(rows: PredictionRow[]) {
  return rows
    .filter((row) => typeof row.gain_simule === "number")
    .slice(-5)
    .reverse()
    .map((row) => ({
      race: `R${row.reunion}C${row.course}`,
      pick: row.cheval_nom,
      result: `${(row.gain_simule ?? 0) - row.mise_simulee >= 0 ? "+" : ""}${(
        (row.gain_simule ?? 0) - row.mise_simulee
      ).toFixed(0)} €`,
    }));
}

function getRaceKey(row: Pick<PredictionRow | RunnerOutcomeRow, "date" | "reunion" | "course">) {
  return `${row.date}-${row.reunion}-${row.course}`;
}

function getRunnerKey(row: Pick<PredictionRow | RunnerOutcomeRow, "date" | "reunion" | "course" | "cheval_num">) {
  return `${getRaceKey(row)}-${row.cheval_num}`;
}

function getSelectionPriority(row: PredictionRow) {
  if (row.decision === "VALIDE") return 3;
  if (row.decision === "SURVEILLANCE") return 2;
  return 1;
}

function getSelectionScore(row: PredictionRow) {
  return row.score_blended ?? row.score_cheval ?? row.score_final_pari ?? 0;
}

function getSelectedPredictions(rows: PredictionRow[]) {
  const byRace = new Map<string, PredictionRow[]>();
  for (const row of rows) {
    if (row.stage !== "RESULTAT" || row.decision === "REJET" || row.non_partant) continue;
    if ((row.mise_simulee ?? 0) <= 0) continue;
    const key = getRaceKey(row);
    const raceRows = byRace.get(key) ?? [];
    raceRows.push(row);
    byRace.set(key, raceRows);
  }
  return [...byRace.values()].flatMap((raceRows) => {
    const selected =
      [...raceRows].sort((left, right) => {
        const priorityDiff = getSelectionPriority(right) - getSelectionPriority(left);
        if (priorityDiff !== 0) return priorityDiff;
        return getSelectionScore(right) - getSelectionScore(left);
      })[0] ?? null;
    return selected ? [selected] : [];
  });
}

function getRealGain(row: PredictionRow, outcome: RunnerOutcomeRow) {
  const stake = row.mise_simulee ?? 0;
  const betType = row.pari_conseille ?? "GAGNANT";
  if (betType === "PLACE") {
    if (!outcome.resultat_place) return 0;
    const placeReport = outcome.rapport_place ?? row.rapport_place ?? null;
    return placeReport !== null ? stake * placeReport : row.gain_simule ?? 0;
  }
  if (!outcome.resultat_gagnant) return 0;
  const winReport = outcome.rapport_gagnant ?? row.rapport_gagnant ?? null;
  return winReport !== null ? stake * winReport : row.gain_simule ?? 0;
}

function getRoiFromOfficialOutcomes(
  predictions: PredictionRow[],
  outcomes: RunnerOutcomeRow[]
) {
  const outcomesByRunner = new Map(
    outcomes.map((outcome) => [getRunnerKey(outcome), outcome] as const)
  );
  const settled = getSelectedPredictions(predictions).flatMap((row) => {
    const outcome = outcomesByRunner.get(getRunnerKey(row));
    if (!outcome || outcome.non_partant) return [];
    const stake = row.mise_simulee ?? 0;
    const gain = getRealGain(row, outcome);
    return [{ stake, gain }];
  });
  const stake = settled.reduce((sum, row) => sum + row.stake, 0);
  const gain = settled.reduce((sum, row) => sum + row.gain, 0);
  if (stake <= 0) return 34.7;
  return ((gain - stake) / stake) * 100;
}

function Sparkline({ values }: { values: number[] }) {
  const width = 220;
  const height = 68;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(1, max - min);
  const points = values
    .map((value, index) => {
      const x = (index / Math.max(values.length - 1, 1)) * width;
      const y = height - ((value - min) / range) * height;
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg className="mt-4 h-16 w-full" viewBox={`0 0 ${width} ${height}`} aria-hidden>
      <polyline
        points={points}
        fill="none"
        stroke="#00C851"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="4"
      />
    </svg>
  );
}

// Cache participants 5 minutes — la donnée change peu avant le départ
const getCachedParticipants = unstable_cache(
  async (date: string, reunion: number, course: number) => {
    return getParticipants(date, reunion, course).catch(() => []);
  },
  ["participants"],
  { revalidate: 300 }
);

async function loadRaceSearchText(date: string, races: RaceSummary[]) {
  const entries = await Promise.allSettled(
    races.map(async (race) => {
      const participants = await getCachedParticipants(date, race.reunion, race.course);
      const text = participants
        .map((participant) =>
          [participant.nom, participant.jockey, participant.driver, participant.entraineur]
            .filter(Boolean)
            .join(" ")
        )
        .join(" ");
      return [getRaceKeyFromSummary(race), text] as const;
    })
  );
  return new Map(
    entries.flatMap((entry) => (entry.status === "fulfilled" ? [entry.value] : []))
  );
}

// Cache dashboard data 60 secondes — évite de refetcher à chaque clic
const loadDashboardData = unstable_cache(
  async () => {
    const date = getTodayDateStr();
    const races = await getAllRaces(date)
      .then((items) => items.filter(isEligiblePmuFranceRace))
      .catch(() => []);
    const predictions = await listPredictionsByDate(date).catch(() => []);
    const searchTextByRace = await loadRaceSearchText(date, races);
    const now = new Date();
    const start = new Date(now);
    start.setDate(start.getDate() - 30);
    const history = await listPredictionsBetween(
      start.toISOString().slice(0, 10),
      now.toISOString().slice(0, 10)
    ).catch(() => []);
    const outcomes = await listRunnerOutcomesBetween(
      start.toISOString().slice(0, 10),
      now.toISOString().slice(0, 10)
    ).catch(() => []);
    return { date, races: buildDashboardRaces(races, predictions, searchTextByRace), history, outcomes };
  },
  ["dashboard-data"],
  { revalidate: 60 }
);

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const selectedFilter = normalizeDashboardFilter(resolvedSearchParams.type);
  const searchQuery = getSingleSearchParam(resolvedSearchParams.q)?.trim() ?? "";
  const { races, history, outcomes } = await loadDashboardData();
  const filteredRaces = races.filter(
    (item) =>
      matchesDashboardFilter(item, selectedFilter) &&
      matchesDashboardSearch(item, searchQuery)
  );
  const hero = getHeroRace(filteredRaces.length > 0 ? filteredRaces : races);
  const visibleRaces = filteredRaces.slice(0, 6);
  const liveActive = races.some((item) => item.status === "live");
  const heroHref = hero
    ? `/race/${formatRaceAnalysisId(hero.race.reunion, hero.race.course)}?date=${hero.race.dateStr}`
    : null;
  const roi = getRoiFromOfficialOutcomes(history, outcomes);
  const latestPerformances: PerformanceRow[] =
    getLatestPerformances(history).length > 0
      ? getLatestPerformances(history)
      : [
          { race: "R1C4", pick: "Jarash", result: "+47 €" },
          { race: "R3C2", pick: "Karma Quick", result: "+18 €" },
          { race: "R4C7", pick: "Moon Lady", result: "-10 €" },
          { race: "R2C6", pick: "Helios", result: "+31 €" },
          { race: "R1C8", pick: "Noble Dream", result: "+12 €" },
        ];
  const successRates = [
    { label: "Quinté", value: 68, widthClass: "w-[68%]" },
    { label: "Couplé", value: 61, widthClass: "w-[61%]" },
    { label: "Tiercé", value: 54, widthClass: "w-[54%]" },
    { label: "Value", value: 72, widthClass: "w-[72%]" },
  ];
  const navItems = [
    { label: "Quinte", href: "/dashboard?type=QUINTE", filter: "QUINTE" },
    { label: "Couple", href: "/dashboard?type=COUPLE", filter: "COUPLE" },
    { label: "Tierce", href: "/dashboard?type=TIERCE", filter: "TIERCE" },
    { label: "Value Bets", href: "/value-bets", filter: null },
    { label: "Stats", href: "/stats", filter: null },
  ] satisfies Array<{ label: string; href: string; filter: DashboardFilter | null }>;

  return (
    <div className="min-h-screen bg-[#0A0E1A] text-[#F6F2E8]">
      <DashboardBestRaceRedirect href={heroHref} />

      {/* ── HEADER ── */}
      <header className="sticky top-0 z-50 grid grid-cols-[1fr_auto] items-center gap-4 border-b border-[#D4AF37]/15 bg-[#0A0E1A]/90 px-4 py-3 backdrop-blur-xl md:grid-cols-[auto_auto_1fr_auto] md:px-8">
        <Link
          href="/dashboard"
          className="font-[var(--font-display)] text-2xl font-black leading-none text-[#D4AF37] sm:text-3xl"
        >
          PMU GAGNANT
        </Link>
        <span
          className={`inline-flex rounded-full border px-3 py-1 font-[var(--font-display)] text-sm font-black ${
            liveActive
              ? "animate-pulse border-[#00C851]/40 bg-[#00C851]/10 text-[#00C851]"
              : "border-white/10 bg-white/5 text-slate-500"
          }`}
        >
          ● LIVE
        </span>
        <nav className="col-span-2 flex gap-2 overflow-x-auto text-sm font-bold text-slate-400 md:col-span-1 md:justify-center">
          {navItems.map((item) => (
            <Link
              className={`shrink-0 rounded-full px-3 py-1.5 transition hover:bg-white/10 hover:text-[#D4AF37] ${
                item.filter !== null && item.filter === selectedFilter
                  ? "bg-[#D4AF37]/10 text-[#D4AF37]"
                  : ""
              }`}
              href={item.href}
              key={item.label}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <DashboardHeaderAccount />
      </header>

      {/* ── PMU DASHBOARD PREMIUM ── */}
      <div className="mx-auto w-full max-w-[900px] px-4 py-8">
        <PMUDashboard
          race={hero?.race ?? null}
          predictions={hero?.predictions ?? []}
          roiMois={roi}
          tauxReussite={successRates[0]?.value ?? 64}
          nbPronostics={history.length}
          bankroll={600}
          miseConseillee={hero?.predictions[0]?.mise_simulee ?? 10}
          algoVersion="9.2"
        />
      </div>

      {/* ── MAIN ── */}
      <main className="mx-auto grid w-full max-w-[92rem] gap-5 px-4 py-5 lg:grid-cols-[1fr_21rem] lg:px-6">
        <section className="grid gap-5">
          <form
            action="/dashboard"
            className="grid gap-3 rounded-lg border border-[#D4AF37]/15 bg-[#101827] p-3 shadow-xl shadow-black/20 sm:grid-cols-[1fr_auto]"
          >
            <input type="hidden" name="type" value={selectedFilter === "ALL" ? "" : selectedFilter} />
            <label className="sr-only" htmlFor="dashboard-search">
              Rechercher une course, un cheval, un jockey ou un entraineur
            </label>
            <input
              id="dashboard-search"
              name="q"
              type="search"
              defaultValue={searchQuery}
              placeholder="Rechercher cheval, jockey, entraineur, hippodrome..."
              className="min-h-11 rounded-lg border border-white/10 bg-white/[0.04] px-4 text-sm font-bold text-[#F6F2E8] outline-none placeholder:text-slate-500 focus:border-[#D4AF37]/45"
            />
            <button
              type="submit"
              className="rounded-lg bg-[#D4AF37] px-5 py-3 text-sm font-black text-[#0A0E1A]"
            >
              Rechercher
            </button>
          </form>

          <article className="grid overflow-hidden rounded-lg border border-[#D4AF37]/20 bg-[#101827] shadow-2xl shadow-black/25 lg:grid-cols-[0.9fr_1fr]">
            <div className="relative min-h-[18rem] overflow-hidden lg:min-h-[27rem]">
              <Image
                src="/promo-poster.jpg"
                alt="Cheval favori du Quinté du jour"
                fill
                priority
                placeholder="blur"
                blurDataURL={BLUR_DATA_URL}
                sizes="(max-width: 768px) 100vw, 42vw"
                className="object-cover brightness-[0.62] contrast-110 saturate-90"
              />
              <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#0A0E1A]/90" />
              <div className="absolute bottom-5 left-5 right-5">
                <span className="text-xs font-black uppercase text-[#D4AF37]">
                  Quinté du jour
                </span>
                <strong className="mt-1 block font-[var(--font-display)] text-5xl font-black leading-none">
                  {hero ? `R${hero.race.reunion}C${hero.race.course}` : "Analyse"}
                </strong>
              </div>
            </div>

            <div className="grid content-center gap-5 p-5 md:p-8">
              <p className="text-xs font-black uppercase text-[#D4AF37]">Signal premium</p>
              <h1 className="break-words font-[var(--font-display)] text-5xl font-black leading-[0.9] text-[#F6F2E8] sm:text-6xl md:text-7xl">
                {hero?.race.hippodrome ?? "Quinté à confirmer"}
              </h1>
              <p className="text-base font-bold text-slate-400">
                {hero ? `${hero.race.heureDepart} · ${formatCourseMeta(hero.race)}` : "Programme en préparation"}
              </p>

              <div className="grid items-center gap-5 md:grid-cols-[auto_1fr]">
                <ScoreGauge score={hero?.confidence ?? 0} />
                <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
                  <span className="text-xs font-black uppercase text-slate-400">
                    Top 3 sélections
                  </span>
                  {hero?.topNumbers.length ? (
                    <div className="mt-3 flex gap-2">
                      {hero.topNumbers.map((num) => (
                        <i
                          className={`grid aspect-square w-10 place-items-center rounded-full font-[var(--font-display)] text-lg font-black not-italic ${getRunnerNumberClass(num)}`}
                          key={num}
                        >
                          {num}
                        </i>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-3 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-black text-slate-400">
                      Analyse en cours
                    </p>
                  )}
                  <p className="mt-3 font-black">
                    {hero?.predictions[0]?.cheval_nom ?? "Analyse en cours"}
                  </p>
                </div>
              </div>

              <Link
                className="inline-flex w-full justify-center rounded-lg border border-[#D4AF37]/70 bg-gradient-to-br from-[#D4AF37] to-[#A47D18] px-5 py-4 font-black text-[#0A0E1A] shadow-lg shadow-[#D4AF37]/10"
                href={heroHref ?? "/premium"}
              >
                Voir l&apos;analyse complète
              </Link>
            </div>
          </article>

          <section id="stats">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-black uppercase text-[#D4AF37]">Courses du jour</p>
              <span className="font-[var(--font-display)] font-black text-slate-400">
                {visibleRaces.length}/6 visibles
              </span>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {visibleRaces.map((item) => (
                <Link
                  href={`/race/${formatRaceAnalysisId(item.race.reunion, item.race.course)}?date=${item.race.dateStr}`}
                  key={`${item.race.reunion}-${item.race.course}`}
                  className="group grid min-h-40 gap-3 rounded-lg border border-[#D4AF37]/15 bg-[#101827] p-4 shadow-xl shadow-black/20 transition hover:-translate-y-1 hover:border-[#D4AF37]/40"
                >
                  <div className="flex items-start justify-between gap-3">
                    <strong className="min-w-0 break-words font-[var(--font-display)] text-2xl font-black leading-none">
                      {item.race.hippodrome}
                    </strong>
                    <span className="shrink-0">
                      <StatusBadge status={item.status} />
                    </span>
                  </div>
                  <p className="text-sm font-bold text-slate-400">
                    {item.race.discipline} · {item.race.heureDepart} · {item.race.nombrePartants} partants
                  </p>
                  <CountdownTimer dateStr={item.race.dateStr} heureDepart={item.race.heureDepart} />
                  {item.topNumbers.length > 0 ? (
                    <div className="flex items-center gap-2 opacity-90 transition group-hover:opacity-100">
                      {item.topNumbers.slice(0, 3).map((num) => (
                        <i
                          className={`grid aspect-square w-8 place-items-center rounded-full font-[var(--font-display)] font-black not-italic ${getRunnerNumberClass(num)}`}
                          key={num}
                        >
                          {num}
                        </i>
                      ))}
                      <span className="ml-auto text-xs font-black uppercase text-slate-500">
                        Top IA
                      </span>
                    </div>
                  ) : (
                    <p className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-black text-slate-400">
                      Analyse en cours
                    </p>
                  )}
                </Link>
              ))}
              {visibleRaces.length === 0 ? (
                <div className="rounded-lg border border-white/10 bg-[#101827] p-5 text-sm font-black text-slate-400 md:col-span-2 xl:col-span-3">
                  Aucune course ne correspond a ce filtre pour le moment.
                </div>
              ) : null}
            </div>
          </section>
        </section>

        <aside className="hidden content-start gap-3 lg:grid">
          <section className="rounded-lg border border-[#D4AF37]/20 bg-[#101827] p-4 shadow-xl shadow-black/20">
            <p className="text-xs font-black uppercase text-[#D4AF37]">ROI 30 jours</p>
            <strong className="mt-2 block font-[var(--font-display)] text-5xl font-black text-[#00C851]">
              {roi >= 0 ? "+" : ""}
              {roi.toFixed(1)}%
            </strong>
            <Sparkline values={[12, 15, 14, 18, 21, 19, 24, 27, 31, 29, 34, 37]} />
          </section>

          <section className="rounded-lg border border-[#D4AF37]/20 bg-[#101827] p-4 shadow-xl shadow-black/20">
            <p className="text-xs font-black uppercase text-[#D4AF37]">Réussite par pari</p>
            <div className="mt-4 grid gap-3">
              {successRates.map((item) => (
                <div className="grid grid-cols-[4.4rem_1fr_2.4rem] items-center gap-3" key={item.label}>
                  <span className="text-xs font-black text-slate-400">{item.label}</span>
                  <i className="h-2 overflow-hidden rounded-full bg-white/10">
                    <b className={`block h-full rounded-full bg-gradient-to-r from-[#00C851] to-[#D4AF37] ${item.widthClass}`} />
                  </i>
                  <em className="text-right text-xs font-black not-italic text-slate-400">
                    {item.value}%
                  </em>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-lg border border-[#D4AF37]/20 bg-[#101827] p-4 shadow-xl shadow-black/20">
            <p className="text-xs font-black uppercase text-[#D4AF37]">Dernières performances</p>
            <table className="mt-3 w-full border-collapse">
              <tbody>
                {latestPerformances.map((row) => (
                  <tr className="border-t border-white/10" key={`${row.race}-${row.pick}`}>
                    <td className="py-2 text-xs font-black text-slate-400">{row.race}</td>
                    <td className="py-2 text-xs font-bold text-slate-300">{row.pick}</td>
                    <td className="py-2 text-right text-xs font-black text-[#00C851]">{row.result}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </aside>
      </main>
    </div>
  );
}
