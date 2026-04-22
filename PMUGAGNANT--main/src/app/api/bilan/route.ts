import { NextResponse } from "next/server";
import {
  getAllRaces,
  getArriveeCourse,
  getParticipants,
  getRapportsCourse,
  getTodayDateStr,
} from "@/lib/pmu-api";
import { analyzeRaceWithParameters, getMinutesUntilStart } from "@/lib/analysis";
import { attachFaultRates } from "@/lib/horse-faults";
import { loadAlgoParameters } from "@/lib/config";
import {
  BILAN_DASHBOARD_HISTORY_DAYS_DEFAULT,
  getBilanDashboardHistoryRange,
  listCourseRecordsBetween,
  listPredictionsBetween,
  listRunnerOutcomesBetween,
  saveRunnerOutcome,
} from "@/lib/prediction-store";
import {
  buildPerformanceDashboard,
  getPerformanceDateRange,
  normalizePerformanceBetType,
  normalizePerformanceDistance,
  normalizePerformanceHippodrome,
  normalizePerformancePeriod,
  normalizePerformanceSegment,
} from "@/features/performance/performance-model";
import { badRequest, serverError } from "@/lib/api-response";
import { normalizeRequestedDate, parsePositiveInteger } from "@/lib/request-utils";
import { logger } from "@/lib/server-logger";
import { CONFIDENCE_BUCKET_HIGH, CONFIDENCE_BUCKET_MEDIUM } from "@/lib/scoring-policy";
import { loadElitePerformers } from "@/lib/predictions/signals";
import { fromIsoDate } from "@/lib/date-utils";
import type { PredictionRow, RunnerOutcomeRow } from "@/lib/types";

export const dynamic = "force-dynamic";

type BilanResultat = "GAGNANT" | "PLACE" | "PERDU" | "INCONNU";

type ConfidenceBucketKey = "high" | "medium" | "low";

interface BilanResult {
  courseInfo: {
    dateStr: string;
    reunion: number;
    course: number;
    hippodrome: string;
    heureDepart: string;
    discipline: string;
    nomCourse: string;
  };
  favori: {
    numPmu: number;
    nom: string;
    cotePmu: number | null;
    coteEstimee: number | null;
    jockey?: string | null;
  };
  recommandation: string;
  confiance: number;
  resultat: BilanResultat;
  ordreArrivee?: number | null;
}

interface SegmentSummary {
  label: string;
  roi: number;
  sample: number;
}

interface TimelinePoint {
  date: string;
  gain: number;
  stake: number;
  profit: number;
  cumulativeProfit: number;
}

interface HistoricalDashboard {
  available: boolean;
  globalRoi: number;
  algoSuccessRate: number;
  randomSuccessRate: number;
  totalBets: number;
  totalStake: number;
  totalGain: number;
  bestTracks: SegmentSummary[];
  bestBetTypes: SegmentSummary[];
  bestJockeys: SegmentSummary[];
  timeline: TimelinePoint[];
}

function getTicketSimple(analysis: ReturnType<typeof analyzeRaceWithParameters>) {
  return (
    analysis.ranking.find(
      (runner) =>
        runner.prediction.decision !== "REJET" &&
        runner.prediction.typePariConseille === "GAGNANT"
    ) ??
    analysis.ranking.find((runner) => runner.prediction.decision !== "REJET") ??
    analysis.favori
  );
}

interface AggregateStats {
  played: number;
  success: number;
}

function createAggregate(): AggregateStats {
  return { played: 0, success: 0 };
}

function getConfidenceBucket(score: number): ConfidenceBucketKey {
  if (score >= CONFIDENCE_BUCKET_HIGH) return "high";
  if (score >= CONFIDENCE_BUCKET_MEDIUM) return "medium";
  return "low";
}

function getConfidenceBucketLabel(bucket: ConfidenceBucketKey): string {
  if (bucket === "high") return "Confiance élevée";
  if (bucket === "medium") return "Confiance moyenne";
  return "Confiance faible";
}

