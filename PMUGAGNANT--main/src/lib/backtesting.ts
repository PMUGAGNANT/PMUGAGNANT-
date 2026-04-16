import { loadAlgoParameters } from "@/lib/config";
import { listRecentPmuDates } from "@/lib/date-utils";
import { ENGINE_V6_VERSION } from "@/lib/engine-v6";
import { attachFaultRates } from "@/lib/horse-faults";
import { replaceActiveSegmentCalibration } from "@/lib/prediction-store";
import {
  getAllRaces,
  getFinalReports,
  getParticipants,
  type FinalReports,
} from "@/lib/pmu-api";
import { analyzeRaceWithParameters } from "@/lib/predictions";
import { loadElitePerformers } from "@/lib/predictions/signals";
import { logger } from "@/lib/server-logger";
import { getSupabaseAdminClient } from "@/lib/supabase";
import type {
  BacktestBetTypeResult,
  BacktestCalibrationBin,
  BacktestSummary,
  Participant,
  RaceSummary,
  ScoredParticipant,
  ScoreStage,
  SegmentCalibrationRow,
  SegmentKey,
} from "@/lib/types";

const COMBINATION_STAKES = {
  COUPLE: 1,
  TRIO: 1,
  QUINTE: 1,
  MULTI: 1,
} as const;

const CALIBRATION_BIN_EDGES = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 1];

type BetTypeKey = "SIMPLE_GAGNANT" | "COUPLE" | "TRIO" | "QUINTE" | "MULTI";

interface AggregatedType {
  betsPlaced: number;
  winningBets: number;
  totalStake: number;
  totalGain: number;
}

interface CalibrationBucket {
  sampleSize: number;
  predictedSum: number;
  wins: number;
}

