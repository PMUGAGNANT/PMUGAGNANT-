import type { Metadata } from "next";
import Link from "next/link";
import { unstable_cache } from "next/cache";
import DashboardHeaderAccount from "@/components/dashboard/DashboardHeaderAccount";
import { ThemeSwitchButton } from "@/components/ui/ThemeSwitchButton";
import {
  formatRaceAnalysisId,
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
import type { PredictionRow, RaceSummary, RunnerOutcomeRow } from "@/lib/types";

export const metadata: Metadata = {
  title: "Dashboard VMAX - TurfEdge",
  description:
    "Dashboard premium TurfEdge : Quinte du jour, courses pretes, value bets et statistiques live.",
};

export const revalidate = 120;

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

type SettledSelection = PerformanceRow & {
  date: string;
  stake: number;
  gain: number;
  won: boolean;
  betType: string;
};

type SuccessRateRow = {
  label: string;
  value: number | null;
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

function getSelectionPriority(row: PredictionRow) {
  if (row.decision === "VALIDE") return 3;
  if (row.decision === "SURVEILLANCE") return 2;
  return 1;
}

function getSelectionScore(row: PredictionRow) {
  return row.score_blended ?? row.score_cheval ?? row.score_final_pari ?? 0;
}

function getRaceConfidence(predictions: PredictionRow[]) {
  const best = predictions[0];
  if (!best) return 0;
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

function getRaceKey(row: Pick<PredictionRow | RunnerOutcomeRow, "date" | "reunion" | "course">) {
  return `${row.date}-${row.reunion}-${row.course}`;
}

function getRunnerKey(row: Pick<PredictionRow | RunnerOutcomeRow, "date" | "reunion" | "course" | "cheval_num">) {
  return `${getRaceKey(row)}-${row.cheval_num}`;
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
    return placeReport !== null ? stake * placeReport : null;
  }
  if (!outcome.resultat_gagnant) return 0;
  const winReport = outcome.rapport_gagnant ?? row.rapport_gagnant ?? null;
  return winReport !== null ? stake * winReport : null;
}

function formatPerformanceEuro(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(0)} EUR`;
}

function buildSettledSelections(
  predictions: PredictionRow[],
  outcomes: RunnerOutcomeRow[]
) {
  const outcomesByRunner = new Map(
    outcomes.map((outcome) => [getRunnerKey(outcome), outcome] as const)
  );
  return getSelectedPredictions(predictions).flatMap((row): SettledSelection[] => {
    const outcome = outcomesByRunner.get(getRunnerKey(row));
    if (!outcome || outcome.non_partant) return [];
    const gain = getRealGain(row, outcome);
    if (gain === null) return [];
    const stake = row.mise_simulee ?? 0;
    const betType = row.pari_conseille ?? "AUTRE";
    const won = betType === "PLACE" ? outcome.resultat_place : outcome.resultat_gagnant;
    return [
      {
        date: row.date,
        race: `R${row.reunion}C${row.course}`,
        pick: row.cheval_nom,
        result: formatPerformanceEuro(gain - stake),
        stake,
        gain,
        won,
        betType,
      },
    ];
  });
}

function getRoiFromSettledSelections(settled: SettledSelection[]) {
  const stake = settled.reduce((sum, row) => sum + row.stake, 0);
  const gain = settled.reduce((sum, row) => sum + row.gain, 0);
  if (stake <= 0) return null;
  return ((gain - stake) / stake) * 100;
}

function getHitRateFromSettledSelections(settled: SettledSelection[]) {
  if (settled.length === 0) return null;
  return (settled.filter((row) => row.won).length / settled.length) * 100;
}

function getSuccessRates(settled: SettledSelection[]): SuccessRateRow[] {
  return ["GAGNANT", "PLACE"].map((betType) => {
    const scoped = settled.filter((row) => row.betType === betType);
    return {
      label: betType === "GAGNANT" ? "Gagnant" : "Place",
      value: getHitRateFromSettledSelections(scoped),
    };
  });
}

function getSparklineValues(settled: SettledSelection[]) {
  const sorted = [...settled].sort((left, right) => left.date.localeCompare(right.date));
  let cumulativeProfit = 0;
  return sorted.map((row) => {
    cumulativeProfit += row.gain - row.stake;
    return cumulativeProfit;
  });
}

function formatSignedPercent(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "--";
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function formatRate(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "--";
  return `${Math.round(value)}%`;
}

function getStatusLabel(status: VmaxRaceStatus) {
  if (status === "live") return "En cours";
  if (status === "finished") return "Termine";
  return "A venir";
}

function getHeroVerdict(hero: DashboardRace | null) {
  const best = hero?.predictions.find((prediction) => prediction.decision !== "REJET");
  if (!best) return "SURVEILLER";
  if (best.decision === "VALIDE") return "JOUER";
  if (best.decision === "SURVEILLANCE") return "SURVEILLER";
  return "PASSER";
}

function getVerdictClass(verdict: string) {
  if (verdict === "JOUER") return "is-play";
  if (verdict === "SURVEILLER") return "is-watch";
  return "is-pass";
}

function getCompactBubbleClass(index: number) {
  if (index === 0) return "is-gold";
  if (index === 1) return "is-blue";
  return "is-muted";
}

const EMPTY_RACES_MESSAGE =
  "Aucune course disponible pour aujourd'hui. Les pronostics du prochain Quinte seront disponibles demain matin.";

const DASHBOARD_CSS = `
@import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500;700&family=Cormorant+Garamond:wght@600;700&display=swap');
.dash{--gold:#D4AF37;--green:#00C851;--orange:#FF9F1C;--red:#FF4D5A;--blue:#4DC8FF;--muted:rgba(255,255,255,0.35);--bg:#080A12;--panel:#10131F;--panel2:#151928;--line:rgba(255,255,255,0.12);min-height:100vh;background:var(--bg);color:#fff;font-family:"DM Mono",monospace}
[data-theme="cream"] .dash{--gold:#A9832E;--green:#075E36;--orange:#B77D22;--red:#C4543D;--blue:#075E36;--muted:#536157;--bg:#FAF7EF;--panel:#FFFDF8;--panel2:#F6F0E4;--line:rgba(20,45,29,.14);background:var(--bg);color:#172118}
.dash-nav{position:sticky;top:0;z-index:50;display:grid;grid-template-columns:auto auto 1fr auto;align-items:center;gap:18px;border-bottom:1px solid rgba(212,175,55,.18);background:rgba(8,10,18,.92);padding:14px 32px;backdrop-filter:blur(16px)}
.dash-logo{font-family:"Cormorant Garamond",serif;font-size:28px;font-weight:700;color:var(--gold);text-decoration:none;letter-spacing:.08em}
.dash-live{display:inline-flex;align-items:center;border:1px solid rgba(0,200,81,.45);border-radius:999px;background:rgba(0,200,81,.12);color:var(--green);padding:5px 12px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.12em}
.dash-links{display:flex;justify-content:center;gap:8px}
.dash-links a{border-radius:8px;color:rgba(255,255,255,.72);font-size:12px;font-weight:700;letter-spacing:.08em;padding:9px 12px;text-decoration:none;text-transform:uppercase}
.dash-links a:hover{background:rgba(255,255,255,.08);color:var(--gold)}
.dash-burger{display:none;border:1px solid var(--line);border-radius:8px;background:rgba(255,255,255,.06);color:#fff;font-size:18px;padding:8px 11px}
.dash-actions{display:flex;align-items:center;justify-content:flex-end;gap:10px}
.dash-shell{display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:24px;max-width:1480px;margin:0 auto;padding:24px}
.dash-main{display:grid;gap:22px}
.dash-hero{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:24px;min-height:360px;border:1px solid rgba(212,175,55,.35);border-radius:8px;background:radial-gradient(circle at 82% 18%,rgba(212,175,55,.24),transparent 28%),linear-gradient(135deg,#080A12 0%,#111827 58%,#080A12 100%);padding:34px;box-shadow:0 24px 60px rgba(0,0,0,.34)}
.dash-kicker,.dash-label{color:var(--gold);font-size:11px;font-weight:700;letter-spacing:.18em;text-transform:uppercase}
.dash-course-name{max-width:900px;font-family:"Cormorant Garamond",serif;font-size:48px;font-weight:700;line-height:.95;margin:14px 0 12px}
.dash-meta{color:rgba(255,255,255,.7);font-size:13px}
.dash-selection{display:flex;flex-wrap:wrap;gap:14px;margin-top:28px}
.dash-bubble{display:grid;place-items:center;width:72px;height:72px;border-radius:50%;border:1px solid rgba(212,175,55,.45);background:rgba(212,175,55,.14);color:var(--gold);font-family:"Cormorant Garamond",serif;font-size:34px;font-weight:700}
.dash-hero-side{display:grid;align-content:center;gap:16px;min-width:220px}
.dash-verdict{font-family:"Cormorant Garamond",serif;font-size:46px;font-weight:700;line-height:1}
.dash-verdict.is-play{color:var(--green)}.dash-verdict.is-watch{color:var(--orange)}.dash-verdict.is-pass{color:var(--red)}
.dash-stake{font-size:13px;color:rgba(255,255,255,.72)}
.dash-stake strong{display:block;color:#fff;font-family:"Cormorant Garamond",serif;font-size:34px;line-height:1.1}
.dash-cta{display:inline-flex;align-items:center;justify-content:center;border-radius:8px;background:var(--gold);color:#080A12;font-size:12px;font-weight:700;letter-spacing:.08em;padding:13px 18px;text-decoration:none;text-transform:uppercase}
.dash-section-head{display:flex;align-items:end;justify-content:space-between;gap:16px}
.dash-title{font-family:"Cormorant Garamond",serif;font-size:34px;font-weight:700;line-height:1}
.dash-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}
.dash-card{display:grid;gap:14px;border:1px solid var(--line);border-radius:8px;background:var(--panel);padding:16px;text-decoration:none;color:#fff;transition:transform .15s,border-color .15s}
.dash-card:hover{transform:translateY(-2px);border-color:rgba(212,175,55,.45)}
.dash-card-title{font-family:"Cormorant Garamond",serif;font-size:26px;font-weight:700;line-height:1}
.dash-card-meta{color:rgba(255,255,255,.62);font-size:12px}
.dash-card-row{display:flex;align-items:center;justify-content:space-between;gap:12px}
.dash-mini-bubbles{display:flex;gap:7px}
.dash-mini{display:grid;place-items:center;width:32px;height:32px;border-radius:50%;font-family:"Cormorant Garamond",serif;font-size:18px;font-weight:700}
.dash-mini.is-gold{background:rgba(212,175,55,.18);border:1px solid rgba(212,175,55,.55);color:var(--gold)}
.dash-mini.is-blue{background:rgba(77,200,255,.12);border:1px solid rgba(77,200,255,.45);color:var(--blue)}
.dash-mini.is-muted{background:rgba(255,255,255,.06);border:1px solid var(--line);color:var(--muted)}
.dash-status{border:1px solid rgba(77,200,255,.35);border-radius:999px;color:var(--blue);font-size:10px;font-weight:700;letter-spacing:.12em;padding:5px 8px;text-transform:uppercase;white-space:nowrap}
.dash-status.live{border-color:rgba(0,200,81,.45);color:var(--green)}.dash-status.finished{border-color:rgba(255,255,255,.18);color:var(--muted)}
.dash-empty{border:1px solid var(--line);border-radius:8px;background:var(--panel);color:rgba(255,255,255,.74);font-size:14px;line-height:1.6;padding:20px}
.dash-side{display:grid;align-content:start;gap:14px}
.dash-stat{border:1px solid var(--line);border-radius:8px;background:var(--panel);padding:18px}
.dash-stat-value{display:block;font-family:"DM Mono",monospace;font-size:38px;font-weight:700;margin-top:10px}
.dash-stat-value.pos{color:var(--green)}.dash-stat-value.neg{color:var(--red)}.dash-stat-value.neutral{color:var(--muted)}
.dash-perf{width:100%;border-collapse:collapse;margin-top:10px}
.dash-perf td{border-top:1px solid var(--line);font-size:11px;padding:10px 0;vertical-align:top}
.dash-perf .gain{color:var(--green);font-weight:700;text-align:right}
[data-theme="cream"] .dash-nav{border-bottom-color:rgba(20,45,29,.10);background:rgba(255,253,248,.94)}
[data-theme="cream"] .dash-links a{color:#536157}
[data-theme="cream"] .dash-links a:hover{background:rgba(7,94,54,.08);color:#075E36}
[data-theme="cream"] .dash-burger{background:#FFFDF8;color:#172118}
[data-theme="cream"] .dash-hero{border-color:rgba(7,94,54,.16);background:radial-gradient(circle at 82% 18%,rgba(7,94,54,.12),transparent 28%),linear-gradient(135deg,#FFFDF8 0%,#F6F0E4 100%);box-shadow:0 24px 60px rgba(22,38,26,.10)}
[data-theme="cream"] .dash-meta,[data-theme="cream"] .dash-stake,[data-theme="cream"] .dash-card-meta,[data-theme="cream"] .dash-empty{color:#536157}
[data-theme="cream"] .dash-stake strong,[data-theme="cream"] .dash-card,[data-theme="cream"] .dash-course-name,[data-theme="cream"] .dash-title{color:#172118}
[data-theme="cream"] .dash-card,[data-theme="cream"] .dash-empty,[data-theme="cream"] .dash-stat{background:var(--panel);box-shadow:0 18px 46px rgba(22,38,26,.08)}
[data-theme="cream"] .dash-live{border-color:rgba(7,94,54,.24);background:rgba(7,94,54,.10)}
[data-theme="cream"] .dash-bubble,[data-theme="cream"] .dash-mini.is-gold,[data-theme="cream"] .dash-mini.is-blue{background:rgba(7,94,54,.08);border-color:rgba(7,94,54,.22);color:#075E36}
[data-theme="cream"] .dash-mini.is-muted{background:rgba(20,45,29,.06);border-color:var(--line);color:#536157}
[data-theme="cream"] .dash-status.finished{border-color:rgba(20,45,29,.14);color:#536157}
[data-theme="cream"] .dash-cta{background:#075E36;color:#FFFDF8;border:1px solid rgba(7,94,54,.24)}
@media(max-width:768px){.dash-nav{grid-template-columns:auto auto 1fr;padding:12px 16px}.dash-logo{font-size:23px}.dash-links{display:none}.dash-burger{display:inline-flex}.dash-actions{grid-column:1 / -1;justify-content:space-between}.dash-shell{grid-template-columns:1fr;padding:16px}.dash-hero{grid-template-columns:1fr;padding:16px}.dash-course-name{font-size:28px}.dash-bubble{width:52px;height:52px;font-size:26px}.dash-grid{grid-template-columns:1fr}.dash-side{grid-row:auto}.dash-hero-side{min-width:0}}
`;

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

const getCachedParticipants = unstable_cache(
  async (date: string, reunion: number, course: number) => {
    return getParticipants(date, reunion, course).catch(() => []);
  },
  ["participants"],
  { revalidate: 300 }
);

async function loadRaceSearchText(date: string, races: RaceSummary[]) {
  const searchableRaces = races.slice(0, 8);
  const entries = await Promise.allSettled(
    searchableRaces.map(async (race) => {
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
  { revalidate: 120 }
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
  const heroKey = hero ? getRaceKeyFromSummary(hero.race) : null;
  const visibleRaces = filteredRaces
    .filter((item) => getRaceKeyFromSummary(item.race) !== heroKey)
    .slice(0, 9);
  const liveActive = races.some((item) => item.status === "live");
  const heroHref = hero
    ? `/race/${formatRaceAnalysisId(hero.race.reunion, hero.race.course)}?date=${hero.race.dateStr}`
    : null;
  const settled = buildSettledSelections(history, outcomes);
  const roi = getRoiFromSettledSelections(settled);
  const hitRate = getHitRateFromSettledSelections(settled);
  const latestPerformances: PerformanceRow[] = settled.slice(-5).reverse();
  const successRates = getSuccessRates(settled);
  const sparklineValues = getSparklineValues(settled);
  const recommendedStake =
    hero?.predictions.find((prediction) => (prediction.mise_simulee ?? 0) > 0)?.mise_simulee ??
    null;
  const heroVerdict = getHeroVerdict(hero);
  const navItems = [
    { label: "Dashboard", href: "/dashboard" },
    { label: "Value Bets", href: "/value-bets" },
    { label: "Stats", href: "/stats" },
    { label: "Mon compte", href: "/mes-paris" },
  ];

  return (
    <div className="dash">
      <style>{DASHBOARD_CSS}</style>
      <header className="dash-nav">
        <Link href="/dashboard" className="dash-logo">TURFEDGE</Link>
        <span className="dash-live">{liveActive ? "LIVE" : "LIVE"}</span>
        <nav className="dash-links" aria-label="Navigation principale">
          {navItems.map((item) => (
            <Link href={item.href} key={item.label}>{item.label}</Link>
          ))}
        </nav>
        <button className="dash-burger" type="button" aria-label="Menu">{"\u2630"}</button>
        <div className="dash-actions">
          <ThemeSwitchButton className="theme-switch-button--dash" />
          <DashboardHeaderAccount />
        </div>
      </header>

      <main className="dash-shell">
        <section className="dash-main">
          {hero ? (
            <section className="dash-hero">
              <div>
                <p className="dash-kicker">Analyse IA du jour</p>
                <h1 className="dash-course-name">{hero.race.nomCourse}</h1>
                <p className="dash-meta">
                  {hero.race.hippodrome} - {hero.race.discipline} - {hero.race.heureDepart}
                </p>
                <div className="dash-selection" aria-label="Selections IA">
                  {hero.topNumbers.slice(0, 3).map((num) => (
                    <span className="dash-bubble" key={num}>{num}</span>
                  ))}
                </div>
              </div>
              <div className="dash-hero-side">
                <div>
                  <p className="dash-label">Verdict</p>
                  <strong className={`dash-verdict ${getVerdictClass(heroVerdict)}`}>{heroVerdict}</strong>
                </div>
                <p className="dash-stake">
                  Mise conseillee
                  <strong>{recommendedStake !== null ? `${recommendedStake} EUR` : "--"}</strong>
                </p>
                {heroHref ? (
                  <Link className="dash-cta" href={heroHref}>Voir l&apos;analyse complete</Link>
                ) : null}
              </div>
            </section>
          ) : (
            <section className="dash-empty">{EMPTY_RACES_MESSAGE}</section>
          )}

          <section>
            <div className="dash-section-head">
              <h2 className="dash-title">Autres courses du jour</h2>
              <p className="dash-label">{visibleRaces.length} courses</p>
            </div>
            {visibleRaces.length > 0 ? (
              <div className="dash-grid">
                {visibleRaces.map((item) => (
                  <Link
                    href={`/race/${formatRaceAnalysisId(item.race.reunion, item.race.course)}?date=${item.race.dateStr}`}
                    key={`${item.race.reunion}-${item.race.course}`}
                    className="dash-card"
                  >
                    <div className="dash-card-row">
                      <strong className="dash-card-title">{item.race.hippodrome}</strong>
                      <span className={`dash-status ${item.status}`}>{getStatusLabel(item.status)}</span>
                    </div>
                    <p className="dash-card-meta">
                      {item.race.discipline} - {item.race.heureDepart} - {item.race.nombrePartants} partants
                    </p>
                    <div className="dash-card-row">
                      <div className="dash-mini-bubbles">
                        {item.topNumbers.slice(0, 3).map((num, index) => (
                          <span className={`dash-mini ${getCompactBubbleClass(index)}`} key={num}>{num}</span>
                        ))}
                      </div>
                      <span className="dash-label">Top IA</span>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="dash-empty">{EMPTY_RACES_MESSAGE}</div>
            )}
          </section>
        </section>

        <aside className="dash-side">
          <section className="dash-stat">
            <p className="dash-label">ROI 30 jours</p>
            <strong className={`dash-stat-value ${roi === null ? "neutral" : roi >= 0 ? "pos" : "neg"}`}>
              {formatSignedPercent(roi)}
            </strong>
            {sparklineValues.length > 0 ? <Sparkline values={sparklineValues} /> : null}
          </section>
          <section className="dash-stat">
            <p className="dash-label">Taux de reussite</p>
            <strong className="dash-stat-value pos">{formatRate(hitRate)}</strong>
            {successRates.map((item) => (
              <p className="dash-card-meta" key={item.label}>{item.label} - {formatRate(item.value)}</p>
            ))}
          </section>
          <section className="dash-stat">
            <p className="dash-label">Dernieres performances</p>
            <table className="dash-perf">
              <tbody>
                {latestPerformances.map((row) => (
                  <tr key={`${row.race}-${row.pick}`}>
                    <td>{row.race}</td>
                    <td>{row.pick}</td>
                    <td className="gain">{row.result}</td>
                  </tr>
                ))}
                {latestPerformances.length === 0 ? (
                  <tr><td colSpan={3}>{EMPTY_RACES_MESSAGE}</td></tr>
                ) : null}
              </tbody>
            </table>
          </section>
        </aside>
      </main>
    </div>
  );
}
