import test from "node:test";
import assert from "node:assert/strict";

import {
  buildLearningCandidateVersion,
  shouldCreateSegmentChallenger,
} from "../src/lib/engine-learning";
import { buildLearningWindows } from "../src/lib/learning-windows";

test("buildLearningWindows decoupe bien train test validation sur 24m 6m 30j", () => {
  const windows = buildLearningWindows(new Date("2026-04-09T07:00:00.000Z"));

  assert.deepEqual(windows, [
    { role: "TRAIN", startIso: "2024-04-09", endIso: "2025-10-10" },
    { role: "TEST", startIso: "2025-10-11", endIso: "2026-03-09" },
    { role: "VALIDATION", startIso: "2026-03-10", endIso: "2026-04-08" },
  ]);
});

test("buildLearningCandidateVersion construit une version shadow stable par jour", () => {
  const version = buildLearningCandidateVersion(new Date("2026-04-09T07:00:00.000Z"));
  assert.equal(version, "v6-phase1-shadow-20260409");
});

test("shouldCreateSegmentChallenger bloque les segments avec trop peu de donnees", () => {
  assert.equal(
    shouldCreateSegmentChallenger({
      segmentKey: "QUINTE",
      sampleSize: 120,
      roi30d: 4,
      hitRate: 32,
      calibrationError: 0.08,
      racesAnalyzed: 18,
      bins: [],
    }),
    false
  );

  assert.equal(
    shouldCreateSegmentChallenger({
      segmentKey: "QUINTE",
      sampleSize: 180,
      roi30d: 4,
      hitRate: 32,
      calibrationError: 0.08,
      racesAnalyzed: 18,
      bins: [],
    }),
    true
  );
});