export interface SegmentCalibrationInputRow {
  probaEstimee?: number | null;
  score_blended?: number | null;
  score_cheval?: number | null;
  resultat_gagnant?: boolean | null;
  mise_simulee?: number | null;
  gain_simule?: number | null;
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function createTypeAccumulator(): Record<BetTypeKey, AggregatedType> {
  return {
    SIMPLE_GAGNANT: { betsPlaced: 0, winningBets: 0, totalStake: 0, totalGain: 0 },
    COUPLE: { betsPlaced: 0, winningBets: 0, totalStake: 0, totalGain: 0 },
    TRIO: { betsPlaced: 0, winningBets: 0, totalStake: 0, totalGain: 0 },
    QUINTE: { betsPlaced: 0, winningBets: 0, totalStake: 0, totalGain: 0 },
    MULTI: { betsPlaced: 0, winningBets: 0, totalStake: 0, totalGain: 0 },
  };
}

function createCalibrationBuckets() {
  return CALIBRATION_BIN_EDGES.slice(0, -1).map<CalibrationBucket>(() => ({
    sampleSize: 0,
    predictedSum: 0,
    wins: 0,
  }));
}

function formatBetTypeLabel(betType: BetTypeKey) {
  switch (betType) {
    case "SIMPLE_GAGNANT":
      return "Simple gagnant";
    case "COUPLE":
      return "Couplé";
    case "TRIO":
      return "Trio";
    case "QUINTE":
      return "Quinté";
    case "MULTI":
      return "Multi";
    default:
      return betType;
  }
}

function getBinIndex(probability: number) {
  for (let index = 0; index < CALIBRATION_BIN_EDGES.length - 1; index += 1) {
    const start = CALIBRATION_BIN_EDGES[index];
    const end = CALIBRATION_BIN_EDGES[index + 1];
    if (probability >= start && probability < end) {
      return index;
    }
  }

  return CALIBRATION_BIN_EDGES.length - 2;
}

function clampCalibration(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function getRowProbability(row: SegmentCalibrationInputRow) {
  if (row.probaEstimee !== null && row.probaEstimee !== undefined) {
    return clampCalibration(row.probaEstimee, 0, 1);
  }

  const score = row.score_blended ?? row.score_cheval ?? 0;
  return clampCalibration(score / 100, 0, 1);
}

function getCalibrationPayloadFromBuckets(buckets: CalibrationBucket[]) {
  return {
    bins: buckets.map((bucket, index) => {
      const min = CALIBRATION_BIN_EDGES[index];
      const max = CALIBRATION_BIN_EDGES[index + 1];
      const averagePredicted =
        bucket.sampleSize > 0 ? bucket.predictedSum / bucket.sampleSize : 0;
      const actualWinRate = bucket.sampleSize > 0 ? bucket.wins / bucket.sampleSize : 0;
      const multiplier =
        bucket.sampleSize > 0 && averagePredicted > 0
          ? actualWinRate / averagePredicted
          : 1;

      return {
        min,
        max,
        multiplier: round2(clampCalibration(multiplier, 0.6, 1.5)),
        sampleSize: bucket.sampleSize,
        averagePredicted: round2(averagePredicted),
        actualWinRate: round2(actualWinRate),
      };
    }),
  };
}

export function computeSegmentCalibration(
  segmentKey: SegmentKey,
  rows: SegmentCalibrationInputRow[],
  stage: ScoreStage = "MATIN",
  engineVersion = ENGINE_V6_VERSION
): SegmentCalibrationRow {
  const buckets = createCalibrationBuckets();
  let totalStake = 0;
  let totalGain = 0;

  for (const row of rows) {
    const probability = getRowProbability(row);
    const bucket = buckets[getBinIndex(probability)];
    bucket.sampleSize += 1;
    bucket.predictedSum += probability;
    if (row.resultat_gagnant === true) {
      bucket.wins += 1;
    }
    totalStake += Math.max(0, row.mise_simulee ?? 0);
    totalGain += Math.max(0, row.gain_simule ?? 0);
  }

  const payload = getCalibrationPayloadFromBuckets(buckets);
  const sampleSize = buckets.reduce((sum, bucket) => sum + bucket.sampleSize, 0);
  const calibrationError =
    sampleSize > 0
      ? round2(
          payload.bins.reduce(
            (sum, bin) =>
              sum + Math.abs(bin.actualWinRate - bin.averagePredicted) * bin.sampleSize,
            0
          ) / sampleSize
        )
      : 0;

  return {
    segment_key: segmentKey,
    stage,
    engine_version: engineVersion,
    bin_definition: { edges: CALIBRATION_BIN_EDGES },
    calibration_payload: payload,
    sample_size: sampleSize,
    brier_score: calibrationError,
    log_loss: null,
    roi_30d:
      totalStake > 0 ? round2(((totalGain - totalStake) / totalStake) * 100) : null,
    is_active: true,
  };
}

export async function persistSegmentCalibration(
  segmentKey: SegmentKey,
  rows: SegmentCalibrationInputRow[],
  stage: ScoreStage = "MATIN",
  engineVersion = ENGINE_V6_VERSION
) {
  return replaceActiveSegmentCalibration(
    computeSegmentCalibration(segmentKey, rows, stage, engineVersion)
  );
}

function sortedKey(numbers: number[]) {
  return [...numbers].sort((left, right) => left - right).join("-");
}

function topPositions(participants: Participant[], limit: number) {
  return participants
    .filter((participant) => participant.ordreArrivee !== null && participant.ordreArrivee > 0)
    .sort((left, right) => (left.ordreArrivee ?? 99) - (right.ordreArrivee ?? 99))
    .slice(0, limit)
    .map((participant) => participant.numPmu);
}

function appendSettledBet(
  accumulator: Record<BetTypeKey, AggregatedType>,
  betType: BetTypeKey,
  stake: number,
  gain: number
) {
  accumulator[betType].betsPlaced += 1;
  accumulator[betType].totalStake += stake;
  accumulator[betType].totalGain += gain;
  if (gain > 0) {
    accumulator[betType].winningBets += 1;
  }
}

function settleSimpleGagnant(
  accumulator: Record<BetTypeKey, AggregatedType>,
  selected: ScoredParticipant | undefined,
  reports: FinalReports,
  participants: Participant[]
) {
  if (!selected) return;

  const stake = selected.prediction.miseBase100;
  if (!stake || stake <= 0) return;

  const arrivalWinner = participants.find((participant) => participant.ordreArrivee === 1)?.numPmu;
  const rapport = reports.simpleGagnant[selected.numPmu];
  if (arrivalWinner === null || arrivalWinner === undefined || rapport === undefined) {
    return;
  }

  const gain = arrivalWinner === selected.numPmu ? round2(stake * rapport) : 0;
  appendSettledBet(accumulator, "SIMPLE_GAGNANT", stake, gain);
}

function settleCouple(
  accumulator: Record<BetTypeKey, AggregatedType>,
  selection: number[],
  reports: FinalReports,
  participants: Participant[]
) {
  if (selection.length !== 2) return;

  const officialTop3 = topPositions(participants, 3);
  if (officialTop3.length < 2) return;

  const key = sortedKey(selection);
  const rapport = reports.couplePlace[key] ?? reports.coupleGagnant[key];
  if (rapport === undefined) return;

  const isWinning = selection.every((horse) => officialTop3.includes(horse));
  appendSettledBet(
    accumulator,
    "COUPLE",
    COMBINATION_STAKES.COUPLE,
    isWinning ? round2(COMBINATION_STAKES.COUPLE * rapport) : 0
  );
}

function settleTrio(
  accumulator: Record<BetTypeKey, AggregatedType>,
  selection: number[],
  reports: FinalReports,
  participants: Participant[]
) {
  if (selection.length !== 3) return;

  const officialTop3 = topPositions(participants, 3);
  if (officialTop3.length !== 3) return;

  const key = sortedKey(selection);
  const rapport = reports.trio[key];
  if (rapport === undefined) return;

  const isWinning = selection.every((horse) => officialTop3.includes(horse));
  appendSettledBet(
    accumulator,
    "TRIO",
    COMBINATION_STAKES.TRIO,
    isWinning ? round2(COMBINATION_STAKES.TRIO * rapport) : 0
  );
}

function settleQuinte(
  accumulator: Record<BetTypeKey, AggregatedType>,
  selection: number[],
  reports: FinalReports,
  participants: Participant[]
) {
  if (selection.length < 5) return;

  const officialTop5 = topPositions(participants, 5);
  if (officialTop5.length < 5) return;

  const key = sortedKey(selection.slice(0, 5));
  const rapport =
    reports.quinteDesordre[key] ??
    reports.quinteOrdre[key] ??
    reports.generic["QUINTE"]?.[key];
  if (rapport === undefined) return;

  const isWinning = selection.slice(0, 5).every((horse) => officialTop5.includes(horse));
  appendSettledBet(
    accumulator,
    "QUINTE",
    COMBINATION_STAKES.QUINTE,
    isWinning ? round2(COMBINATION_STAKES.QUINTE * rapport) : 0
  );
}

function settleMulti(
  accumulator: Record<BetTypeKey, AggregatedType>,
  selection: number[],
  reports: FinalReports,
  participants: Participant[]
) {
  if (selection.length < 4) return;

  const officialTop4 = topPositions(participants, 4);
  if (officialTop4.length < 4) return;

  const key = sortedKey(selection);
  const rapport = reports.multi[key] ?? reports.generic["MULTI"]?.[key];
  if (rapport === undefined) return;

  const isWinning = officialTop4.every((horse) => selection.includes(horse));
  appendSettledBet(
    accumulator,
    "MULTI",
    COMBINATION_STAKES.MULTI,
    isWinning ? round2(COMBINATION_STAKES.MULTI * rapport) : 0
  );
}

function toBacktestBetTypeResults(
  accumulator: Record<BetTypeKey, AggregatedType>
): BacktestBetTypeResult[] {
  return (Object.keys(accumulator) as BetTypeKey[]).map((betType) => {
    const current = accumulator[betType];
    const roi =
      current.totalStake > 0
        ? round2(((current.totalGain - current.totalStake) / current.totalStake) * 100)
        : 0;
    const hitRate =
      current.betsPlaced > 0
        ? round2((current.winningBets / current.betsPlaced) * 100)
        : 0;

    return {
      betType: formatBetTypeLabel(betType),
      betsPlaced: current.betsPlaced,
      winningBets: current.winningBets,
      totalStake: round2(current.totalStake),
      totalGain: round2(current.totalGain),
      profit: round2(current.totalGain - current.totalStake),
      roi,
      hitRate,
    };
  });
}

function toCalibrationBins(buckets: CalibrationBucket[]): BacktestCalibrationBin[] {
  return buckets.map((bucket, index) => {
    const start = CALIBRATION_BIN_EDGES[index];
    const end = CALIBRATION_BIN_EDGES[index + 1];
    const averagePredicted =
      bucket.sampleSize > 0 ? bucket.predictedSum / bucket.sampleSize : 0;
    const actualWinRate = bucket.sampleSize > 0 ? bucket.wins / bucket.sampleSize : 0;

    return {
      label: `${Math.round(start * 100)}-${Math.round(end * 100)}%`,
      sampleSize: bucket.sampleSize,
      averagePredicted: round2(averagePredicted),
      actualWinRate: round2(actualWinRate),
      delta: round2(actualWinRate - averagePredicted),
    };
  });
}

function getBacktestCacheKey(days: number) {
  return `backtest_${days}d`;
}

async function processRaceBacktest(
  dateStr: string,
  race: RaceSummary,
  parameters: Awaited<ReturnType<typeof loadAlgoParameters>>,
  typeAccumulator: Record<BetTypeKey, AggregatedType>,
  calibrationBuckets: CalibrationBucket[]
) {
  const participants = await attachFaultRates(
    await getParticipants(dateStr, race.reunion, race.course)
  );
  const reports = await getFinalReports(dateStr, race.reunion, race.course);
  const analysis = analyzeRaceWithParameters(race, participants, parameters);

  for (const runner of analysis.ranking) {
    const bucket = calibrationBuckets[getBinIndex(runner.prediction.probaEstimee)];
    bucket.sampleSize += 1;
    bucket.predictedSum += runner.prediction.probaEstimee;
    if (runner.ordreArrivee === 1) {
      bucket.wins += 1;
    }
  }

  settleSimpleGagnant(typeAccumulator, analysis.favori ?? analysis.ranking[0], reports, participants);
  settleCouple(typeAccumulator, analysis.bettingPlan.couple?.chevaux ?? [], reports, participants);
  settleTrio(typeAccumulator, analysis.bettingPlan.trio?.chevaux ?? [], reports, participants);
  settleQuinte(typeAccumulator, analysis.bettingPlan.quinte?.chevaux ?? [], reports, participants);
  settleMulti(typeAccumulator, analysis.bettingPlan.multi?.chevaux ?? [], reports, participants);
}

export async function runBacktest(days = 90, referenceDate = new Date()): Promise<BacktestSummary> {
  const dates = listRecentPmuDates(days, referenceDate);
  const typeAccumulator = createTypeAccumulator();
  const calibrationBuckets = createCalibrationBuckets();
  let racesAnalyzed = 0;
  let racesSkipped = 0;

  const parameters = await loadAlgoParameters();
  await loadElitePerformers();

  for (const dateStr of dates) {
    let races: RaceSummary[] = [];

    try {
      races = await getAllRaces(dateStr);
    } catch (error) {
      racesSkipped += 1;
      logger.warn("backtest.day_fetch_failed", {
        dateStr,
        error: error instanceof Error ? error.message : String(error),
      });
      continue;
    }

    for (let index = 0; index < races.length; index += 4) {
      const batch = races.slice(index, index + 4);
      const results = await Promise.allSettled(
        batch.map((race) =>
          processRaceBacktest(dateStr, race, parameters, typeAccumulator, calibrationBuckets)
        )
      );

      for (const result of results) {
        if (result.status === "fulfilled") {
          racesAnalyzed += 1;
        } else {
          racesSkipped += 1;
          logger.warn("backtest.race_failed", {
            dateStr,
            error: result.reason instanceof Error ? result.reason.message : String(result.reason),
          });
        }
      }
    }
  }

  const byBetType = toBacktestBetTypeResults(typeAccumulator);
  const totalStake = round2(byBetType.reduce((sum, item) => sum + item.totalStake, 0));
  const totalGain = round2(byBetType.reduce((sum, item) => sum + item.totalGain, 0));
  const totalProfit = round2(totalGain - totalStake);
  const roi = totalStake > 0 ? round2(((totalGain - totalStake) / totalStake) * 100) : 0;
  const totalBets = byBetType.reduce((sum, item) => sum + item.betsPlaced, 0);
  const startDate = dates[0] ?? "";
  const endDate = dates[dates.length - 1] ?? "";

  return {
    startDate,
    endDate,
    days,
    racesAnalyzed,
    racesSkipped,
    totalBets,
    totalStake,
    totalGain,
    totalProfit,
    roi,
    summarySentence:
      totalProfit >= 0
        ? `En suivant le moteur, tu aurais gagné ${totalProfit} EUR sur ${days} jours.`
        : `En suivant le moteur, tu aurais perdu ${Math.abs(totalProfit)} EUR sur ${days} jours.`,
    byBetType,
    calibration: toCalibrationBins(calibrationBuckets),
  };
}

export async function getCachedBacktest(days = 90) {
  const admin = getSupabaseAdminClient();
  if (!admin) {
    return null;
  }

  const { data, error } = await admin
    .from("parametres")
    .select("value_json")
    .eq("key", getBacktestCacheKey(days))
    .maybeSingle();

  if (error || !data?.value_json) {
    return null;
  }

  return data.value_json as BacktestSummary;
}

export async function persistBacktest(days: number, summary: BacktestSummary) {
  const admin = getSupabaseAdminClient();
  if (!admin) {
    return;
  }

  const { error } = await admin.from("parametres").upsert(
    {
      key: getBacktestCacheKey(days),
      value_json: summary,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" }
  );

  if (error) {
    throw new Error(`Backtest cache upsert failed: ${error.message}`);
  }
}
