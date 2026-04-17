import test from "node:test";
import assert from "node:assert/strict";

import {
  buildAdminLatestPredictions,
  buildAdminPerformanceGroups,
  computeAdminSuccessRate,
  findBestAdminRace,
} from "../src/lib/admin-dashboard";
import type { PredictionRow } from "../src/lib/types";

function createPrediction(overrides: Partial<PredictionRow> = {}): PredictionRow {
  return {
    date: "2026-04-01",
    reunion: 1,
    course: 1,
    hippodrome: "Vincennes",
    cheval_num: 1,
    cheval_nom: "Cheval 1",
    score_cheval: 72,
    score_blended: 74,
    score_final_pari: 72,
    coefficient_lisibilite: 1,
    confiance: 7.1,
    qualite: 72,
    lisibilite: "LISIBLE",
    value: 1.5,
    cote_matin: 4,
    cote_depart: 3.8,
    variation_cote: -5,
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
    rapport_place: 1.8,
    rapport_gagnant: 4,
    gain_simule: 40,
    stage: "RESULTAT",
    ...overrides,
  };
}

test("admin groups aggregate ROI and hit rate by label", () => {
  const rows = [
    createPrediction(),
    createPrediction({
      cheval_num: 2,
      cheval_nom: "Cheval 2",
      hippodrome: "Chantilly",
      pari_conseille: "PLACE",
      resultat_gagnant: false,
      resultat_place: true,
      gain_simule: 18,
    }),
    createPrediction({
      cheval_num: 3,
      cheval_nom: "Cheval 3",
      hippodrome: "Chantilly",
      pari_conseille: "PLACE",
      resultat_gagnant: false,
      resultat_place: false,
      gain_simule: 0,
    }),
  ];

  const groups = buildAdminPerformanceGroups(rows, (row) => row.hippodrome);
  const chantilly = groups.find((group) => group.label === "Chantilly");

  assert.equal(chantilly?.bets, 2);
  assert.equal(chantilly?.stake, 20);
  assert.equal(chantilly?.gain, 18);
  assert.equal(chantilly?.netGain, -2);
  assert.equal(chantilly?.hitRate, 50);
  assert.equal(computeAdminSuccessRate(rows), 66.67);
});

test("admin best race keeps the highest net gain", () => {
  const best = findBestAdminRace([
    createPrediction({ date: "2026-04-01", reunion: 1, course: 1, gain_simule: 20 }),
    createPrediction({
      date: "2026-04-02",
      reunion: 2,
      course: 3,
      hippodrome: "Auteuil",
      gain_simule: 70,
    }),
  ]);

  assert.equal(best?.raceLabel, "R2C3");
  assert.equal(best?.hippodrome, "Auteuil");
  assert.equal(best?.netGain, 60);
});

test("admin latest predictions exposes settled and pending status", () => {
  const latest = buildAdminLatestPredictions([
    createPrediction({
      date: "2026-04-02",
      reunion: 1,
      course: 2,
      resultat_gagnant: false,
      resultat_place: false,
      gain_simule: 0,
    }),
    createPrediction({
      date: "2026-04-03",
      reunion: 1,
      course: 3,
      resultat_gagnant: null,
      resultat_place: null,
      gain_simule: null,
    }),
  ]);

  assert.equal(latest[0]?.result, "EN_ATTENTE");
  assert.equal(latest[1]?.result, "PERDU");
});
