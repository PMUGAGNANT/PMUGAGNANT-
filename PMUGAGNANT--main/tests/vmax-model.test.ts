import assert from "node:assert/strict";
import test from "node:test";

import {
  buildValueBets,
  computeRaceVerdict,
  computeRunnerKellyStake,
  formatStakeDetailLabel,
  formatStakeLabel,
  getScoreTier,
  getStakeTone,
  getVmaxRaceStatus,
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
  assert.equal(formatStakeLabel(null), "—");
  assert.equal(formatStakeDetailLabel(null), "Calcul en attente");
  assert.equal(getStakeTone(3.5), "low");
  assert.equal(getStakeTone(9), "medium");
  assert.equal(getStakeTone(22), "high");
});

test("computeRunnerKellyStake applique Kelly 25% pour les scores jouables", () => {
  assert.equal(computeRunnerKellyStake(80, 3, 100), 6);
  assert.equal(computeRunnerKellyStake(100, 100, 100), 1);
  assert.equal(computeRunnerKellyStake(100, 1.2, 100), 25);
  assert.equal(computeRunnerKellyStake(69, 4, 100), null);
  assert.equal(computeRunnerKellyStake(80, 1.1, 100), null);
  assert.equal(computeRunnerKellyStake(80, 3), null);
});

test("computeRaceVerdict transforme edge et cote en verdict immédiat", () => {
  const play = computeRaceVerdict({
    numero: 7,
    cheval: "Reine Esther",
    cote: 8,
    score: 92,
    bankroll: 100,
  });
  assert.equal(play.verdict, "JOUER");
  assert.ok(play.stake > 0);

  const pass = computeRaceVerdict({ numero: 3, cheval: "Beta", cote: 1.2, score: 50 });
  assert.equal(pass.verdict, "PASSER");
  assert.equal(pass.stake, 0);
});

test("getVmaxRaceStatus exposes ready soon live and finished windows", () => {
  assert.equal(getVmaxRaceStatus(null, 45), "ready");
  assert.equal(getVmaxRaceStatus(null, 20), "soon");
  assert.equal(getVmaxRaceStatus(null, 0), "live");
  assert.equal(getVmaxRaceStatus(null, -16), "finished");
  assert.equal(getVmaxRaceStatus("finished", 20), "finished");
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
