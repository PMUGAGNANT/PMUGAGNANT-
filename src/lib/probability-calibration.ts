import { getCachedBacktest, runBacktest } from "@/lib/backtesting";
import { loadAlgoParameters } from "@/lib/config";
import { listRecentPmuDates } from "@/lib/date-utils";
import { getRaceSegmentKey, ENGINE_V6_VERSION } from "@/lib/engine-v6";
import { attachFaultRates } from "@/lib/horse-faults";
import {
  replaceActiveSegmentCalibration,
  upsertSegmentLearningState,
} from "@/lib/prediction-store";
import { analyzeRaceWithParameters } from "@/lib/predictions";
import { getAllRaces, getFinalReports, getParticipants } from "@/lib/pmu-api";
import { logger } from "@/lib/server-logger";
import { getSupabaseAdminClient, getSupabaseAdminConfigError } from "@/lib/supabase";
import type {
  BacktestCalibrationBin,
  ParamHistoryRow,
  SegmentKey,
  SegmentLearningStateRow,
} from "@/lib/types";

const MIN_SAMPLE_PER_BIN = 100;
const CALIBRATION_BIN_EDGES = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 1];

type CalibrationPayload = {
  bins: Array<{
    min: number;
    max: number;
    multiplier: number;
    sampleSize: number;
  }>;
};

type SegmentCalibrationSummary = {
  segmentKey: SegmentKey;
  payload: CalibrationPayload;
  sampleSize: number;
  racesAnalyzed: number;
  favoriteBets: number;
  favoriteWins: number;
  roi30d: number | null;
  hitRate: number | null;
  calibrationError: number;
};

type CalibrationBucket = {
  sampleSize: number;
  predictedSum: number;
  wins: number;
};

type SegmentAccumulator = {
  segmentKey: SegmentKey;
  racesAnalyzed: number;
  favoriteBets: number;
  favoriteWins: number;
  totalStake: number;
  totalGain: number;
  buckets: CalibrationBucket[];
};

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function parseRange(label: string) {
  const [rawMin, rawMax] = label.replace("%", "").split("-");
  const min = Number(rawMin) / 100;
  const max = Number(rawMax) / 100;
  return { min, max };
}

