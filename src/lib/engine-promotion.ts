import {
  getSegmentLearningState,
  insertEnginePromotion,
  listEngineCandidateMetricsByCandidateIds,
  listEngineCandidatesByStatus,
  replaceActiveSegmentCalibration,
  updateEngineCandidateStatus,
  upsertSegmentLearningState,
} from "@/lib/prediction-store";
import type {
  CandidatePromotionDecision,
  EngineCandidateMetricRow,
  EngineCandidateRow,
  SegmentLearningStateRow,
} from "@/lib/types";

const MIN_TEST_SAMPLE = 100;
const MIN_VALIDATION_SAMPLE = 30;

function getMetricByRole(
  metrics: EngineCandidateMetricRow[],
  role: EngineCandidateMetricRow["dataset_role"]
) {
  return metrics.find((metric) => metric.dataset_role === role) ?? null;
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function hasBusinessMetrics(metric: EngineCandidateMetricRow) {
  return (
    metric.roi !== null &&
    metric.roi !== undefined &&
    metric.hit_rate !== null &&
    metric.hit_rate !== undefined &&
    metric.false_positive_rate !== null &&
    metric.false_positive_rate !== undefined
  );
}

function shouldDeferPromotion(reason: string) {
  return [
    "missing-test-window",
    "missing-validation-window",
    "test-sample-insufficient",
    "validation-sample-insufficient",
    "test-business-metrics-missing",
    "validation-business-metrics-missing",
  ].includes(reason);
}

export function decideCandidatePromotion(
  metrics: EngineCandidateMetricRow[]
): CandidatePromotionDecision {
  const testMetric = getMetricByRole(metrics, "TEST");
  const validationMetric = getMetricByRole(metrics, "VALIDATION");

  if (!testMetric) {
    return {
      approved: false,
      reason: "missing-test-window",
      testMetric,
      validationMetric,
    };
  }

  if (!validationMetric) {
    return {
      approved: false,
      reason: "missing-validation-window",
      testMetric,
      validationMetric,
    };
  }

  if (testMetric.sample_size < MIN_TEST_SAMPLE) {
    return {
      approved: false,
      reason: "test-sample-insufficient",
      testMetric,
      validationMetric,
    };
  }

  if (validationMetric.sample_size < MIN_VALIDATION_SAMPLE) {
    return {
      approved: false,
      reason: "validation-sample-insufficient",
      testMetric,
      validationMetric,
    };
  }

  if (!hasBusinessMetrics(testMetric)) {
    return {
      approved: false,
      reason: "test-business-metrics-missing",
      testMetric,
      validationMetric,
    };
  }

  if (!hasBusinessMetrics(validationMetric)) {
    return {
      approved: false,
      reason: "validation-business-metrics-missing",
      testMetric,
      validationMetric,
    };
  }

  const testCalibration = testMetric.calibration_error ?? 1;
  const validationCalibration = validationMetric.calibration_error ?? 1;
  if (validationCalibration > testCalibration + 0.03) {
    return {
      approved: false,
      reason: "validation-calibration-regressed",
      testMetric,
      validationMetric,
    };
  }

  const testFalsePositive = testMetric.false_positive_rate ?? 100;
  const validationFalsePositive = validationMetric.false_positive_rate ?? 100;
  if (validationFalsePositive > testFalsePositive + 8) {
    return {
      approved: false,
      reason: "validation-false-positive-regressed",
      testMetric,
      validationMetric,
    };
  }

  const testDrawdown = testMetric.drawdown ?? 0;
  const validationDrawdown = validationMetric.drawdown ?? 0;
  if (validationDrawdown > round2(testDrawdown * 1.25 + 5)) {
    return {
      approved: false,
      reason: "validation-drawdown-regressed",
      testMetric,
      validationMetric,
    };
  }

  const testRoi = testMetric.roi ?? 0;
  const validationRoi = validationMetric.roi ?? 0;
  if (validationRoi < testRoi - 5) {
    return {
      approved: false,
      reason: "validation-roi-regressed",
      testMetric,
      validationMetric,
    };
  }

  return {
    approved: true,
    reason: "validated-for-promotion",
    testMetric,
    validationMetric,
  };
}

function getCandidateSegmentBins(candidate: EngineCandidateRow) {
  const probabilityCalibration =
    (candidate.config_patch?.probabilityCalibration as Record<string, unknown> | undefined) ??
    null;
  const segments =
    (probabilityCalibration?.segments as Record<string, unknown> | undefined) ?? null;
  const segmentPayload =
    (segments?.[candidate.segment_key] as Record<string, unknown> | undefined) ?? null;
  const bins = Array.isArray(segmentPayload?.bins) ? segmentPayload.bins : [];
  return bins as Array<{
    min: number;
    max: number;
    multiplier: number;
    sampleSize?: number;
  }>;
}

export async function runEnginePromotion(referenceDate = new Date()) {
  const candidates = await listEngineCandidatesByStatus("SHADOW", "MATIN");
  const candidateIds = candidates
    .map((candidate) => candidate.id)
    .filter((candidateId): candidateId is string => Boolean(candidateId));
  const metrics = await listEngineCandidateMetricsByCandidateIds(candidateIds);

  const metricsByCandidate = new Map<string, EngineCandidateMetricRow[]>();
  for (const metric of metrics) {
    const current = metricsByCandidate.get(metric.candidate_id) ?? [];
    current.push(metric);
    metricsByCandidate.set(metric.candidate_id, current);
  }

  const promoted: Array<{ candidateId: string; segmentKey: string; version: string }> = [];
  const rejected: Array<{ candidateId: string; segmentKey: string; reason: string }> = [];
  const deferred: Array<{ candidateId: string; segmentKey: string; reason: string }> = [];

  for (const candidate of candidates) {
    if (!candidate.id) {
      continue;
    }

    const candidateMetrics = metricsByCandidate.get(candidate.id) ?? [];
    const decision = decideCandidatePromotion(candidateMetrics);

    if (!decision.testMetric || !decision.validationMetric) {
      deferred.push({
        candidateId: candidate.id,
        segmentKey: candidate.segment_key,
        reason: decision.reason,
      });
      continue;
    }

    if (!decision.approved) {
      if (shouldDeferPromotion(decision.reason)) {
        deferred.push({
          candidateId: candidate.id,
          segmentKey: candidate.segment_key,
          reason: decision.reason,
        });
        continue;
      }

      const existingState = await getSegmentLearningState(candidate.segment_key, candidate.stage);
      await updateEngineCandidateStatus(candidate.id, "REJECTED", null);
      await insertEnginePromotion({
        candidate_id: candidate.id,
        decision: "REJECTED",
        reason: decision.reason,
      });
      await upsertSegmentLearningState({
        segment_key: candidate.segment_key,
        stage: candidate.stage,
        stable_version: existingState?.stable_version ?? candidate.parent_version,
        challenger_version: null,
        active_calibration_version:
          existingState?.active_calibration_version ??
          existingState?.stable_version ??
          candidate.parent_version,
        last_learning_run_at: referenceDate.toISOString(),
        last_promotion_at: existingState?.last_promotion_at ?? null,
      } satisfies SegmentLearningStateRow);
      rejected.push({
        candidateId: candidate.id,
        segmentKey: candidate.segment_key,
        reason: decision.reason,
      });
      continue;
    }

    const promotedAt = referenceDate.toISOString();
    const bins = getCandidateSegmentBins(candidate);
    await replaceActiveSegmentCalibration({
      segment_key: candidate.segment_key,
      stage: candidate.stage,
      engine_version: candidate.engine_version,
      bin_definition: { source: "engine_candidate_metrics" },
      calibration_payload: { bins },
      sample_size: decision.validationMetric.sample_size,
      brier_score: decision.validationMetric.calibration_error ?? null,
      log_loss: null,
      roi_30d: decision.validationMetric.roi ?? null,
      is_active: true,
    });
    await updateEngineCandidateStatus(candidate.id, "PROMOTED", promotedAt);
    await insertEnginePromotion({
      candidate_id: candidate.id,
      decision: "PROMOTED",
      reason: decision.reason,
      decided_at: promotedAt,
    });
    await upsertSegmentLearningState({
      segment_key: candidate.segment_key,
      stage: candidate.stage,
      stable_version: candidate.engine_version,
      challenger_version: null,
      active_calibration_version: candidate.engine_version,
      last_learning_run_at: referenceDate.toISOString(),
      last_promotion_at: promotedAt,
    } satisfies SegmentLearningStateRow);
    promoted.push({
      candidateId: candidate.id,
      segmentKey: candidate.segment_key,
      version: candidate.engine_version,
    });
  }

  return {
    success: true,
    promoted,
    rejected,
    deferred,
    shadowCandidatesSeen: candidates.length,
  };
}
