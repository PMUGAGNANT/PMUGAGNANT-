import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_SCORING_V101_WEIGHTS,
  computeScoreV101ForParticipant,
  getTemporalCoefficient,
} from "../src/lib/predictions/scoring-v10-1";
import { buildScoringV10History } from "../src/lib/predictions/scoring-v10";
import type { Participant, RaceSummary } from "../src/lib/types";

function createRace(overrides: Partial<RaceSummary> = {}): RaceSummary {
  return {
    dateStr: "19042026",
    reunion: 1,
    course: 1,
    hippodrome: "Vincennes",
    pays: "FR",
    nomCourse: "Prix V10.1",
    heureDepart: "15:00",
    discipline: "TROT ATTELE",
    estTrot: true,
    estPlat: false,
    estQuinte: false,
    allocation: 50000,
    distance: 2700,
    nombrePartants: 12,
    terrain: "bon",
    ...overrides,
  };
}

function createParticipant(overrides: Partial<Participant> = {}): Participant {
  return {
    numPmu: 5,
    nom: "Alpha Star",
    driver: "A. Pilot",
    jockey: "",
    entraineur: "B. Coach",
    age: 5,
    sexe: "M",
    cote: 8,
    coteMatin: 8,
    musique: "112",
    nombreCourses: 10,
    nombreVictoires: 3,
    nombrePlaces: 7,
    gainCarriere: 100000,
    nombreSuiveurs: 300,
    ordreArrivee: null,
    statut: "PARTANT",
    ...overrides,
  };
}

test("getTemporalCoefficient applique la désintégration demandée", () => {
  assert.equal(getTemporalCoefficient(10), 1);
  assert.equal(getTemporalCoefficient(45), 0.8);
  assert.equal(getTemporalCoefficient(120), 0.6);
  assert.equal(getTemporalCoefficient(250), 0.3);
  assert.equal(getTemporalCoefficient(400), 0.1);
});

test("computeScoreV101ForParticipant applique météo, momentum, foule et mémoire piste", () => {
  const race = createRace();
  const participant = createParticipant();
  const history = buildScoringV10History(
    [
      {
        date: "2026-04-13",
        reunion: 1,
        course: 2,
        hippodrome: "Vincennes",
        discipline: "TROT ATTELE",
        distance: 2700,
        terrain: "bon",
      },
      {
        date: "2026-04-12",
        reunion: 1,
        course: 3,
        hippodrome: "Vincennes",
        discipline: "TROT ATTELE",
        distance: 2700,
        terrain: "bon",
      },
      {
        date: "2026-04-14",
        reunion: 1,
        course: 4,
        hippodrome: "Vincennes",
        discipline: "TROT ATTELE",
        distance: 2700,
        terrain: "bon",
      },
    ],
    [
      { date: "2026-04-13", reunion: 1, course: 2, cheval_num: 5, ordre_arrivee: 1 },
      { date: "2026-04-12", reunion: 1, course: 3, cheval_num: 5, ordre_arrivee: 1 },
      { date: "2026-04-14", reunion: 1, course: 4, cheval_num: 5, ordre_arrivee: 1 },
    ],
    [
      {
        date: "2026-04-13",
        reunion: 1,
        course: 2,
        cheval_num: 5,
        cheval_nom: "Alpha Star",
        payload: { participant: { driver: "A. Pilot" } },
      },
      {
        date: "2026-04-12",
        reunion: 1,
        course: 3,
        cheval_num: 5,
        cheval_nom: "Alpha Star",
        payload: { participant: { driver: "A. Pilot" } },
      },
      {
        date: "2026-04-14",
        reunion: 1,
        course: 4,
        cheval_num: 5,
        cheval_nom: "Alpha Star",
        payload: { participant: { driver: "A. Pilot" } },
      },
    ]
  );

  const score = computeScoreV101ForParticipant(
    participant,
    race,
    history,
    {
      globalWeights: DEFAULT_SCORING_V101_WEIGHTS,
      roleWeights: {},
      hippodromeWeights: {},
    },
    0.3
  );

  assert.equal(score.terrainEffect, "BONUS");
  assert.equal(score.jockeyMomentum, "BONUS");
  assert.equal(score.crowdEffect, "BONUS");
  assert.equal(score.trackMemory, "BONUS");
  assert.ok(score.scoreV101 >= 90);
});
