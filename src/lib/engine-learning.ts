import { ENGINE_V6_VERSION } from "@/lib/engine-v6";
import {
  listRaceEngineRunsBetween,
  listRunnerOutcomesBetween,
  listRunnerScoreSnapshotsByRunIds,
  upsertEngineCandidate,
  upsertEngineCandidateMetrics,
  upsertSegmentLearningState,
} from "@/lib/prediction-store";
import type {
  EngineCandidateMetricRow,
  EngineCandidateRow,
  RaceEngineRunRow,
  RunnerOutcomeRow,
  RunnerScoreSnapshotRow,
  SegmentKey,
  SegmentLearningStateRow,
} from "@/lib/types";

const MIN_SEGMENT_SAMPLE_FOR_CHALLENGER = 150;
const MIN_SEGMENT_RACES_FOR_CHALLENGER = 12;
const CALIBRATION_BIN_EDGES = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 1];

type LearningSegment = {
  segmentKey: SegmentKey;
  sampleSize: number;
  roi30d: number | null;
  hitRate: number | null;
  calibrationError: number;
  racesAnalyzed?: number;
  bins: Array<{
    min: number;
    max: number;
    multiplier: number;
    sampleSize: number;
  }>;
};

type CalibrationBucket = {
  sampleSize: number;
  predictedSum: number;
  wins: number;
};

type SegmentAccumulator = {
  segmentKey: SegmentKey;
  raceKeys: Set<string>;
  buckets: CalibrationBucket[];
  betCount: number;
  winsCount: number;
  totalStake: number;
  totalGain: number;
  profitSteps: number[];
};

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
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