function getSuccessRate(stats: AggregateStats): number {
  if (stats.played === 0) return 0;
  return Math.round((stats.success / stats.played) * 100);
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function getRoi(stake: number, gain: number) {
  if (stake <= 0) return 0;
  return round2(((gain - stake) / stake) * 100);
}

const MAX_LIVE_OUTCOME_FALLBACK_RACES = 18;

function outcomeRaceKey(row: Pick<RunnerOutcomeRow, "date" | "reunion" | "course">) {
  return `${row.date}-${row.reunion}-${row.course}`;
}

function predictionRaceKey(row: Pick<PredictionRow, "date" | "reunion" | "course">) {
  return `${row.date}-${row.reunion}-${row.course}`;
}

function getRecentFallbackStartIso(endIso: string) {
  const end = new Date(`${endIso}T00:00:00.000Z`);
  if (Number.isNaN(end.getTime())) return endIso;
  end.setUTCDate(end.getUTCDate() - 2);
  return end.toISOString().slice(0, 10);
}

async function loadMissingLiveOutcomes(
  predictions: PredictionRow[],
  existingOutcomes: RunnerOutcomeRow[],
  range: { startIso: string; endIso: string }
) {
  const existingRaceKeys = new Set(existingOutcomes.map(outcomeRaceKey));
  const recentStartIso = getRecentFallbackStartIso(range.endIso);
  const racesToFetch = new Map<
    string,
    { date: string; reunion: number; course: number }
  >();

  for (const prediction of predictions) {
    if (prediction.decision === "REJET" || (prediction.mise_simulee ?? 0) <= 0) {
      continue;
    }
    if (prediction.date < recentStartIso || prediction.date > range.endIso) {
      continue;
    }

    const raceKey = predictionRaceKey(prediction);
    if (!existingRaceKeys.has(raceKey)) {
      racesToFetch.set(raceKey, {
        date: prediction.date,
        reunion: prediction.reunion,
        course: prediction.course,
      });
    }
  }

  const fetchedRows: RunnerOutcomeRow[] = [];
  for (const race of [...racesToFetch.values()].slice(0, MAX_LIVE_OUTCOME_FALLBACK_RACES)) {
    const dateStr = fromIsoDate(race.date);

    try {
      const [arrivee, reports] = await Promise.all([
        getArriveeCourse(dateStr, race.reunion, race.course),
        getRapportsCourse(dateStr, race.reunion, race.course),
      ]);

      if (!arrivee || arrivee.length === 0) {
        continue;
      }

      const rows: RunnerOutcomeRow[] = arrivee.map((chevalNum, index) => {
        const ordreArrivee = index + 1;
        return {
          date: race.date,
          reunion: race.reunion,
          course: race.course,
          cheval_num: chevalNum,
          ordre_arrivee: ordreArrivee,
          resultat_gagnant: ordreArrivee === 1,
          resultat_place: ordreArrivee <= 3,
          rapport_gagnant: reports?.simpleGagnant[chevalNum] ?? null,
          rapport_place: reports?.simplePlace[chevalNum] ?? null,
          non_partant: false,
        };
      });

      fetchedRows.push(...rows);
      await saveRunnerOutcome(rows);
    } catch (error) {
      logger.warn("bilan.performance.live_outcome_fallback_failed", {
        date: race.date,
        reunion: race.reunion,
        course: race.course,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return fetchedRows;
}

function buildHistoricalDashboard(
  predictions: Awaited<ReturnType<typeof listPredictionsBetween>>,
  courses: Awaited<ReturnType<typeof listCourseRecordsBetween>>,
  dailyResults: BilanResult[]
): HistoricalDashboard {
  const playedRows = predictions.filter(
    (row) =>
      row.stage === "RESULTAT" &&
      row.decision !== "REJET" &&
      (row.mise_simulee ?? 0) > 0 &&
      row.gain_simule !== null
  );

  if (playedRows.length === 0) {
    return {
      available: false,
      globalRoi: 0,
      algoSuccessRate: 0,
      randomSuccessRate: 0,
      totalBets: 0,
      totalStake: 0,
      totalGain: 0,
      bestTracks: [],
      bestBetTypes: [],
      bestJockeys: [],
      timeline: [],
    };
  }

  const courseMap = new Map<string, (typeof courses)[number]>(
    courses.map((course) => [`${course.date}-${course.reunion}-${course.course}`, course] as const)
  );
  const byTrack = new Map<string, { stake: number; gain: number; count: number }>();
  const byBetType = new Map<string, { stake: number; gain: number; count: number }>();
  const byDate = new Map<string, { stake: number; gain: number }>();
  const dailyJockeys = new Map<string, { stake: number; gain: number; count: number }>();

  let totalStake = 0;
  let totalGain = 0;
  let algoHits = 0;
  let randomExpectedHits = 0;

  for (const row of playedRows) {
    const stake = row.mise_simulee ?? 0;
    const gain = row.gain_simule ?? 0;
    const raceKey = `${row.date}-${row.reunion}-${row.course}`;
    const course = courseMap.get(raceKey);
    const trackKey = row.hippodrome || "Inconnu";
    const betTypeKey = row.pari_conseille || "AUTRE";

    totalStake += stake;
    totalGain += gain;

    if (gain > stake) {
      algoHits += 1;
    }

    randomExpectedHits += 1 / Math.max(course?.nombre_partants ?? 12, 1);

    const trackSegment = byTrack.get(trackKey) ?? { stake: 0, gain: 0, count: 0 };
    trackSegment.stake += stake;
    trackSegment.gain += gain;
    trackSegment.count += 1;
    byTrack.set(trackKey, trackSegment);

    const betTypeSegment = byBetType.get(betTypeKey) ?? { stake: 0, gain: 0, count: 0 };
    betTypeSegment.stake += stake;
    betTypeSegment.gain += gain;
    betTypeSegment.count += 1;
    byBetType.set(betTypeKey, betTypeSegment);

    const dateSegment = byDate.get(row.date) ?? { stake: 0, gain: 0 };
    dateSegment.stake += stake;
    dateSegment.gain += gain;
    byDate.set(row.date, dateSegment);
  }

  for (const result of dailyResults) {
    const jockey = result.favori.jockey?.trim();
    if (!jockey) continue;

    const segment = dailyJockeys.get(jockey) ?? { stake: 0, gain: 0, count: 0 };
    segment.count += 1;
    if (result.resultat === "GAGNANT") {
      segment.gain += 1;
    } else if (result.resultat === "PLACE") {
      segment.gain += 0.5;
    }
    segment.stake += 1;
    dailyJockeys.set(jockey, segment);
  }

  const timeline: TimelinePoint[] = [];
  let cumulativeProfit = 0;

  for (const [timelineDate, values] of [...byDate.entries()].sort((left, right) =>
    left[0].localeCompare(right[0])
  )) {
    const profit = round2(values.gain - values.stake);
    cumulativeProfit = round2(cumulativeProfit + profit);
    timeline.push({
      date: timelineDate,
      gain: round2(values.gain),
      stake: round2(values.stake),
      profit,
      cumulativeProfit,
    });
  }

  const toSegmentSummary = (
    map: Map<string, { stake: number; gain: number; count: number }>
  ): SegmentSummary[] =>
    [...map.entries()]
      .map(([label, values]) => ({
        label,
        roi: getRoi(values.stake, values.gain),
        sample: values.count,
      }))
      .filter((entry) => entry.sample > 0)
      .sort((left, right) => {
        if (right.roi !== left.roi) return right.roi - left.roi;
        return right.sample - left.sample;
      })
      .slice(0, 10);

  return {
    available: true,
    globalRoi: getRoi(totalStake, totalGain),
    algoSuccessRate: round2((algoHits / playedRows.length) * 100),
    randomSuccessRate: round2((randomExpectedHits / playedRows.length) * 100),
    totalBets: playedRows.length,
    totalStake: round2(totalStake),
    totalGain: round2(totalGain),
    bestTracks: toSegmentSummary(byTrack),
    bestBetTypes: toSegmentSummary(byBetType),
    bestJockeys: toSegmentSummary(dailyJockeys),
    timeline,
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  if (searchParams.get("mode") === "performance") {
    const period = normalizePerformancePeriod(searchParams.get("period"));
    const segment = normalizePerformanceSegment(searchParams.get("segment"));
    const betType = normalizePerformanceBetType(searchParams.get("bet_type"));
    const hippodrome = normalizePerformanceHippodrome(searchParams.get("hippodrome"));
    const distance = normalizePerformanceDistance(searchParams.get("distance"));
    const displayRange = getPerformanceDateRange(period);
    const fetchRange = getPerformanceDateRange(period === "all" ? "all" : "90j");

    try {
      const [predictions, courses, outcomes] = await Promise.all([
        listPredictionsBetween(fetchRange.startIso, fetchRange.endIso),
        listCourseRecordsBetween(fetchRange.startIso, fetchRange.endIso),
        listRunnerOutcomesBetween(fetchRange.startIso, fetchRange.endIso),
      ]);
      const liveOutcomes = await loadMissingLiveOutcomes(predictions, outcomes, displayRange);
      const mergedOutcomes = liveOutcomes.length > 0 ? [...outcomes, ...liveOutcomes] : outcomes;

      return NextResponse.json({
        success: true,
        range: displayRange,
        performance: buildPerformanceDashboard(predictions, courses, {
          period,
          segment,
          betType,
          hippodrome,
          distance,
        }, new Date().toISOString(), displayRange, mergedOutcomes),
      });
    } catch (error) {
      return serverError("Echec du chargement du cockpit performance.", error, {
        period,
        segment,
        betType,
        hippodrome,
        distance,
      });
    }
  }

  const date = normalizeRequestedDate(searchParams.get("date"), getTodayDateStr());
  if (!date) {
    return badRequest("Format de date invalide. Attendu : DDMMYYYY.");
  }

  const dashboardDaysRaw = searchParams.get("dashboard_days");
  const dashboardDaysRequested =
    parsePositiveInteger(dashboardDaysRaw) ?? BILAN_DASHBOARD_HISTORY_DAYS_DEFAULT;
  const dashboardHistoryMeta = getBilanDashboardHistoryRange(new Date(), dashboardDaysRequested);

  try {
    const algoParameters = await loadAlgoParameters();
    await loadElitePerformers();
    const races = await getAllRaces(date);
    const results: BilanResult[] = [];

    for (const race of races) {
      const minutesUntil = getMinutesUntilStart(race.heureDepart, race.dateStr);
      if (minutesUntil >= -10) continue;

      try {
        const participants = await attachFaultRates(
          await getParticipants(date, race.reunion, race.course)
        );
        const analysis = analyzeRaceWithParameters(race, participants, algoParameters);
        const ticketSimple = getTicketSimple(analysis);
        if (!ticketSimple) continue;

        const ticketResult = participants.find(
          (participant) => participant.numPmu === ticketSimple.numPmu
        );
        const predictedOdds = analysis.predictionsCotes[ticketSimple.numPmu];
        const ordreArrivee = ticketResult?.ordreArrivee ?? null;
        const resultat: BilanResultat =
          ordreArrivee === 1
            ? "GAGNANT"
            : ordreArrivee !== null && ordreArrivee <= 3
              ? "PLACE"
              : ordreArrivee !== null
                ? "PERDU"
                : "INCONNU";

        results.push({
          courseInfo: {
            dateStr: race.dateStr,
            reunion: race.reunion,
            course: race.course,
            hippodrome: race.hippodrome,
            heureDepart: race.heureDepart,
            discipline: race.discipline,
            nomCourse: race.nomCourse,
          },
          favori: {
            numPmu: ticketSimple.numPmu,
            nom: ticketSimple.nom,
            cotePmu: ticketResult?.cote ?? ticketSimple.cote ?? null,
            coteEstimee:
              predictedOdds?.coteEstimee ??
              predictedOdds?.coteMatin ??
              null,
            jockey: ticketSimple.jockey || ticketSimple.driver || null,
          },
          recommandation:
            analysis.recommandation?.decision ||
            analysis.prediction.decisionCourse ||
            "-",
          confiance: analysis.scoreConfiance?.score ?? 0,
          resultat,
          ordreArrivee,
        });
      } catch (error) {
        logger.warn("bilan.race_failed", {
          date,
          reunion: race.reunion,
          course: race.course,
          error: error instanceof Error ? error.message : String(error),
        });
        // Skip failed race fetches so the bilan stays available.
      }
    }

    results.sort((left, right) => {
      const resultOrder: Record<BilanResultat, number> = {
        GAGNANT: 0,
        PLACE: 1,
        PERDU: 2,
        INCONNU: 3,
      };

      if (resultOrder[left.resultat] !== resultOrder[right.resultat]) {
        return resultOrder[left.resultat] - resultOrder[right.resultat];
      }

      return right.confiance - left.confiance;
    });

    const playedResults = results.filter((result) => result.resultat !== "INCONNU");
    const wins = playedResults.filter((result) => result.resultat === "GAGNANT").length;
    const places = playedResults.filter((result) => result.resultat === "PLACE").length;
    const losses = playedResults.filter((result) => result.resultat === "PERDU").length;

    const byDiscipline: Record<string, AggregateStats> = {};
    const byConfidence: Record<ConfidenceBucketKey, AggregateStats> = {
      high: createAggregate(),
      medium: createAggregate(),
      low: createAggregate(),
    };

    for (const result of playedResults) {
      const disciplineKey = result.courseInfo.discipline || "AUTRE";
      if (!byDiscipline[disciplineKey]) {
        byDiscipline[disciplineKey] = createAggregate();
      }

      byDiscipline[disciplineKey].played += 1;
      if (result.resultat === "GAGNANT" || result.resultat === "PLACE") {
        byDiscipline[disciplineKey].success += 1;
      }

      const confidenceBucket = getConfidenceBucket(result.confiance);
      byConfidence[confidenceBucket].played += 1;
      if (result.resultat === "GAGNANT" || result.resultat === "PLACE") {
        byConfidence[confidenceBucket].success += 1;
      }
    }

    const disciplineEntries = Object.entries(byDiscipline)
      .map(([discipline, stats]) => ({
        discipline,
        played: stats.played,
        success: stats.success,
        rate: getSuccessRate(stats),
      }))
      .sort((left, right) => {
        if (right.rate !== left.rate) return right.rate - left.rate;
        return right.played - left.played;
      });

    const confidenceEntries = (Object.keys(byConfidence) as ConfidenceBucketKey[])
      .map((bucket) => ({
        bucket,
        label: getConfidenceBucketLabel(bucket),
        played: byConfidence[bucket].played,
        success: byConfidence[bucket].success,
        rate: getSuccessRate(byConfidence[bucket]),
      }))
      .sort((left, right) => {
        if (right.rate !== left.rate) return right.rate - left.rate;
        return right.played - left.played;
      });

    const bestDiscipline = disciplineEntries.find((entry) => entry.played >= 2) ?? disciplineEntries[0] ?? null;
    const worstDiscipline =
      [...disciplineEntries]
        .reverse()
        .find((entry) => entry.played >= 2) ??
      disciplineEntries[disciplineEntries.length - 1] ??
      null;

    const bestConfidenceBucket =
      confidenceEntries.find((entry) => entry.played > 0) ?? null;
    const worstConfidenceBucket =
      [...confidenceEntries].reverse().find((entry) => entry.played > 0) ?? null;

    const totalPlayed = playedResults.length;
    const successRate = totalPlayed > 0 ? Math.round(((wins + places) / totalPlayed) * 100) : 0;

    let healthLabel = "Journée neutre";
    if (successRate >= 45) healthLabel = "Journée solide";
    else if (successRate >= 30) healthLabel = "Journée correcte";
    else if (successRate >= 20) healthLabel = "Journée fragile";
    else healthLabel = "Journée difficile";

    const insights: string[] = [];
    if (bestDiscipline) {
      insights.push(
        `Le meilleur terrain du jour est ${bestDiscipline.discipline} (${bestDiscipline.rate}% de réussite sur ${bestDiscipline.played} courses).`
      );
    }
    if (worstDiscipline && worstDiscipline !== bestDiscipline) {
      insights.push(
        `Le point faible est ${worstDiscipline.discipline} (${worstDiscipline.rate}% sur ${worstDiscipline.played} courses).`
      );
    }
    if (bestConfidenceBucket) {
      insights.push(
        `${bestConfidenceBucket.label} est la zone la plus fiable (${bestConfidenceBucket.rate}% de réussite).`
      );
    }
    if (worstConfidenceBucket && worstConfidenceBucket !== bestConfidenceBucket) {
      insights.push(
        `${worstConfidenceBucket.label} reste la zone la plus risquée (${worstConfidenceBucket.rate}% de réussite).`
      );
    }

    let dashboard: HistoricalDashboard = {
      available: false,
      globalRoi: 0,
      algoSuccessRate: 0,
      randomSuccessRate: 0,
      totalBets: 0,
      totalStake: 0,
      totalGain: 0,
      bestTracks: [],
      bestBetTypes: [],
      bestJockeys: [],
      timeline: [],
    };

    try {
      const { startIso, endIso } = dashboardHistoryMeta;
      const [historicalPredictions, historicalCourses] = await Promise.all([
        listPredictionsBetween(startIso, endIso),
        listCourseRecordsBetween(startIso, endIso),
      ]);
      dashboard = buildHistoricalDashboard(historicalPredictions, historicalCourses, results);
    } catch (dashboardError) {
      logger.warn("bilan.dashboard_unavailable", {
        date,
        error: dashboardError instanceof Error ? dashboardError.message : String(dashboardError),
      });
    }

    return NextResponse.json({
      success: true,
      date,
      dashboardHistory: {
        days: dashboardHistoryMeta.historyDaysUsed,
        startIso: dashboardHistoryMeta.startIso,
        endIso: dashboardHistoryMeta.endIso,
      },
      summary: {
        totalRaces: races.length,
        totalPlayed,
        wins,
        places,
        losses,
        successRate,
      },
      expert: {
        healthLabel,
        bestDiscipline,
        worstDiscipline,
        bestConfidenceBucket,
        worstConfidenceBucket,
        confidenceBuckets: confidenceEntries,
        disciplineBreakdown: disciplineEntries,
        insights,
      },
      dashboard,
      results,
    });
  } catch (error) {
    return serverError("Échec du chargement du bilan.", error, { date });
  }
}
