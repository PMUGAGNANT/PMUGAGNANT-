import test from "node:test";
import assert from "node:assert/strict";

import {
  buildLearningCandidateVersion,
  shouldCreateSegmentChallenger,
} from "../src/lib/engine-learning";

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