function createSegmentAccumulator(segmentKey: SegmentKey): SegmentAccumulator {
  return {
    segmentKey,
    raceKeys: new Set<string>(),
    buckets: createCalibrationBuckets(),
    betCount: 0,
    winsCount: 0,
    totalStake: 0,
    totalGain: 0,
    profitSteps: [],
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

function formatVersionDate(referenceDate: Date) {
  return referenceDate.toISOString().slice(0, 10).replace(/-/g, "");
}

function raceKey(date: string, reunion: number, course: number) {
  return `${date}-${reunion}-${course}`;
}

function outcomeKey(date: string, reunion: number, course: number, chevalNum: number) {
  return `${date}-${reunion}-${course}-${chevalNum}`;
}

function buildCalibrationBins(buckets: CalibrationBucket[]) {
  return buckets.map((bucket, index) => {
    const min = CALIBRATION_BIN_EDGES[index];
    const max = CALIBRATION_BIN_EDGES[index + 1];
    const averagePredicted =
      bucket.sampleSize > 0 ? bucket.predictedSum / bucket.sampleSize : 0;
    const actualWinRate = bucket.sampleSize > 0 ? bucket.wins / bucket.sampleSize : 0;
    const ratio =
      bucket.sampleSize >= MIN_SEGMENT_SAMPLE_FOR_CHALLENGER && averagePredicted > 0
        ? actualWinRate / averagePredicted
        : 1;

    return {
      min,
      max,
      multiplier: round2(clamp(ratio, 0.6, 1.5)),
      sampleSize: bucket.sampleSize,
      averagePredicted,
      actualWinRate,
    };
  });
}

function computeCalibrationError(
  bins: Array<{ sampleSize: number; averagePredicted: number; actualWinRate: number }>
) {
  const totalSample = bins.reduce((sum, bin) => sum + bin.sampleSize, 0);
  if (totalSample <= 0) {
    return 0;
  }

  const weightedError = bins.reduce(
    (sum, bin) =>
      sum + Math.abs(bin.actualWinRate - bin.averagePredicted) * bin.sampleSize,
    0
  );

  return round2(weightedError / totalSample);
}

function computeDrawdown(profitSteps: number[]) {
  let peak = 0;
  let cumulative = 0;
  let maxDrawdown = 0;

  for (const profit of profitSteps) {
    cumulative += profit;
    peak = Math.max(peak, cumulative);
    maxDrawdown = Math.max(maxDrawdown, peak - cumulative);
  }

  return round2(maxDrawdown);
}

function getSettledGain(score: RunnerScoreSnapshotRow, outcome: RunnerOutcomeRow | null) {
  if (!outcome || !score.stake_final || score.stake_final <= 0) {
    return null;
  }

  if (score.bet_type === "GAGNANT") {
    return outcome.resultat_gagnant
      ? round2(score.stake_final * (outcome.rapport_gagnant ?? 0))
      : 0;
  }

  if (score.bet_type === "PLACE") {
    return outcome.resultat_place
      ? round2(score.stake_final * (outcome.rapport_place ?? 0))
      : 0;
  }

  return 0;
}

function buildSegmentSummaries(
  runs: RaceEngineRunRow[],
  scores: RunnerScoreSnapshotRow[],
  outcomes: RunnerOutcomeRow[]
) {
  const runById = new Map(
    runs.filter((run): run is RaceEngineRunRow & { id: string } => Boolean(run.id)).map((run) => [run.id, run] as const)
  );
  const outcomeByKey = new Map(
    outcomes.map((outcome) => [
      outcomeKey(outcome.date, outcome.reunion, outcome.course, outcome.cheval_num),
      outcome,
    ] as const)
  );
  const accumulators = new Map<SegmentKey, SegmentAccumulator>();

  for (const score of scores) {
    const run = runById.get(score.run_id);
    if (!run || score.proba_raw === null || score.proba_raw === undefined) {
      continue;
    }

    const accumulator = getSegmentAccumulator(accumulators, run.segment_key);
    accumulator.raceKeys.add(raceKey(run.date, run.reunion, run.course));

    const bucket = accumulator.buckets[getBinIndex(score.proba_raw)];
    bucket.sampleSize += 1;
    bucket.predictedSum += score.proba_raw;

    const outcome =
      outcomeByKey.get(outcomeKey(run.date, run.reunion, run.course, score.cheval_num)) ??
      null;

    if (outcome?.resultat_gagnant) {
      bucket.wins += 1;
    }

    if (score.decision !== "VALIDE" || !score.stake_final || score.stake_final <= 0) {
      continue;
    }

    const gain = getSettledGain(score, outcome);
    if (gain === null) {
      continue;
    }

    accumulator.betCount += 1;
    accumulator.totalStake += score.stake_final;
    accumulator.totalGain += gain;
    accumulator.profitSteps.push(round2(gain - score.stake_final));

    if (gain > 0) {
      accumulator.winsCount += 1;
    }
  }

  return [...accumulators.values()].map((accumulator) => {
    const bins = buildCalibrationBins(accumulator.buckets);
    const sampleSize = accumulator.buckets.reduce(
      (sum, bucket) => sum + bucket.sampleSize,
      0
    );
    const roi30d =
      accumulator.totalStake > 0
        ? round2(((accumulator.totalGain - accumulator.totalStake) / accumulator.totalStake) * 100)
        : null;
    const hitRate =
      accumulator.betCount > 0
        ? round2((accumulator.winsCount / accumulator.betCount) * 100)
        : null;

    return {
      segmentKey: accumulator.segmentKey,
      sampleSize,
      roi30d,
      hitRate,
      calibrationError: computeCalibrationError(bins),
      falsePositiveRate:
        accumulator.betCount > 0
          ? round2(((accumulator.betCount - accumulator.winsCount) / accumulator.betCount) * 100)
          : null,
      drawdown: computeDrawdown(accumulator.profitSteps),
      racesAnalyzed: accumulator.raceKeys.size,
      bins: bins.map(({ min, max, multiplier, sampleSize: binSampleSize }) => ({
        min,
        max,
        multiplier,
        sampleSize: binSampleSize,
      })),
    };
  });
}

export function buildLearningCandidateVersion(referenceDate: Date) {
  return `${ENGINE_V6_VERSION}-shadow-${formatVersionDate(referenceDate)}`;
}

export function shouldCreateSegmentChallenger(segment: LearningSegment) {
  return (
    segment.sampleSize >= MIN_SEGMENT_SAMPLE_FOR_CHALLENGER &&
    (segment.racesAnalyzed ?? 0) >= MIN_SEGMENT_RACES_FOR_CHALLENGER
  );
}

export async function runEngineLearning(days = 90, referenceDate = new Date()) {
  const endIso = referenceDate.toISOString().slice(0, 10);
  const start = new Date(referenceDate.getTime());
  start.setUTCDate(start.getUTCDate() - days);
  const startIso = start.toISOString().slice(0, 10);

  const runs = await listRaceEngineRunsBetween(startIso, endIso, "MATIN");
  const runIds = runs
    .map((run) => run.id)
    .filter((runId): runId is string => Boolean(runId));
  const [scores, outcomes] = await Promise.all([
    listRunnerScoreSnapshotsByRunIds(runIds),
    listRunnerOutcomesBetween(startIso, endIso),
  ]);

  const segmentSummaries = buildSegmentSummaries(runs, scores, outcomes).sort(
    (left, right) => right.sampleSize - left.sampleSize
  );
  const candidateVersion = buildLearningCandidateVersion(referenceDate);
  const eligibleSegments = segmentSummaries.filter(shouldCreateSegmentChallenger);
  const skippedSegments = segmentSummaries
    .filter((segment) => !shouldCreateSegmentChallenger(segment))
    .map((segment) => ({
      segmentKey: segment.segmentKey,
      sampleSize: segment.sampleSize,
      racesAnalyzed: segment.racesAnalyzed ?? 0,
      reason:
        segment.sampleSize < MIN_SEGMENT_SAMPLE_FOR_CHALLENGER
          ? "sample-insufficient"
          : "race-window-insufficient",
    }));

  const createdCandidates: Array<{
    segmentKey: SegmentKey;
    candidateId: string;
    candidateVersion: string;
    sampleSize: number;
    roi30d: number | null;
    hitRate: number | null;
    calibrationError: number;
    falsePositiveRate: number | null;
    drawdown: number;
  }> = [];

  for (const segment of eligibleSegments) {
    const summary = {
      sampleSize: segment.sampleSize,
      roi30d: segment.roi30d,
      hitRate: segment.hitRate,
      calibrationError: segment.calibrationError,
      falsePositiveRate: segment.falsePositiveRate,
      drawdown: segment.drawdown,
      racesAnalyzed: segment.racesAnalyzed ?? 0,
      minSampleForPromotion: MIN_SEGMENT_SAMPLE_FOR_CHALLENGER,
      learningSource: "stored-v6-snapshots",
    };

    const candidate = await upsertEngineCandidate({
      segment_key: segment.segmentKey,
      stage: "MATIN",
      engine_version: candidateVersion,
      parent_version: ENGINE_V6_VERSION,
      candidate_type: "CALIBRATION",
      status: "SHADOW",
      config_patch: {
        probabilityCalibration: {
          segments: {
            [segment.segmentKey]: {
              bins: segment.bins,
            },
          },
        },
      },
      summary,
    } satisfies EngineCandidateRow);

    const metricRow: EngineCandidateMetricRow = {
      candidate_id: candidate.id!,
      window_start: startIso,
      window_end: endIso,
      sample_size: segment.sampleSize,
      roi: segment.roi30d,
      hit_rate: segment.hitRate,
      false_positive_rate: segment.falsePositiveRate,
      calibration_error: segment.calibrationError,
      drawdown: segment.drawdown,
    };

    await upsertEngineCandidateMetrics([metricRow]);

    const learningState: SegmentLearningStateRow = {
      segment_key: segment.segmentKey,
      stage: "MATIN",
      stable_version: ENGINE_V6_VERSION,
      challenger_version: candidateVersion,
      active_calibration_version: ENGINE_V6_VERSION,
      last_learning_run_at: referenceDate.toISOString(),
      last_promotion_at: null,
    };
    await upsertSegmentLearningState(learningState);

    createdCandidates.push({
      segmentKey: segment.segmentKey,
      candidateId: candidate.id!,
      candidateVersion,
      sampleSize: segment.sampleSize,
      roi30d: segment.roi30d,
      hitRate: segment.hitRate,
      calibrationError: segment.calibrationError,
      falsePositiveRate: segment.falsePositiveRate,
      drawdown: segment.drawdown,
    });
  }

  return {
    success: true,
    days,
    stableVersion: ENGINE_V6_VERSION,
    candidateVersion,
    sourceWindow: {
      startDate: startIso,
      endDate: endIso,
      runsAnalyzed: runs.length,
      scoreSnapshots: scores.length,
      outcomes: outcomes.length,
    },
    createdCandidates,
    skippedSegments,
  };
}
