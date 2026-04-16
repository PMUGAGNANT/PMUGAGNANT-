import test from "node:test";
import assert from "node:assert/strict";

import { DEFAULT_ALGO_PARAMETERS } from "../src/lib/config";
import { blendScore } from "../src/lib/engine/blend";
import type { AlgoParameters } from "../src/lib/types";

function buildParameters(multiplier: number): AlgoParameters {
  return {
    ...DEFAULT_ALGO_PARAMETERS,
    probabilityCalibration: {
      ...DEFAULT_ALGO_PARAMETERS.probabilityCalibration,
      segments: {
        TROT_ATTELE: {
          bins: [{ min: 0, max: 1, multiplier, sampleSize: 200 }],
          sampleSize: 200,
          roi: 4,
        },
      },
    },
  };
}

test("blendScore applique la calibration segmentee sur la probabilite estimee", () => {
  assert.equal(blendScore(50, "TROT_ATTELE", buildParameters(1.2)), 60);
});

test("blendScore retourne le score expert sans calibration de segment", () => {
  assert.equal(blendScore(50, "QUINTE", buildParameters(1.2)), 50);
});

test("blendScore garde le meme score avec un multiplicateur neutre", () => {
  assert.equal(blendScore(72, "TROT_ATTELE", buildParameters(1)), 72);
});
