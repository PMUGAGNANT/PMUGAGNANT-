import test from "node:test";
import assert from "node:assert/strict";

import { DEFAULT_ALGO_PARAMETERS } from "../src/lib/config";
import { determinerLisibilite } from "../src/lib/predictions";
import { parseMusic } from "../src/lib/predictions/music";
import {
  buildSignals,
  computeBaseHorseScore,
  determineRaceReadabilityScore,
} from "../src/lib/predictions/signals";
import type { Participant, RaceSummary, RunnerSignals, ScoredParticipant } from "../src/lib/types";

const SIGNAL_KEYS: Array<keyof RunnerSignals> = [
  "forme",
  "regularite",
  "victoire",
  "podium",
  "humain",
  "entraineur",
  "jockeyForme",
  "trainerTrack",
  "marche",
  "gains",
  "popularite",
  "stalle",
  "poids",
  "distance",
  "terrain",
  "meteo",
  "hippodrome",
  "ageSexe",
  "repos",
  "valueIntrinseque",
  "faute",
  "risque",
];

function createRace(overrides: Partial<RaceSummary> = {}): RaceSummary {
  return {
    dateStr: "15042026",
    reunion: 1,
    course: 1,
    hippodrome: "Vincennes",
    pays: "FR",
    nomCourse: "Prix Regression",
    heureDepart: "14:30",
    discipline: "TROT ATTELE",
    estTrot: true,
    estPlat: false,
    estQuinte: false,
    allocation: 52000,
    distance: 2700,
    nombrePartants: 12,
    meteo: "soleil",
    terrain: "bon",
    ...overrides,
  };
}

function createParticipant(overrides: Partial<Participant> = {}): Participant {
  return {
    numPmu: 1,
    nom: "Cheval Regression",
    driver: "J-M Bazire",
    entraineur: "A Fabre",
    jockey: "C Soumillon",
    age: 5,
    sexe: "M",
    cote: 4.2,
    musique: "11231",
    nombreCourses: 18,
    nombreVictoires: 5,
    nombrePlaces: 11,
    gainCarriere: 180000,
    nombreSuiveurs: 1200,
    ordreArrivee: null,
    statut: "PARTANT",
    placeCorde: 3,
    stalle: 3,
    poids: 55,
    ferrure: "DP",
    nonPartant: false,
    coteMatin: 5,
    coteDepart: 4.2,
    variationCote: -16,
    signalVariation: "BAISSE",
    formeRecenteAmelioree: true,
    tauxFaute: 0.05,
    terrainPreference: "bon",
    meteoPreference: "soleil",
    jockeyWinRate: 0.2,
    jockeyRecentForm: 0.3,
    trainerTrackWinRate: 0.18,
    distanceWinRate: 0.22,
    distancePlaceRate: 0.48,
    trackWinRate: 0.16,
    trackPlaceRate: 0.42,
    terrainWinRate: 0.18,
    terrainPlaceRate: 0.38,
    daysSinceLastRun: 18,
    ...overrides,
  };
}

function createScored(numPmu: number, scoreCheval: number, regularite: number, risque: number): ScoredParticipant {
  const participant = createParticipant({ numPmu });
  return {
    ...participant,
    score: scoreCheval,
    scoreAlgo: scoreCheval,
    scoreBlended: scoreCheval,
    estTocard: false,
    musicStats: parseMusic("11231"),
    signaux: {
      forme: 10,
      regularite,
      victoire: 8,
      podium: 8,
      humain: 0,
      entraineur: 0,
      jockeyForme: 6,
      trainerTrack: 4,
      marche: 5,
      gains: 5,
      popularite: 3,
      stalle: 2,
      poids: 1,
      distance: 6,
      terrain: 4,
      meteo: 2,
      hippodrome: 5,
      ageSexe: 3,
      repos: 2,
      valueIntrinseque: 4,
      faute: risque >= 9 ? 6 : 0,
      risque,
    },
    prediction: {
      scoreCheval,
      scoreBlended: scoreCheval,
      qualite: scoreCheval,
      confiance: 7,
      scoreFinalPari: scoreCheval,
      probaEstimee: scoreCheval / 100,
      probabiliteImplicite: 0.18,
      probabiliteValueSeuil: 0.2,
      valueCalculee: 0.1,
      valueEffective: 1,
      top3Potential: 70,
      top5Potential: 82,
      objective: "GAGNE",
      outsider: false,
      valueBet: true,
      marketEdge: 0.05,
      kellyFraction: 0.03,
      bankrollPct: 0.03,
      miseBase100: 3,
      action: "MISER",
      topFacteurs: ["forme"],
      decision: "VALIDE",
      typePariConseille: "GAGNANT",
      miseConseillee: 3,
    },
  };
}

