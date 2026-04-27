import type { Metadata } from "next";
import Link from "next/link";
import { unstable_cache } from "next/cache";
import { DashboardHeroQuickRead } from "@/features/dashboard/components/DashboardHeroQuickRead";
import { DashboardRaceCard } from "@/features/dashboard/components/DashboardRaceCard";
import { ProductHeaderNav } from "@/features/layout/components/ProductHeaderNav";
import {
  buildDashboardHeroModel,
  buildDashboardRaces,
  getHeroRace,
  getRaceKeyFromSummary,
  getSingleSearchParam,
  matchesDashboardFilter,
  matchesDashboardSearch,
  normalizeDashboardFilter,
  type DashboardPageProps,
} from "@/features/dashboard/lib/dashboard-page-model";
import { formatRaceAnalysisId } from "@/features/vmax/vmax-model";
import { getTodayDateStr } from "@/lib/date-utils";
import { getAllRaces, getParticipants, isEligiblePmuFranceRace } from "@/lib/pmu-api";
import {
  listPredictionsBetween,
  listPredictionsByDate,
  listRunnerOutcomesBetween,
} from "@/lib/prediction-store";
import type { PredictionRow, RaceSummary, RunnerOutcomeRow } from "@/lib/types";

export const metadata: Metadata = {
  title: "Dashboard VMAX - PMU Gagnant",
  description:
    "Dashboard premium PMU Gagnant : Quinte du jour, courses pretes, value bets et statistiques live.",
};

export const revalidate = 120;

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

const EMPTY_RACES_MESSAGE =
  "Aucune course disponible pour aujourd'hui. Les pronostics du prochain Quinté seront disponibles demain matin.";

