import test from "node:test";
import assert from "node:assert/strict";

import { buildPredictionStageSnapshot } from "../src/lib/prediction-store";
import type { PredictionRow, RaceAnalysis, RaceSummary, ScoredParticipant } from "../src/lib/types";

function createRunner(numPmu: number, overrides: Partial<ScoredParticipant> = {}): ScoredParticipant {
  return {
    numPmu,
    nom: `Cheval ${numPmu}`,
    driver: "A. Driver",
    entraineur: "B. Trainer",
    musique: "1121",
    scoreAlgo: 70 - numPmu,
    scoreForme: 65,
    scoreRegularite: 66,
    scoreAptitude: 68,
    scoreConnexions: 64,
    scoreFerrure: 5,
    scoreDistance: 6,
    scoreTerrain: 6,
    scoreHippo: 5,
    scoreCorde: 3,
    scoreLot: 3,
    indiceRegularite: 0.72,
    formeScore: 7.2,
    appetenceDistance: 0.61,
    appetenceTerrain: 0.5,
    appetenceHippo: 0.53,
    coeffTerrain: 1,
    coeffDistance: 1,
    coeffHippo: 1,
    tendanceScore: 1.1,
    cote: 4.5 + numPmu,
    coteMatin: 5 + numPmu,
    variationCote: -8,
    signalVariation: "BAISSE",
    historiquePositions: [1, 2, 3],
    gains: 120000,
    nombreCourses: 12,
    age: 5,
    sexe: "M",
    corde: null,
    handicapPoids: null,
    raceId: "R1C1",
    faultRate: 0.05,
    prediction: {
      scoreCheval: 70,
      scoreFinalPari: 78 - numPmu,
      confidenceAdjusted: 7.4,
      confidenceProbable: 0.28,
      confidenceImplied: 0.19,
      confidenceDelta: 0.09,
      confidenceGap: 0.11,
      confiance: 7.5,
      qualite: 68,
      value: 19,
      valueEffective: 17,
      objective: "GAGNE",
      decision: numPmu === 1 ? "VALIDE" : "SURVEILLANCE",
      typePariConseille: numPmu === 1 ? "GAGNANT" : "PLACE",
      outsider: false,
      miseConseillee: 4,
      raisons: ["forme", "engagement"],
      warningFlags: [],
    },
    ...overrides,
  };
}

test("buildPredictionStageSnapshot capture la selection et le favori marche", () => {
  const race: RaceSummary = {
    dateStr: "07042026",
    reunion: 1,
    course: 1,
    hippodrome: "Vincennes",
    pays: "FR",
    nomCourse: "Prix Snapshot",
    heureDepart: "14:30",
    discipline: "TROT ATTELE",
    estTrot: true,
    estPlat: false,
    estQuinte: false,
    allocation: 52000,
    distance: 2700,
    nombrePartants: 10,
    meteo: "soleil",
    terrain: "bon",
  };

  const ranking = [createRunner(1), createRunner(2, { cote: 3.2, coteMatin: 3.6 }), createRunner(3)];
  const analysis: RaceAnalysis = {
    top3: ranking.slice(0, 3),
    top5: ranking,
    ranking,
    favori: ranking[0],
    recommandation: {
      decision: "JOUER",
      horse: ranking[0],
      typePari: "GAGNANT",
      confidence: 7.5,
      comment: "Bonne base",
    },
    prediction: {
      lisibilite: "LISIBLE",
      scoreLisibilite: 16.2,
      coefficientLisibilite: 1.1,
      decisionCourse: "VALIDE",
      isPlayable: true,
      journeeSignal: "TOP",
    },
    scoreConfiance: {
      score: 7.5,
      reasons: ["value"],
    },
    alertes: [],
  };

  const rows: PredictionRow[] = ranking.map((runner) => ({
    date: "2026-04-07",
    reunion: 1,
    course: 1,
    hippodrome: "Vincennes",
    cheval_num: runner.numPmu,
    cheval_nom: runner.nom,
    score_cheval: runner.prediction.scoreCheval,
    score_final_pari: runner.prediction.scoreFinalPari,
    coefficient_lisibilite: analysis.prediction.coefficientLisibilite,
    confiance: runner.prediction.confiance,
    qualite: runner.prediction.qualite,
    lisibilite: analysis.prediction.lisibilite,
    value: runner.prediction.valueEffective,
    cote_matin: runner.coteMatin ?? null,
    cote_depart: runner.cote ?? null,
    variation_cote: runner.variationCote ?? null,
    signal_variation: runner.signalVariation ?? null,
    ferrure_ref: null,
    ferrure_t10: null,
    non_partant: false,
    decision: runner.prediction.decision,
    pari_conseille: runner.prediction.typePariConseille,
    outsider: runner.prediction.outsider,
    mise_simulee: runner.prediction.miseConseillee,
    resultat_place: null,
    resultat_gagnant: null,
    rapport_place: null,
    rapport_gagnant: null,
    gain_simule: null,
    stage: "MATIN",
  }));

  const snapshot = buildPredictionStageSnapshot("07042026", race, analysis, rows, "MATIN", ["note test"]);

  assert.equal(snapshot.selection_num, 1);
  assert.equal(snapshot.selection_decision, "VALIDE");
  assert.equal(snapshot.favori_num, 1);
  assert.equal(snapshot.market_favorite_num, 2);
  assert.deepEqual(snapshot.notes, ["note test"]);
});
