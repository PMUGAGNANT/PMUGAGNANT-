import assert from "node:assert/strict";
import test from "node:test";

import {
  buildScoringV10History,
  computeScoreV10ForParticipant,
  getScoreV10Decision,
  scoreDistance,
  scoreJockeyTrack,
  scoreRecentForm,
  scoreValueOdds,
} from "../src/lib/predictions/scoring-v10";
import type { Participant, RaceSummary } from "../src/lib/types";

function createRace(overrides: Partial<RaceSummary> = {}): RaceSummary {
  return {
    dateStr: "19042026",
    reunion: 1,
    course: 1,
    hippodrome: "Vincennes",
    pays: "FR",
    nomCourse: "Prix V10",
    heureDepart: "14:00",
    discipline: "TROT ATTELE",
    estTrot: true,
    estPlat: false,
    estQuinte: false,
    allocation: 50000,
    distance: 2700,
    nombrePartants: 12,
    terrain: "bon",
    meteo: "clair",
    ...overrides,
  };
}

function createParticipant(overrides: Partial<Participant> = {}): Participant {
  return {
    numPmu: 7,
    nom: "Reine Esther",
    driver: "A. Abrivard",
    jockey: "",
    entraineur: "T. Duvaldestin",
    age: 5,
    sexe: "F",
    cote: 7.2,
    coteMatin: 7.2,
    musique: "123",
    nombreCourses: 10,
    nombreVictoires: 3,
    nombrePlaces: 6,
    gainCarriere: 120000,
    nombreSuiveurs: 300,
    ordreArrivee: null,
    statut: "PARTANT",
    ...overrides,
  };
}

test("les critères V10 respectent les paliers documentés", () => {
  assert.equal(scoreRecentForm(3, 3), 25);
  assert.equal(scoreRecentForm(2, 3), 18);
  assert.equal(scoreRecentForm(null, 0), 8);
  assert.equal(scoreValueOdds(1.8), 5);
  assert.equal(scoreValueOdds(8), 25);
  assert.equal(scoreValueOdds(null), 10);
  assert.equal(scoreJockeyTrack(0.26, 4), 25);
  assert.equal(scoreJockeyTrack(0.04, 8), 3);
  assert.equal(scoreJockeyTrack(0.8, 2), 8);
  assert.equal(
    scoreDistance({
      horseSample: 3,
      exactDistanceSample: 2,
      exactDistanceTop3: true,
      closeDistanceSample: 0,
    }),
    25
  );
});

test("computeScoreV10ForParticipant additionne les 4 critères et décide", () => {
  const race = createRace();
  const participant = createParticipant();
  const history = buildScoringV10History(
    [
      {
        date: "2026-04-01",
        reunion: 1,
        course: 2,
        hippodrome: "Vincennes",
        discipline: "TROT ATTELE",
        distance: 2700,
      },
      {
        date: "2026-03-10",
        reunion: 1,
        course: 3,
        hippodrome: "Vincennes",
        discipline: "TROT ATTELE",
        distance: 2850,
      },
      {
        date: "2026-02-20",
        reunion: 2,
        course: 1,
        hippodrome: "Vincennes",
        discipline: "TROT ATTELE",
        distance: 2700,
      },
    ],
    [
      { date: "2026-04-01", reunion: 1, course: 2, cheval_num: 7, ordre_arrivee: 1 },
      { date: "2026-03-10", reunion: 1, course: 3, cheval_num: 7, ordre_arrivee: 2 },
      { date: "2026-02-20", reunion: 2, course: 1, cheval_num: 7, ordre_arrivee: 4 },
    ],
    [
      {
        date: "2026-04-01",
        reunion: 1,
        course: 2,
        cheval_num: 7,
        cheval_nom: "Reine Esther",
        payload: { participant: { driver: "A. Abrivard" } },
      },
      {
        date: "2026-03-10",
        reunion: 1,
        course: 3,
        cheval_num: 7,
        cheval_nom: "Reine Esther",
        payload: { participant: { driver: "A. Abrivard" } },
      },
      {
        date: "2026-02-20",
        reunion: 2,
        course: 1,
        cheval_num: 7,
        cheval_nom: "Reine Esther",
        payload: { participant: { driver: "A. Abrivard" } },
      },
    ]
  );

  const score = computeScoreV10ForParticipant(participant, race, history);

  assert.equal(score.scoreC1, 18);
  assert.equal(score.scoreC2, 25);
  assert.equal(score.scoreC3, 25);
  assert.equal(score.scoreC4, 25);
  assert.equal(score.scoreV10, 93);
  assert.equal(score.decision, "JOUER");
});

test("les seuils de décision V10 restent simples", () => {
  assert.equal(getScoreV10Decision(70), "JOUER");
  assert.equal(getScoreV10Decision(69), "SURVEILLER");
  assert.equal(getScoreV10Decision(49), "PASSER");
});