function createCalibrationBuckets() {
  return CALIBRATION_BIN_EDGES.slice(0, -1).map<CalibrationBucket>(() => ({
    sampleSize: 0,
    predictedSum: 0,
    wins: 0,
  }));
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

function buildCalibrationPayloadFromBins(calibration: BacktestCalibrationBin[]): CalibrationPayload {
  return {
    bins: calibration.map((bin) => {
      const { min, max } = parseRange(bin.label);
      const ratio =
        bin.sampleSize >= MIN_SAMPLE_PER_BIN && bin.averagePredicted > 0
          ? bin.actualWinRate / bin.averagePredicted
          : 1;

      return {
        min,
        max,
        multiplier: round2(clamp(ratio, 0.6, 1.5)),
        sampleSize: bin.sampleSize,
      };
    }),
  };
}

function createSegmentAccumulator(segmentKey: SegmentKey): SegmentAccumulator {
  return {
    segmentKey,
    racesAnalyzed: 0,
    favoriteBets: 0,
    favoriteWins: 0,
    totalStake: 0,
    totalGain: 0,
    buckets: createCalibrationBuckets(),
  };
}

function getSegmentAccumulator(
  accumulators: Map<SegmentKey, SegmentAccumulator>,
  segmentKey: SegmentKey
) {
  const current = accumulators.get(segmentKey);
  if (current) {
    return current;
  }

  const created = createSegmentAccumulator(segmentKey);
  accumulators.set(segmentKey, created);
  return created;
}

function settleSegmentFavorite(
  accumulator: SegmentAccumulator,
  winnerNum: number | null,
  stake: number,
  selectedNum: number | null,
  rapport: number | null | undefined
) {
  if (!selectedNum || !stake || stake <= 0 || rapport === undefined) {
    return;
  }

  accumulator.favoriteBets += 1;
  accumulator.totalStake += stake;

  if (winnerNum === selectedNum) {
    accumulator.favoriteWins += 1;
    accumulator.totalGain += stake * (rapport ?? 0);
  }
}

function computeCalibrationError(calibration: BacktestCalibrationBin[]) {
  const totalSample = calibration.reduce((sum, bin) => sum + bin.sampleSize, 0);
  if (totalSample <= 0) {
    return 0;
  }

  const weightedError = calibration.reduce(
    (sum, bin) => sum + Math.abs(bin.delta) * bin.sampleSize,
    0
  );

  return round2(weightedError / totalSample);
}

async function buildSegmentCalibrationSummaries(
  days: number,
  referenceDate: Date
): Promise<SegmentCalibrationSummary[]> {
  const dates = listRecentPmuDates(days, referenceDate);
  const parameters = await loadAlgoParameters();
  const accumulators = new Map<SegmentKey, SegmentAccumulator>();

  for (const dateStr of dates) {
    let races = [];

    try {
      races = await getAllRaces(dateStr);
    } catch (error) {
      logger.warn("segment_calibration.day_fetch_failed", {
        dateStr,
        error: error instanceof Error ? error.message : String(error),
      });
      continue;
    }

    for (const race of races) {
      try {
        const participants = await attachFaultRates(
          await getParticipants(dateStr, race.reunion, race.course)
        );
        const reports = await getFinalReports(dateStr, race.reunion, race.course);
        const analysis = analyzeRaceWithParameters(race, participants, parameters);
        const segmentKey = getRaceSegmentKey(race);
        const accumulator = getSegmentAccumulator(accumulators, segmentKey);
        accumulator.racesAnalyzed += 1;

        for (const runner of analysis.ranking) {
          const bucket = accumulator.buckets[getBinIndex(runner.prediction.probaEstimee)];
          bucket.sampleSize += 1;
          bucket.predictedSum += runner.prediction.probaEstimee;
          if (runner.ordreArrivee === 1) {
            bucket.wins += 1;
          }
        }

        const favorite = analysis.favori ?? analysis.ranking[0] ?? null;
        const winnerNum =
          participants.find((participant) => participant.ordreArrivee === 1)?.numPmu ?? null;

        settleSegmentFavorite(
          accumulator,
          winnerNum,
          favorite?.prediction.miseBase100 ?? 0,
          favorite?.numPmu ?? null,
          favorite ? reports.simpleGagnant[favorite.numPmu] : undefined
        );
      } catch (error) {
        logger.warn("segment_calibration.race_failed", {
          dateStr,
          reunion: race.reunion,
          course: race.course,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  return [...accumulators.values()]
    .map((accumulator) => {
      const calibration = toCalibrationBins(accumulator.buckets);
      const payload = buildCalibrationPayloadFromBins(calibration);
      const sampleSize = accumulator.buckets.reduce(
        (sum, bucket) => sum + bucket.sampleSize,
        0
      );
      const roi30d =
        accumulator.totalStake > 0
          ? round2(((accumulator.totalGain - accumulator.totalStake) / accumulator.totalStake) * 100)
          : null;
      const hitRate =
        accumulator.favoriteBets > 0
          ? round2((accumulator.favoriteWins / accumulator.favoriteBets) * 100)
          : null;

      return {
        segmentKey: accumulator.segmentKey,
        payload,
        sampleSize,
        racesAnalyzed: accumulator.racesAnalyzed,
        favoriteBets: accumulator.favoriteBets,
        favoriteWins: accumulator.favoriteWins,
        roi30d,
        hitRate,
        calibrationError: computeCalibrationError(calibration),
      } satisfies SegmentCalibrationSummary;
    })
    .filter((item) => item.sampleSize > 0)
    .sort((left, right) => right.sampleSize - left.sampleSize);
}

function buildSegmentParamPayload(summaries: SegmentCalibrationSummary[]) {
  return summaries.reduce<Record<string, unknown>>((acc, summary) => {
    acc[summary.segmentKey] = {
      bins: summary.payload.bins,
      sampleSize: summary.sampleSize,
      roi: summary.roi30d,
      hitRate: summary.hitRate,
      calibrationError: summary.calibrationError,
      racesAnalyzed: summary.racesAnalyzed,
      favoriteBets: summary.favoriteBets,
      favoriteWins: summary.favoriteWins,
    };
    return acc;
  }, {});
}

function buildCalibrationHistoryRow(
  key: string,
  previousValue: unknown,
  nextValue: unknown,
  reason: string
): ParamHistoryRow {
  return {
    parameter_key: key,
    previous_value: JSON.stringify(previousValue ?? null),
    next_value: JSON.stringify(nextValue),
    reason,
  };
}

export async function runProbabilityCalibration(days = 90, referenceDate = new Date()) {
  const admin = getSupabaseAdminClient();
  if (!admin) {
    throw new Error(getSupabaseAdminConfigError());
  }

  const backtest =
    (await getCachedBacktest(days)) ?? (await runBacktest(days, referenceDate));
  const payload = buildCalibrationPayloadFromBins(backtest.calibration);
  const segmentSummaries = await buildSegmentCalibrationSummaries(days, referenceDate);
  const segmentPayload = buildSegmentParamPayload(segmentSummaries);

  const { data: previousRows, error: previousError } = await admin
    .from("parametres")
    .select("key, value_json")
    .in("key", ["probabilityCalibration", "probabilityCalibrationSegments"]);

  if (previousError) {
    throw new Error(`Probability calibration previous fetch failed: ${previousError.message}`);
  }

  const previousMap = (previousRows ?? []).reduce<Record<string, unknown>>((acc, row) => {
    if (row.key) {
      acc[row.key] = row.value_json ?? null;
    }
    return acc;
  }, {});

  const nowIso = referenceDate.toISOString();
  const { error: upsertError } = await admin.from("parametres").upsert(
    [
      {
        key: "probabilityCalibration",
        value_json: payload,
        updated_at: nowIso,
      },
      {
        key: "probabilityCalibrationSegments",
        value_json: segmentPayload,
        updated_at: nowIso,
      },
    ],
    { onConflict: "key" }
  );

  if (upsertError) {
    throw new Error(`Probability calibration upsert failed: ${upsertError.message}`);
  }

  const historyRows = [
    buildCalibrationHistoryRow(
      "probabilityCalibration",
      previousMap.probabilityCalibration ?? null,
      payload,
      `Calibration probabiliste globale sur ${days} jours a partir des resultats reels`
    ),
    buildCalibrationHistoryRow(
      "probabilityCalibrationSegments",
      previousMap.probabilityCalibrationSegments ?? null,
      segmentPayload,
      `Calibration probabiliste segmentee sur ${days} jours a partir des resultats reels`
    ),
  ];

  const { error: historyError } = await admin.from("param_history").insert(historyRows);
  if (historyError) {
    throw new Error(`Probability calibration history insert failed: ${historyError.message}`);
  }

  for (const summary of segmentSummaries) {
    await replaceActiveSegmentCalibration({
      segment_key: summary.segmentKey,
      stage: "MATIN",
      engine_version: ENGINE_V6_VERSION,
      bin_definition: { edges: CALIBRATION_BIN_EDGES },
      calibration_payload: summary.payload,
      sample_size: summary.sampleSize,
      brier_score: summary.calibrationError,
      log_loss: null,
      roi_30d: summary.roi30d,
      is_active: true,
    });

    const learningState: SegmentLearningStateRow = {
      segment_key: summary.segmentKey,
      stage: "MATIN",
      stable_version: ENGINE_V6_VERSION,
      challenger_version: null,
      active_calibration_version: ENGINE_V6_VERSION,
      last_learning_run_at: nowIso,
      last_promotion_at: null,
    };
    await upsertSegmentLearningState(learningState);
  }

  return {
    success: true,
    days,
    payload,
    segments: segmentSummaries.map((summary) => ({
      segmentKey: summary.segmentKey,
      sampleSize: summary.sampleSize,
      roi30d: summary.roi30d,
      hitRate: summary.hitRate,
      calibrationError: summary.calibrationError,
      bins: summary.payload.bins,
    })),
    sourceBacktest: {
      startDate: backtest.startDate,
      endDate: backtest.endDate,
      racesAnalyzed: backtest.racesAnalyzed,
      roi: backtest.roi,
    },
  };
}
