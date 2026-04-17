import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDailyRecapSummary,
  formatDailyRecapTelegram,
} from "../src/lib/daily-recap";
import type { PredictionRow } from "../src/lib/types";

function createPrediction(overrides: Partial<PredictionRow> = {}): PredictionRow {
  return {
    date: "2026-04-17",
    reunion: 1,
    course: 1,
    hippodrome: "Vincennes",
    cheval_num: 7,
    cheval_nom: "Helios du Val",
    score_cheval: 80,
    score_blended: 82,
    score_final_pari: 84,
    coefficient_lisibilite: 1,
    confiance: 8.4,
    qualite: 80,
    lisibilite: "LISIBLE",
    value: 1.6,
    cote_matin: 4,
    cote_depart: 4,
    variation_cote: 0,
    signal_variation: null,
    ferrure_ref: null,
    ferrure_t10: null,
    non_partant: false,
    decision: "VALIDE",
    pari_conseille: "GAGNANT",
    outsider: false,
    mise_simulee: 10,
    resultat_place: true,
    resultat_gagnant: true,
    rapport_place: 1.6,
    rapport_gagnant: 4,
    gain_simule: 40,
    stage: "RESULTAT",
    updated_at: "2026-04-17T18:00:00.000Z",
    ...overrides,
  };
}

test("buildDailyRecapSummary calcule le ROI journalier et les tickets", () => {
  const summary = buildDailyRecapSummary(
    [
      createPrediction(),
      createPrediction({
        course: 2,
        cheval_num: 3,
        cheval_nom: "Nacre du Parc",
        pari_conseille: "PLACE",
        resultat_gagnant: false,
        resultat_place: true,
        mise_simulee: 8,
        gain_simule: 14,
      }),
      createPrediction({
        course: 3,
        cheval_num: 8,
        cheval_nom: "Bolero",
        resultat_gagnant: false,
        resultat_place: false,
        mise_simulee: 6,
        gain_simule: 0,
      }),
      createPrediction({
        course: 4,
        cheval_num: 12,
        decision: "REJET",
        mise_simulee: 0,
        gain_simule: 0,
      }),
    ],
    "2026-04-17"
  );

  assert.equal(summary.success, true);
  assert.equal(summary.date, "17042026");
  assert.equal(summary.settledPredictions, 4);
  assert.equal(summary.playedPredictions, 3);
  assert.equal(summary.wins, 1);
  assert.equal(summary.places, 1);
  assert.equal(summary.losses, 1);
  assert.equal(summary.totalStake, 24);
  assert.equal(summary.totalGain, 54);
  assert.equal(summary.netGain, 30);
  assert.equal(summary.roi, 125);
  assert.equal(summary.hitRate, 66.67);
  assert.equal(summary.bestTickets[0]?.cheval, "#7 Helios du Val");
});

test("formatDailyRecapTelegram resume le recap pour Telegram", () => {
  const summary = buildDailyRecapSummary([createPrediction()], "2026-04-17");
  const message = formatDailyRecapTelegram(summary);

  assert.match(message, /Recap journalier 17042026/);
  assert.match(message, /ROI : \+300\.0%/);
  assert.match(message, /Meilleurs tickets/);
  assert.match(message, /R1C1 Vincennes #7 Helios du Val/);
});