test("buildSignals produit les 22 signaux moteur avec des valeurs finies", () => {
  const signals = buildSignals(
    createParticipant(),
    createRace(),
    parseMusic("11231"),
    DEFAULT_ALGO_PARAMETERS
  );

  assert.deepEqual(Object.keys(signals).sort(), [...SIGNAL_KEYS].sort());
  for (const key of SIGNAL_KEYS) {
    assert.equal(Number.isFinite(signals[key]), true, `${String(key)} doit etre fini`);
  }
  assert.ok(computeBaseHorseScore(signals) >= 0);
  assert.ok(computeBaseHorseScore(signals) <= 100);
});

test("les cas limites cote null, musique vide et partant pauvre restent bornes", () => {
  const sparse = createParticipant({
    cote: null,
    musique: "",
    nombreCourses: 0,
    nombreVictoires: 0,
    nombrePlaces: 0,
    gainCarriere: 0,
    nombreSuiveurs: 0,
    jockeyWinRate: null,
    trainerTrackWinRate: null,
    distanceWinRate: null,
    trackWinRate: null,
    terrainWinRate: null,
    daysSinceLastRun: null,
  });
  const signals = buildSignals(sparse, createRace(), parseMusic(sparse.musique), DEFAULT_ALGO_PARAMETERS);
  const score = computeBaseHorseScore(signals);

  assert.equal(signals.marche, 0);
  assert.equal(signals.valueIntrinseque, 0);
  assert.ok(score >= 0 && score <= 100);
});

test("les variantes obstacle et quinte restent calculables", () => {
  const participant = createParticipant({ musique: "Da0D9", tauxFaute: 0.55, cote: 28 });
  const obstacleSignals = buildSignals(
    participant,
    createRace({ discipline: "OBSTACLE HAIES", estTrot: false, estPlat: false, distance: 3600 }),
    parseMusic(participant.musique),
    DEFAULT_ALGO_PARAMETERS
  );
  const quinteSignals = buildSignals(
    createParticipant({ numPmu: 5, cote: 12 }),
    createRace({ estQuinte: true, nomCourse: "QUINTE Prix Regression", nombrePartants: 18 }),
    parseMusic("32145"),
    DEFAULT_ALGO_PARAMETERS
  );

  assert.ok(computeBaseHorseScore(obstacleSignals) >= 0);
  assert.ok(computeBaseHorseScore(quinteSignals) <= 100);
  assert.ok(obstacleSignals.risque >= quinteSignals.risque);
});

test("determineRaceReadabilityScore et determinerLisibilite couvrent LISIBLE COMPLEXE LOTERIE", () => {
  const readableRace = createRace({ nombrePartants: 9, terrain: "bon", meteo: "soleil" });
  const complexRace = createRace({ nombrePartants: 14, terrain: "lourd", meteo: "pluie" });
  const lotteryRace = createRace({
    discipline: "OBSTACLE HAIES",
    estTrot: false,
    estPlat: false,
    estQuinte: true,
    nombrePartants: 20,
    terrain: "lourd",
    meteo: "orage",
  });

  const readable = [createScored(1, 90, 12, 1), createScored(2, 78, 10, 2), createScored(3, 70, 9, 2)];
  const complex = [createScored(1, 60, 0, 4), createScored(2, 59, 0, 4), createScored(3, 58, 0, 4)];
  const lottery = [createScored(1, 50, -4, 12), createScored(2, 49, -4, 12), createScored(3, 48, -4, 12)];

  assert.ok(determineRaceReadabilityScore(readableRace, readable) >= 66);
  assert.equal(determinerLisibilite(readableRace, readable, DEFAULT_ALGO_PARAMETERS), "LISIBLE");
  assert.equal(determinerLisibilite(complexRace, complex, DEFAULT_ALGO_PARAMETERS), "COMPLEXE");
  assert.equal(determinerLisibilite(lotteryRace, lottery, DEFAULT_ALGO_PARAMETERS), "LOTERIE");
});
