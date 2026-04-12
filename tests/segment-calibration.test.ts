import test from "node:test";
import assert from "node:assert/strict";

import { DEFAULT_ALGO_PARAMETERS } from "../src/lib/config";
import { getProbabilityCalibrationMultiplier } from "../src/lib/engine/shared";
import type { AlgoParameters } from "../src/lib/types";

function buildParameters(): AlgoParameters {
  return {
    ...DEFAULT_ALGO_PARAMETERS,
    probabilityCalibration: {
      ...DEFAULT_ALGO_PARAMETERS.probabilityCalibration,
      bins: [{ min: 0, max: 1, multiplier: 0.95, sampleSize: 500 }],
      segments: {
        QUINTE: {
          bins: [{ min: 0, max: 1, multiplier: 1.2, sampleSize: 220 }],
          sampleSize: 220,
          roi: 8,
        },
      },
    },
  };
}

test("segment calibration priorise le multiplicateur du segment quand il existe", () => {
  const multiplier = getProbabilityCalibrationMultiplier(0.24, buildParameters(), "QUINTE");
  assert.equal(multiplier, 1.2);
});

test("segment calibration retombe sur le calibrage global quand le segment manque", () => {
  const multiplier = getProbabilityCalibrationMultiplier(
    0.24,
    buildParameters(),
    "TROT_ATTELE"
  );
  assert.equal(multiplier, 0.95);
});
