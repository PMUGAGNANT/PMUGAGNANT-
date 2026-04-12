import test from "node:test";
import assert from "node:assert/strict";

import { decideCandidatePromotion } from "../src/lib/engine-promotion";
import type { EngineCandidateMetricRow } from "../src/lib/types";

function createMetric(
  role: EngineCandidateMetricRow["dataset_role"],
  overrides: Partial<EngineCandidateMetricRow> = {}
): EngineCandidateMetricRow {
  return {
    candidate_id: "candidate-1",
    dataset_role: role,
    window_start: "2026-01-01",
    window_end: "2026-01-31",
    sample_size: 200,
    roi: 6,
    hit_rate: 35,
    false_positive_rate: 48,
    calibration_error: 0.08,
    drawdown: 12,
    ...overrides,
  };
}

test("decideCandidatePromotion approuve un challenger propre sur test et validation", () => {
  const decision = decideCandidatePromotion([
    createMetric("TRAIN"),
    createMetric("TEST", {
      sample_size: 180,
      roi: 7,
      false_positive_rate: 46,
      calibration_error: 0.07,
      drawdown: 10,
    }),
    createMetric("VALIDATION", {
      sample_size: 60,
      roi: 5,
      false_positive_rate: 50,
      calibration_error: 0.09,
      drawdown: 14,
    }),
  ]);

  assert.equal(decision.approved, true);
  assert.equal(decision.reason, "validated-for-promotion");
});

test("decideCandidatePromotion rejette un challenger si la validation regresse trop", () => {
  const decision = decideCandidatePromotion([
    createMetric("TRAIN"),
    createMetric("TEST", {
      sample_size: 180,
      roi: 7,
      false_positive_rate: 46,
      calibration_error: 0.07,
      drawdown: 10,
    }),
    createMetric("VALIDATION", {
      sample_size: 60,
      roi: -2,
      false_positive_rate: 60,
      calibration_error: 0.14,
      drawdown: 24,
    }),
  ]);

  assert.equal(decision.approved, false);
  assert.equal(decision.reason, "validation-calibration-regressed");
});

test("decideCandidatePromotion bloque une promotion sans metriques business exploitables", () => {
  const decision = decideCandidatePromotion([
    createMetric("TRAIN"),
    createMetric("TEST", {
      sample_size: 180,
      roi: null,
      hit_rate: null,
      false_positive_rate: null,
      calibration_error: 0.07,
      drawdown: 10,
    }),
    createMetric("VALIDATION", {
      sample_size: 60,
      roi: 5,
      hit_rate: 33,
      false_positive_rate: 50,
      calibration_error: 0.09,
      drawdown: 14,
    }),
  ]);

  assert.equal(decision.approved, false);
  assert.equal(decision.reason, "test-business-metrics-missing");
});
