import { ENGINE_V6_VERSION } from "@/lib/engine-v6";
import { buildLearningWindows, type LearningWindow } from "@/lib/learning-windows";
import {
  getSegmentLearningState,
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

type LearningSegmentSummary = {
  segmentKey: SegmentKey;
  sampleSize: number;
  roi: number | null;
  hitRate: number | null;
  calibrationError: number;
  falsePositiveRate: number | null;
  drawdown: number;
  racesAnalyzed: number;
  bins: Array<{
    min: number;
    max: number;
    multiplier: number;
    sampleSize: number;
  }>;
};

type WindowSummary = LearningWindow & {
  runsAnalyzed: number;
  scoreSnapshots: number;
  outcomes: number;
  segments: LearningSegmentSummary[];
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

function buildNextLearningState(
  existingState: SegmentLearningStateRow | null,
  candidate: EngineCandidateRow,
  referenceIso: string
): SegmentLearningStateRow {
  const stableVersion =
    existingState?.stable_version ?? candidate.parent_version ?? ENGINE_V6_VERSION;
  const activeCalibrationVersion =
    existingState?.active_calibration_version ?? stableVersion;

  if (candidate.status === "PROMOTED") {
    return {
      segment_key: candidate.segment_key,
      stage: candidate.stage,
      stable_version: candidate.engine_version,
      challenger_version: null,
      active_calibration_version: candidate.engine_version,
      last_learning_run_at: referenceIso,
      last_promotion_at: candidate.promoted_at ?? existingState?.last_promotion_at ?? null,
    };
  }

  return {
    segment_key: candidate.segment_key,
    stage: candidate.stage,
    stable_version: stableVersion,
    challenger_version: candidate.status === "SHADOW" ? candidate.engine_version : null,
    active_calibration_version: activeCalibrationVersion,
    last_learning_run_at: referenceIso,
    last_promotion_at: existingState?.last_promotion_at ?? null,
  };
}

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
    runs
      .filter((run): run is RaceEngineRunRow & { id: string } => Boolean(run.id))
      .map((run) => [run.id, run] as const)
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

  return [...accumulators.values()]
    .map((accumulator) => {
      const bins = buildCalibrationBins(accumulator.buckets);
      const sampleSize = accumulator.buckets.reduce(
        (sum, bucket) => sum + bucket.sampleSize,
        0
      );
      const roi =
        accumulator.totalStake > 0
          ? round2(
              ((accumulator.totalGain - accumulator.totalStake) / accumulator.totalStake) * 100
            )
          : null;
      const hitRate =
        accumulator.betCount > 0
          ? round2((accumulator.winsCount / accumulator.betCount) * 100)
          : null;

      return {
        segmentKey: accumulator.segmentKey,
        sampleSize,
        roi,
        hitRate,
        calibrationError: computeCalibrationError(bins),
        falsePositiveRate:
          accumulator.betCount > 0
            ? round2(
                ((accumulator.betCount - accumulator.winsCount) / accumulator.betCount) * 100
              )
            : null,
        drawdown: computeDrawdown(accumulator.profitSteps),
        racesAnalyzed: accumulator.raceKeys.size,
        bins: bins.map(({ min, max, multiplier, sampleSize: binSampleSize }) => ({
          min,
          max,
          multiplier,
          sampleSize: binSampleSize,
        })),
      } satisfies LearningSegmentSummary;
    })
    .sort((left, right) => right.sampleSize - left.sampleSize);
}

async function buildWindowSummary(window: LearningWindow): Promise<WindowSummary> {
  const runs = await listRaceEngineRunsBetween(window.startIso, window.endIso, "MATIN");
  const runIds = runs
    .map((run) => run.id)
    .filter((runId): runId is string => Boolean(runId));
  const [scores, outcomes] = await Promise.all([
    listRunnerScoreSnapshotsByRunIds(runIds),
    listRunnerOutcomesBetween(window.startIso, window.endIso),
  ]);

  return {
    ...window,
    runsAnalyzed: runs.length,
    scoreSnapshots: scores.length,
    outcomes: outcomes.length,
    segments: buildSegmentSummaries(runs, scores, outcomes),
  };
}

export function buildLearningCandidateVersion(referenceDate: Date) {
  return `${ENGINE_V6_VERSION}-shadow-${formatVersionDate(referenceDate)}`;
}

export function shouldCreateSegmentChallenger(segment: LearningSegmentSummary) {
  return (
    segment.sampleSize >= MIN_SEGMENT_SAMPLE_FOR_CHALLENGER &&
    segment.racesAnalyzed >= MIN_SEGMENT_RACES_FOR_CHALLENGER
  );
}

export async function runEngineLearning(referenceDate = new Date()) {
  const windows = buildLearningWindows(referenceDate);
  const referenceIso = referenceDate.toISOString();
  const [trainWindow, testWindow, validationWindow] = await Promise.all(
    windows.map((window) => buildWindowSummary(window))
  );

  const testBySegment = new Map(
    testWindow.segments.map((segment) => [segment.segmentKey, segment] as const)
  );
  const validationBySegment = new Map(
    validationWindow.segments.map((segment) => [segment.segmentKey, segment] as const)
  );

  const candidateVersion = buildLearningCandidateVersion(referenceDate);
  const eligibleSegments = trainWindow.segments.filter(shouldCreateSegmentChallenger);
  const skippedSegments = trainWindow.segments
    .filter((segment) => !shouldCreateSegmentChallenger(segment))
    .map((segment) => ({
      segmentKey: segment.segmentKey,
      sampleSize: segment.sampleSize,
      racesAnalyzed: segment.racesAnalyzed,
      reason:
        segment.sampleSize < MIN_SEGMENT_SAMPLE_FOR_CHALLENGER
          ? "train-sample-insufficient"
          : "train-race-window-insufficient",
    }));

  const createdCandidates: Array<{
    segmentKey: SegmentKey;
    candidateId: string;
    candidateVersion: string;
    trainSampleSize: number;
    testSampleSize: number;
    validationSampleSize: number;
  }> = [];

  for (const trainSegment of eligibleSegments) {
    const testSegment = testBySegment.get(trainSegment.segmentKey) ?? null;
    const validationSegment = validationBySegment.get(trainSegment.segmentKey) ?? null;
    const existingState = await getSegmentLearningState(trainSegment.segmentKey, "MATIN");

    const candidate = await upsertEngineCandidate({
      segment_key: trainSegment.segmentKey,
      stage: "MATIN",
      engine_version: candidateVersion,
      parent_version: existingState?.stable_version ?? ENGINE_V6_VERSION,
      candidate_type: "CALIBRATION",
      status: "SHADOW",
      config_patch: {
        probabilityCalibration: {
          segments: {
            [trainSegment.segmentKey]: {
              bins: trainSegment.bins,
            },
          },
        },
      },
      summary: {
        learningSource: "stored-v6-snapshots",
        windows: {
          train: {
            start: trainWindow.startIso,
            end: trainWindow.endIso,
            sampleSize: trainSegment.sampleSize,
            racesAnalyzed: trainSegment.racesAnalyzed,
            roi: trainSegment.roi,
            hitRate: trainSegment.hitRate,
            calibrationError: trainSegment.calibrationError,
          },
          test: testSegment
            ? {
                start: testWindow.startIso,
                end: testWindow.endIso,
                sampleSize: testSegment.sampleSize,
                racesAnalyzed: testSegment.racesAnalyzed,
                roi: testSegment.roi,
                hitRate: testSegment.hitRate,
                calibrationError: testSegment.calibrationError,
              }
            : null,
          validation: validationSegment
            ? {
                start: validationWindow.startIso,
                end: validationWindow.endIso,
                sampleSize: validationSegment.sampleSize,
                racesAnalyzed: validationSegment.racesAnalyzed,
                roi: validationSegment.roi,
                hitRate: validationSegment.hitRate,
                calibrationError: validationSegment.calibrationError,
              }
            : null,
        },
        minSampleForPromotion: MIN_SEGMENT_SAMPLE_FOR_CHALLENGER,
      },
    } satisfies EngineCandidateRow);

    const metricRows: EngineCandidateMetricRow[] = [
      {
        candidate_id: candidate.id!,
        dataset_role: "TRAIN",
        window_start: trainWindow.startIso,
        window_end: trainWindow.endIso,
        sample_size: trainSegment.sampleSize,
        roi: trainSegment.roi,
        hit_rate: trainSegment.hitRate,
        false_positive_rate: trainSegment.falsePositiveRate,
        calibration_error: trainSegment.calibrationError,
        drawdown: trainSegment.drawdown,
      },
    ];

    if (testSegment) {
      metricRows.push({
        candidate_id: candidate.id!,
        dataset_role: "TEST",
        window_start: testWindow.startIso,
        window_end: testWindow.endIso,
        sample_size: testSegment.sampleSize,
        roi: testSegment.roi,
        hit_rate: testSegment.hitRate,
        false_positive_rate: testSegment.falsePositiveRate,
        calibration_error: testSegment.calibrationError,
        drawdown: testSegment.drawdown,
      });
    }

    if (validationSegment) {
      metricRows.push({
        candidate_id: candidate.id!,
        dataset_role: "VALIDATION",
        window_start: validationWindow.startIso,
        window_end: validationWindow.endIso,
        sample_size: validationSegment.sampleSize,
        roi: validationSegment.roi,
        hit_rate: validationSegment.hitRate,
        false_positive_rate: validationSegment.falsePositiveRate,
        calibration_error: validationSegment.calibrationError,
        drawdown: validationSegment.drawdown,
      });
    }

    await upsertEngineCandidateMetrics(metricRows);

    const learningState = buildNextLearningState(existingState, candidate, referenceIso);
    await upsertSegmentLearningState(learningState);

    createdCandidates.push({
      segmentKey: trainSegment.segmentKey,
      candidateId: candidate.id!,
      candidateVersion,
      trainSampleSize: trainSegment.sampleSize,
      testSampleSize: testSegment?.sampleSize ?? 0,
      validationSampleSize: validationSegment?.sampleSize ?? 0,
    });
  }

  return {
    success: true,
    stableVersion: ENGINE_V6_VERSION,
    candidateVersion,
    windows: {
      train: {
        startDate: trainWindow.startIso,
        endDate: trainWindow.endIso,
        runsAnalyzed: trainWindow.runsAnalyzed,
        scoreSnapshots: trainWindow.scoreSnapshots,
        outcomes: trainWindow.outcomes,
      },
      test: {
        startDate: testWindow.startIso,
        endDate: testWindow.endIso,
        runsAnalyzed: testWindow.runsAnalyzed,
        scoreSnapshots: testWindow.scoreSnapshots,
        outcomes: testWindow.outcomes,
      },
      validation: {
        startDate: validationWindow.startIso,
        endDate: validationWindow.endIso,
        runsAnalyzed: validationWindow.runsAnalyzed,
        scoreSnapshots: validationWindow.scoreSnapshots,
        outcomes: validationWindow.outcomes,
      },
    },
    createdCandidates,
    skippedSegments,
  };
}
