import assert from "node:assert/strict";
import test from "node:test";

import { buildLiveStatsSnapshotFromPredictions } from "../src/lib/live-stats";
import type { PredictionRow } from "../src/lib/types";

function createPrediction(overrides: Partial<PredictionRow> = {}): PredictionRow {
  return {
    date: "2026-04-15",
    reunion: 1,
    course: 1,
    hippodrome: "Vincennes",
    cheval_num: 1,
    cheval_nom: "Helios du Val",
    score_cheval: 78,
    score_blended: 80,
    score_final_pari: 82,
    coefficient_lisibilite: 1,
    confiance: 8.2,
    qualite: 78,
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
    updated_at: "2026-04-15T18:00:00.000Z",
    ...overrides,
  };
}

test("buildLiveStatsSnapshotFromPredictions calcule les preuves marketing depuis les predictions Supabase", () => {
  const snapshot = buildLiveStatsSnapshotFromPredictions(
    [
      createPrediction({
        date: "2026-04-08",
        course: 1,
        cheval_num: 3,
        mise_simulee: 5,
        gain_simule: 15,
      }),
      createPrediction({
        date: "2026-04-14",
        course: 2,
        cheval_num: 4,
        resultat_place: false,
        resultat_gagnant: false,
        mise_simulee: 10,
        gain_simule: 0,
        updated_at: "2026-04-14T18:00:00.000Z",
      }),
      createPrediction(),
      createPrediction({
        decision: "REJET",
        cheval_num: 9,
        mise_simulee: 0,
        gain_simule: 0,
      }),
    ],
    "2026-04-15",
    "2026-04-15T20:00:00.000Z"
  );

  assert.equal(snapshot.available, true);
  assert.equal(snapshot.totalPredictions, 3);
  assert.equal(snapshot.winCount, 2);
  assert.equal(snapshot.winRate, 66.7);
  assert.equal(snapshot.roi30d, 120);
  assert.equal(snapshot.netGain30d, 30);
  assert.equal(snapshot.totalStake30d, 25);
  assert.equal(snapshot.totalGain30d, 55);
  assert.equal(snapshot.predictions7d, 2);
  assert.equal(snapshot.activeSubscribersThisMonth, 0);
  assert.equal(snapshot.roi7d, 100);
  assert.equal(snapshot.netGain7d, 20);
  assert.equal(snapshot.todayPredictions, 1);
  assert.equal(snapshot.todayWins, 1);
});

test("buildLiveStatsSnapshotFromPredictions retourne un snapshot vide sans ticket valide", () => {
  const snapshot = buildLiveStatsSnapshotFromPredictions(
    [createPrediction({ decision: "REJET", mise_simulee: 0, gain_simule: 0 })],
    "2026-04-15",
    "2026-04-15T20:00:00.000Z"
  );

  assert.equal(snapshot.available, false);
  assert.equal(snapshot.totalPredictions, 0);
  assert.equal(snapshot.roi30d, 0);
  assert.equal(snapshot.netGain7d, 0);
  assert.equal(snapshot.lastUpdated, "2026-04-15T20:00:00.000Z");
});
