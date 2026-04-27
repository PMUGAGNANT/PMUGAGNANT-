import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDashboardHeroModel,
  buildDashboardRaces,
  getHeroRace,
  matchesDashboardFilter,
  matchesDashboardSearch,
} from "../src/features/dashboard/lib/dashboard-page-model";
import type { PredictionRow, RaceSummary } from "../src/lib/types";

function createRace(overrides: Partial<RaceSummary> = {}): RaceSummary {
  return {
    dateStr: "2026-04-23",
    reunion: 1,
    course: 1,
    hippodrome: "Auteuil",
    pays: "FR",
    nomCourse: "Prix Test",
    heureDepart: "15:40",
    discipline: "Plat",
    estTrot: false,
    estPlat: true,
    estQuinte: false,
    allocation: 52000,
    distance: 2400,
    nombrePartants: 12,
    meteo: null,
    terrain: null,
    ...overrides,
  };
}

function createPrediction(overrides: Partial<PredictionRow> = {}): PredictionRow {
  return {
    date: "2026-04-23",
    reunion: 1,
    course: 1,
    hippodrome: "Auteuil",
    cheval_num: 1,
    cheval_nom: "Alpha",
    score_cheval: 70,
    score_blended: 70,
    score_final_pari: 70,
    coefficient_lisibilite: 0.7,
    confiance: 7.2,
    qualite: 0.8,
    lisibilite: "LISIBLE",
    value: 6,
    cote_matin: 5,
    cote_depart: 5,
    variation_cote: 0,
    signal_variation: "STABLE",
    ferrure_ref: null,
    ferrure_t10: null,
    non_partant: false,
    decision: "VALIDE",
    pari_conseille: "GAGNANT",
    outsider: false,
    mise_simulee: 8,
    resultat_place: null,
    resultat_gagnant: null,
    rapport_place: null,
    rapport_gagnant: null,
    gain_simule: null,
    avis_texte: null,
    avis_note: null,
    avis_verdict: null,
    avis_pari_type: null,
    avis_generated_at: null,
    stage: "RESULTAT",
    ...overrides,
  };
}

test("buildDashboardRaces construit une course lisible avec confiance et numeros", () => {
  const race = createRace({ reunion: 2, course: 4, hippodrome: "Compiegne" });
  const predictions = [
    createPrediction({ reunion: 2, course: 4, cheval_num: 6, cheval_nom: "Falco", confiance: 7.6, score_cheval: 76, score_blended: 76, mise_simulee: 10 }),
    createPrediction({ reunion: 2, course: 4, cheval_num: 2, cheval_nom: "Orion", decision: "SURVEILLANCE", score_cheval: 63, score_blended: 63, mise_simulee: 0 }),
    createPrediction({ reunion: 2, course: 4, cheval_num: 8, cheval_nom: "Nox", decision: "REJET", score_cheval: 34, score_blended: 34, mise_simulee: 0 }),
  ];

  const [item] = buildDashboardRaces([race], predictions, new Map());

  assert.equal(item.confidence, 76);
  assert.deepEqual(item.topNumbers, [6, 2]);
  assert.equal(matchesDashboardSearch(item, "falco"), true);
});

test("buildDashboardHeroModel separe bases outsiders et chevaux a ecarter", () => {
  const race = createRace({ reunion: 3, course: 5, nomCourse: "Prix Lecture" });
  const hero = {
    race,
    predictions: [
      createPrediction({ reunion: 3, course: 5, cheval_num: 1, cheval_nom: "Base One", score_cheval: 81, score_blended: 81, mise_simulee: 8, cote_depart: 4.2 }),
      createPrediction({ reunion: 3, course: 5, cheval_num: 4, cheval_nom: "Base Two", score_cheval: 74, score_blended: 74, mise_simulee: 6, cote_depart: 5.1 }),
      createPrediction({ reunion: 3, course: 5, cheval_num: 7, cheval_nom: "Outsider", decision: "SURVEILLANCE", outsider: true, score_cheval: 58, score_blended: 58, mise_simulee: 0, cote_depart: 14 }),
      createPrediction({ reunion: 3, course: 5, cheval_num: 9, cheval_nom: "A Ecarter", decision: "REJET", score_cheval: 29, score_blended: 29, mise_simulee: 0, cote_depart: 25 }),
    ],
    status: "ready" as const,
    confidence: 81,
    topNumbers: [1, 4, 7],
    raceType: "ALL" as const,
    searchText: "PRIX LECTURE BASE ONE",
  };

  const model = buildDashboardHeroModel(hero);

  assert.ok(model);
  assert.equal(model?.verdict, "JOUER");
  assert.deepEqual(model?.bases.map((item) => item.numero), [1, 4]);
  assert.deepEqual(model?.outsiders.map((item) => item.numero), [7]);
  assert.deepEqual(model?.eliminations.map((item) => item.numero), [9]);
});

test("getHeroRace privilegie le quinte non termine puis les filtres restent coherents", () => {
  const regular = {
    race: createRace({ reunion: 1, course: 2, nomCourse: "Prix Ordinaire" }),
    predictions: [createPrediction({ reunion: 1, course: 2, cheval_num: 3, score_cheval: 88, score_blended: 88, confiance: 8.8 })],
    status: "ready" as const,
    confidence: 88,
    topNumbers: [3],
    raceType: "ALL" as const,
    searchText: "PRIX ORDINAIRE",
  };
  const quinte = {
    race: createRace({ reunion: 1, course: 4, nomCourse: "Grand Quinte", estQuinte: true }),
    predictions: [createPrediction({ reunion: 1, course: 4, cheval_num: 5, cheval_nom: "Quinte King", score_cheval: 64, score_blended: 64, confiance: 6.4 })],
    status: "soon" as const,
    confidence: 64,
    topNumbers: [5],
    raceType: "QUINTE" as const,
    searchText: "GRAND QUINTE QUINTE KING",
  };

  const hero = getHeroRace([regular, quinte]);

  assert.equal(hero?.race.nomCourse, "Grand Quinte");
  assert.equal(matchesDashboardFilter(quinte, "QUINTE"), true);
  assert.equal(matchesDashboardFilter(regular, "QUINTE"), false);
});
