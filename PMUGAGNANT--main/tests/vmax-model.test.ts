import assert from "node:assert/strict";
import test from "node:test";

import {
  buildValueBets,
  formatStakeLabel,
  getScoreTier,
  getStakeTone,
  parseRaceAnalysisId,
} from "../src/features/vmax/vmax-model";

test("parseRaceAnalysisId accepts compact and separated race ids", () => {
  assert.deepEqual(parseRaceAnalysisId("r1c4"), { reunion: 1, course: 4 });
  assert.deepEqual(parseRaceAnalysisId("1-4"), { reunion: 1, course: 4 });
  assert.deepEqual(parseRaceAnalysisId("R2_C8"), { reunion: 2, course: 8 });
  assert.equal(parseRaceAnalysisId("bad"), null);
});

test("score and stake helpers expose stable UI tiers", () => {
  assert.equal(getScoreTier(93), "gold");
  assert.equal(getScoreTier(72), "green");
  assert.equal(getScoreTier(44), "neutral");
  assert.match(formatStakeLabel(3.5), /^3,50\s?€/);
  assert.equal(formatStakeLabel(null), "Calcul en attente");
  assert.equal(getStakeTone(3.5), "low");
  assert.equal(getStakeTone(9), "medium");
  assert.equal(getStakeTone(22), "high");
});

test("buildValueBets keeps only positive PMU edge opportunities", () => {
  const bets = buildValueBets([
    { numero: 1, cheval: "Alpha", cote: 6.2, scoreIa: 88 },
    { numero: 2, cheval: "Beta", cote: 1.3, scoreIa: 82 },
    { numero: 3, cheval: "Gamma", cote: null, scoreIa: 90 },
  ]);

  assert.equal(bets.length, 1);
  assert.equal(bets[0]?.cheval, "Alpha");
  assert.ok((bets[0]?.edgePct ?? 0) > 10);
});
