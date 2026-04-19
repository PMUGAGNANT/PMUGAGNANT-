import test from "node:test";
import assert from "node:assert/strict";

import {
  buildSubscribeTeasers,
  computeSubscribeRoiSummary,
  formatSubscribeRoi,
} from "../src/lib/subscribe-metrics";
import type { PredictionRow } from "../src/lib/types";

function createPrediction(overrides: Partial<PredictionRow> = {}): PredictionRow {
  return {
    date: "2026-04-18",
    reunion: 1,
    course: 1,
    hippodrome: "Vincennes",
    cheval_num: 7,
    cheval_nom: "Helios du Val",
    score_cheval: 82,
    score_final_pari: 84,
    coefficient_lisibilite: 1,
    confiance: 8.2,
    qualite: 82,
    lisibilite: "LISIBLE",
    value: 1.2,
    cote_matin: 4.5,
    cote_depart: 4.2,
    variation_cote: -4,
    signal_variation: "BAISSE",
    ferrure_ref: null,
    ferrure_t10: null,
    non_partant: false,
    decision: "VALIDE",
    pari_conseille: "GAGNANT",
    outsider: false,
    mise_simulee: 10,
    resultat_place: true,
    resultat_gagnant: true,
    rapport_place: 1.7,
    rapport_gagnant: 4.2,
    gain_simule: 42,
    stage: "RESULTAT",
    created_at: "2026-04-18T07:00:00.000Z",
    updated_at: "2026-04-18T08:00:00.000Z",
    ...overrides,
  };
}

test("buildSubscribeTeasers garde les derniers pronos jouables du jour", () => {
  const teasers = buildSubscribeTeasers([
    createPrediction({ cheval_num: 1, cheval_nom: "Ancien", updated_at: "2026-04-18T07:00:00.000Z" }),
    createPrediction({ cheval_num: 2, cheval_nom: "Rejet", decision: "REJET", updated_at: "2026-04-18T10:00:00.000Z" }),
    createPrediction({ cheval_num: 3, cheval_nom: "Recent", updated_at: "2026-04-18T11:00:00.000Z" }),
  ]);

  assert.equal(teasers.length, 2);
  assert.equal(teasers[0].cheval, "Recent");
  assert.equal(teasers[0].raceLabel, "R1C1");
  assert.equal(teasers[0].odds, 4.2);
});

test("computeSubscribeRoiSummary calcule le ROI sur les tickets regles", () => {
  const summary = computeSubscribeRoiSummary([
    createPrediction(),
    createPrediction({
      cheval_num: 8,
      resultat_gagnant: false,
      resultat_place: false,
      gain_simule: 0,
    }),
    createPrediction({
      cheval_num: 9,
      gain_simule: null,
      resultat_gagnant: null,
      resultat_place: null,
    }),
  ]);

  assert.equal(summary.bets, 2);
  assert.equal(summary.stake, 20);
  assert.equal(summary.gain, 42);
  assert.equal(summary.netGain, 22);
  assert.equal(summary.roi, 110);
  assert.equal(formatSubscribeRoi(summary.roi), "+110.0%");
});