const DASHBOARD_CSS = `
@import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500;700&family=Cormorant+Garamond:wght@600;700&display=swap');
.dash{--gold:#D4AF37;--green:#00C851;--orange:#FF9F1C;--red:#FF4D5A;--blue:#4DC8FF;--muted:rgba(255,255,255,0.35);--bg:#080A12;--panel:#10131F;--panel2:#151928;--line:rgba(255,255,255,0.12);min-height:100vh;background:var(--bg);color:#fff;font-family:"DM Mono",monospace}
.dash-shell{display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:24px;max-width:1480px;margin:0 auto;padding:24px}.dash-main{display:grid;gap:22px}
.dash-hero{display:grid;gap:20px;min-height:360px;border:1px solid rgba(212,175,55,.35);border-radius:8px;background:radial-gradient(circle at 82% 18%,rgba(212,175,55,.24),transparent 28%),linear-gradient(135deg,#080A12 0%,#111827 58%,#080A12 100%);padding:34px;box-shadow:0 24px 60px rgba(0,0,0,.34)}
.dash-hero-top{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(280px,.8fr);gap:24px;align-items:start}
.dash-kicker,.dash-label{color:var(--gold);font-size:11px;font-weight:700;letter-spacing:.18em;text-transform:uppercase}
.dash-course-name{max-width:900px;font-family:"Cormorant Garamond",serif;font-size:48px;font-weight:700;line-height:.95;margin:14px 0 12px}
.dash-meta{color:rgba(255,255,255,.7);font-size:13px}.dash-subtext{max-width:760px;color:rgba(255,255,255,.62);font-size:13px;line-height:1.6;margin-top:14px}
.dash-selection{display:flex;flex-wrap:wrap;gap:14px;margin-top:28px}.dash-bubble-card{display:grid;justify-items:center;gap:8px}.dash-bubble{display:grid;place-items:center;width:72px;height:72px;border-radius:50%;border:1px solid rgba(212,175,55,.45);background:rgba(212,175,55,.14);color:var(--gold);font-family:"Cormorant Garamond",serif;font-size:34px;font-weight:700}.dash-bubble-name{max-width:90px;text-align:center;font-size:11px;font-weight:700;line-height:1.3;color:#fff}
.dash-hero-side{display:grid;gap:14px}.dash-hero-panel{border:1px solid rgba(255,255,255,.08);border-radius:8px;background:rgba(255,255,255,.03);padding:16px}.dash-verdict{font-family:"Cormorant Garamond",serif;font-size:46px;font-weight:700;line-height:1}.dash-verdict.is-play{color:var(--green)}.dash-verdict.is-watch{color:var(--orange)}.dash-verdict.is-pass{color:var(--red)}.dash-panel-meta{margin-top:6px;color:rgba(255,255,255,.58);font-size:12px}.dash-stake{font-size:13px;color:rgba(255,255,255,.72)}.dash-stake strong{display:block;color:#fff;font-family:"Cormorant Garamond",serif;font-size:34px;line-height:1.1}.dash-confidence{display:grid;gap:6px}.dash-confidence strong{font-size:32px;color:#fff}.dash-confidence span{color:rgba(255,255,255,.58);font-size:12px}
.dash-cta{display:inline-flex;align-items:center;justify-content:center;border-radius:8px;background:var(--gold);color:#080A12;font-size:12px;font-weight:700;letter-spacing:.08em;padding:13px 18px;text-decoration:none;text-transform:uppercase}
.dash-read{display:grid;gap:18px}.dash-read-head{display:flex;align-items:flex-start;justify-content:space-between;gap:18px}.dash-read-title{margin-top:6px;font-family:"Cormorant Garamond",serif;font-size:30px;font-weight:700;line-height:.95;color:#fff}.dash-read-confidence{display:inline-flex;align-items:center;justify-content:center;border:1px solid rgba(255,255,255,.08);border-radius:999px;background:rgba(255,255,255,.04);padding:10px 14px}.dash-read-confidence strong{font-size:12px;color:rgba(255,255,255,.72);letter-spacing:.12em;text-transform:uppercase}.dash-read-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}.dash-read-card{border:1px solid rgba(255,255,255,.08);border-radius:8px;padding:16px;background:rgba(255,255,255,.03)}.dash-read-card.base{border-color:rgba(0,200,81,.2);background:linear-gradient(180deg,rgba(0,200,81,.08),rgba(255,255,255,.02))}.dash-read-card.outsider{border-color:rgba(212,175,55,.22);background:linear-gradient(180deg,rgba(212,175,55,.1),rgba(255,255,255,.02))}.dash-read-card.reject{border-color:rgba(255,77,90,.18);background:linear-gradient(180deg,rgba(255,77,90,.08),rgba(255,255,255,.02))}.dash-read-label{color:#fff;font-size:13px;font-weight:700}.dash-read-list{display:grid;gap:12px;margin-top:14px}.dash-read-item{display:grid;gap:4px}.dash-read-top{display:flex;align-items:center;justify-content:space-between}.dash-read-num{display:inline-flex;align-items:center;justify-content:center;min-width:42px;border-radius:999px;padding:5px 10px;font-size:11px;font-weight:700;letter-spacing:.08em}.dash-read-num.base{background:rgba(0,200,81,.12);color:var(--green)}.dash-read-num.outsider{background:rgba(212,175,55,.15);color:var(--gold)}.dash-read-num.reject{background:rgba(255,77,90,.12);color:var(--red)}.dash-read-horse{font-family:"Cormorant Garamond",serif;font-size:23px;font-weight:700;line-height:.95;color:#fff}.dash-read-note,.dash-read-empty{color:rgba(255,255,255,.58);font-size:12px;line-height:1.5}
.dash-section-head{display:flex;align-items:end;justify-content:space-between;gap:16px}.dash-title{font-family:"Cormorant Garamond",serif;font-size:34px;font-weight:700;line-height:1}.dash-title-sub{color:rgba(255,255,255,.58);font-size:13px;line-height:1.6}
.dash-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}.dash-card{display:grid;gap:14px;border:1px solid var(--line);border-radius:8px;background:var(--panel);padding:16px;text-decoration:none;color:#fff;transition:transform .15s,border-color .15s}.dash-card:hover{transform:translateY(-2px);border-color:rgba(212,175,55,.45)}.dash-card-title{font-family:"Cormorant Garamond",serif;font-size:26px;font-weight:700;line-height:1}.dash-card-meta{color:rgba(255,255,255,.62);font-size:12px}.dash-card-row{display:flex;align-items:center;justify-content:space-between;gap:12px}.dash-mini-bubbles{display:flex;gap:7px}.dash-mini{display:grid;place-items:center;width:32px;height:32px;border-radius:50%;font-family:"Cormorant Garamond",serif;font-size:18px;font-weight:700}.dash-mini.is-gold{background:rgba(212,175,55,.18);border:1px solid rgba(212,175,55,.55);color:var(--gold)}.dash-mini.is-blue{background:rgba(77,200,255,.12);border:1px solid rgba(77,200,255,.45);color:var(--blue)}.dash-mini.is-muted{background:rgba(255,255,255,.06);border:1px solid var(--line);color:var(--muted)}.dash-card-confidence{color:rgba(255,255,255,.58);font-size:11px}.dash-status{border:1px solid rgba(77,200,255,.35);border-radius:999px;color:var(--blue);font-size:10px;font-weight:700;letter-spacing:.12em;padding:5px 8px;text-transform:uppercase;white-space:nowrap}.dash-status.live{border-color:rgba(0,200,81,.45);color:var(--green)}.dash-status.finished{border-color:rgba(255,255,255,.18);color:var(--muted)}
.dash-empty{border:1px solid var(--line);border-radius:8px;background:var(--panel);color:rgba(255,255,255,.74);font-size:14px;line-height:1.6;padding:20px}.dash-side{display:grid;align-content:start;gap:14px}.dash-stat{border:1px solid var(--line);border-radius:8px;background:var(--panel);padding:18px}.dash-stat-value{display:block;font-family:"DM Mono",monospace;font-size:38px;font-weight:700;margin-top:10px}.dash-stat-value.pos{color:var(--green)}.dash-stat-value.neg{color:var(--red)}.dash-stat-value.neutral{color:var(--muted)}.dash-perf{width:100%;border-collapse:collapse;margin-top:10px}.dash-perf td{border-top:1px solid var(--line);font-size:11px;padding:10px 0;vertical-align:top}.dash-perf .gain{color:var(--green);font-weight:700;text-align:right}
@media(max-width:768px){.dash-shell{grid-template-columns:1fr;padding:16px}.dash-hero{padding:16px}.dash-hero-top{grid-template-columns:1fr}.dash-course-name{font-size:28px}.dash-bubble{width:52px;height:52px;font-size:26px}.dash-grid,.dash-read-grid{grid-template-columns:1fr}.dash-side{grid-row:auto}.dash-hero-side{min-width:0}.dash-read-title{font-size:24px}.dash-read-head{display:grid}}
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
  const heroModel = buildDashboardHeroModel(hero);
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

  return (
    <div className="dash">
      <style>{DASHBOARD_CSS}</style>
      <ProductHeaderNav statusLabel={liveActive ? "LIVE" : "A VEILLE"} />

      <main className="dash-shell">
        <section className="dash-main">
          {hero && heroModel ? (
            <section className="dash-hero">
              <div className="dash-hero-top">
                <div>
                  <p className="dash-kicker">Course a traiter en priorite</p>
                  <h1 className="dash-course-name">{hero.race.nomCourse}</h1>
                  <p className="dash-meta">
                    {hero.race.hippodrome} · {hero.race.discipline} · {hero.race.heureDepart} · {hero.race.nombrePartants} partants
                  </p>
                  <p className="dash-subtext">
                    On met d&apos;abord en avant la course la plus lisible du jour pour reduire le bruit et montrer vite quoi jouer, quoi surveiller et quoi eliminer.
                  </p>
                  <div className="dash-selection" aria-label="Bases IA prioritaires">
                    {heroModel.bases.map((item) => (
                      <div className="dash-bubble-card" key={item.numero}>
                        <span className="dash-bubble">{item.numero}</span>
                        <span className="dash-bubble-name">{item.cheval}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="dash-hero-side">
                  <div className="dash-hero-panel">
                    <p className="dash-label">Verdict course</p>
                    <strong className={`dash-verdict ${heroModel.verdictClass}`}>{heroModel.verdict}</strong>
                    <p className="dash-panel-meta">{hero.confidence}% de confiance · {heroModel.confidenceLabel}</p>
                  </div>
                  <div className="dash-hero-panel dash-stake">
                    Mise conseillee
                    <strong>{heroModel.stake !== null ? `${heroModel.stake} EUR` : "--"}</strong>
                  </div>
                  <div className="dash-hero-panel dash-confidence">
                    <span>Action rapide</span>
                    <strong>Analyser puis jouer</strong>
                    {heroHref ? (
                      <Link className="dash-cta" href={heroHref}>Voir l&apos;analyse complete</Link>
                    ) : null}
                  </div>
                </div>
              </div>

              <DashboardHeroQuickRead model={heroModel} />
            </section>
          ) : (
            <section className="dash-empty">{EMPTY_RACES_MESSAGE}</section>
          )}

          <section>
            <div className="dash-section-head">
              <div>
                <h2 className="dash-title">Autres courses du jour</h2>
                <p className="dash-title-sub">
                  Chaque carte met en avant la lisibilite de la course et les trois numeros a regarder en premier.
                </p>
              </div>
              <p className="dash-label">{visibleRaces.length} courses</p>
            </div>
            {visibleRaces.length > 0 ? (
              <div className="dash-grid">
                {visibleRaces.map((item) => (
                  <DashboardRaceCard
                    item={item}
                    key={`${item.race.reunion}-${item.race.course}`}
                  />
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
              <p className="dash-card-meta" key={item.label}>{item.label} · {formatRate(item.value)}</p>
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
