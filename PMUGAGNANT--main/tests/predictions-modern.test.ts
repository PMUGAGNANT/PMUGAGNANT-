import test from "node:test";
import assert from "node:assert/strict";

import { DEFAULT_ALGO_PARAMETERS } from "../src/lib/config";
import { analyzeRaceWithParameters, getRaceStatus } from "../src/lib/predictions";
import { determineRaceReadabilityScore } from "../src/lib/predictions/signals";
import { buildValue, determineHorseDecision } from "../src/lib/predictions/strategy";
import {
  SCORING_ALGO_VERSION,
  getValueConfirmationMultiplier,
} from "../src/lib/predictions/shared";
import type { Participant, RaceSummary, ScoredParticipant } from "../src/lib/types";

function createRace(overrides: Partial<RaceSummary> = {}): RaceSummary {
  return {
    dateStr: "07042026",
    reunion: 1,
    course: 1,
    hippodrome: "Vincennes",
    pays: "FR",
    nomCourse: "Prix Test",
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

function createParticipant(
  numPmu: number,
  overrides: Partial<Participant> = {}
): Participant {
  return {
    numPmu,
    nom: `Cheval ${numPmu}`,
    driver: "A. Driver",
    entraineur: "B. Trainer",
    jockey: "",
    age: 5,
    sexe: "M",
    cote: 4.5,
    musique: "11231",
    nombreCourses: 12,
    nombreVictoires: 4,
    nombrePlaces: 7,
    gainCarriere: 120000,
    nombreSuiveurs: 850,
    ordreArrivee: null,
    statut: "PARTANT",
    placeCorde: null,
    stalle: null,
    poids: null,
    ferrure: "DP",
    nonPartant: false,
    coteMatin: 5.2,
    coteDepart: 4.5,
    variationCote: -13.5,
    signalVariation: "BAISSE",
    formeRecenteAmelioree: true,
    tauxFaute: 0.05,
    terrainPreference: "bon",
    meteoPreference: "soleil",
    jockeyWinRate: null,
    jockeyRecentForm: null,
    trainerTrackWinRate: 0.21,
    distanceWinRate: 0.24,
    distancePlaceRate: 0.52,
    trackWinRate: 0.2,
    trackPlaceRate: 0.44,
    terrainWinRate: 0.18,
    terrainPlaceRate: 0.4,
    daysSinceLastRun: 18,
    ...overrides,
  };
}

function createScoredParticipant(
  numPmu: number,
  scoreCheval: number,
  regularite: number,
  risque: number
): ScoredParticipant {
  const participant = createParticipant(numPmu);

  return {
    ...participant,
    score: scoreCheval,
    scoreAlgo: scoreCheval,
    estTocard: false,
    musicStats: {
      recentPositions: [1, 2, 1, 3, 2],
      nbVictoires: 2,
      nbPodiums: 5,
      nbDQ: 0,
      nbAbandons: 0,
      fiabilite: 1,
      averagePosition: 1.8,
      serie: 3,
      trend: 0.8,
      ratioForme: 0.9,
    },
    signaux: {
      forme: 10,
      regularite,
      victoire: 8,
      podium: 7,
      humain: 6,
      entraineur: 5,
      jockeyForme: 0,
      trainerTrack: 4,
      marche: 5,
      gains: 4,
      popularite: 3,
      stalle: 0,
      poids: 0,
      distance: 6,
      terrain: 3,
      meteo: 2,
      hippodrome: 5,
      ageSexe: 2,
      repos: 3,
      valueIntrinseque: 5,
      risque,
      faute: 0,
    },
    prediction: {
      scoreCheval,
      qualite: scoreCheval,
      confiance: 7.2,
      scoreFinalPari: scoreCheval,
      probaEstimee: 0.22,
      probabiliteImplicite: 0.18,
      probabiliteValueSeuil: 0.2,
      valueCalculee: 0.15,
      valueEffective: 1.2,
      top3Potential: 74,
      top5Potential: 82,
      objective: "GAGNE",
      outsider: false,
      valueBet: true,
      marketEdge: 0.04,
      kellyFraction: 0.03,
      bankrollPct: 0.03,
      miseBase100: 3,
      action: "MISER",
      topFacteurs: ["Forme recente"],
      decision: "VALIDE",
      typePariConseille: "GAGNANT",
      miseConseillee: 3,
    },
  };
}

test("determineRaceReadabilityScore favorise un top 3 net et regulier", () => {
  const race = createRace();
  const ranked = [
    createScoredParticipant(1, 86, 10, 2),
    createScoredParticipant(2, 77, 8, 3),
    createScoredParticipant(3, 73, 7, 4),
  ];

  const score = determineRaceReadabilityScore(race, ranked);
  assert.ok(score >= 66);
});

test("determineHorseDecision rejette un outsider sans signal suffisant hors course lisible", () => {
  const decision = determineHorseDecision(
    {
      ...createParticipant(9, {
        cote: 18,
        variationCote: 5,
        formeRecenteAmelioree: false,
      }),
      estTocard: true,
      musicStats: {
        recentPositions: [6, 7, 8],
        nbVictoires: 0,
        nbPodiums: 0,
        nbDQ: 1,
        nbAbandons: 0,
        fiabilite: 0.66,
        averagePosition: 7,
        serie: 0,
        trend: -0.8,
        ratioForme: 0.2,
      },
      signaux: {
        forme: 1,
        regularite: 2,
        victoire: 0,
        podium: 0,
        humain: 1,
        entraineur: 1,
        jockeyForme: 0,
        trainerTrack: 0,
        marche: -2,
        gains: 0,
        popularite: 0,
        stalle: 0,
        poids: 0,
        distance: 1,
        terrain: 0,
        meteo: 0,
        hippodrome: 0,
        ageSexe: 1,
        repos: 0,
        valueIntrinseque: 5,
        risque: 9,
        faute: 6,
      },
      scoreCheval: 42,
      qualite: 42,
      confiance: 5.8,
      scoreFinalPari: 25,
      top3Potential: 45,
      top5Potential: 58,
      objective: "SPECULATIF",
      outsider: true,
    },
    "COMPLEXE",
    DEFAULT_ALGO_PARAMETERS
  );

  assert.notEqual(decision.decision, "VALIDE");
  assert.equal(decision.typePariConseille, "PLACE");
});

test("buildValue marque une vraie edge comme value jouable", () => {
  const runner = createScoredParticipant(1, 82, 9, 2);
  runner.cote = 6;
  runner.coteMatin = 7;
  runner.prediction.probaEstimee = 0.24;
  runner.prediction.confiance = 7.4;
  runner.prediction.bankrollPct = 0.04;
  runner.prediction.kellyFraction = 0.04;

  const value = buildValue(runner, "LISIBLE", DEFAULT_ALGO_PARAMETERS);

  assert.equal(value.valueBet, true);
  assert.ok(value.valueEffective >= 0);
  assert.notEqual(value.label, "Sous-value");
});

test("analyzeRaceWithParameters produit une synthese coherente sur un petit champ", () => {
  const race = createRace();
  const participants = [
    createParticipant(1),
    createParticipant(2, { cote: 7.5, coteMatin: 8.2, musique: "23121", nombreVictoires: 2 }),
    createParticipant(3, { cote: 12, coteMatin: 14, musique: "54322", nombreVictoires: 1, nombrePlaces: 5 }),
    createParticipant(4, { cote: 22, coteMatin: 20, musique: "77890", nombreVictoires: 0, nombrePlaces: 1, tauxFaute: 0.35 }),
  ];

  const analysis = analyzeRaceWithParameters(race, participants, DEFAULT_ALGO_PARAMETERS);

  assert.equal(analysis.courseInfo.nomCourse, "Prix Test");
  assert.equal(analysis.participants, 4);
  assert.equal(analysis.ranking.length, 4);
  assert.ok(analysis.top5.length <= 4);
  assert.ok(analysis.favori !== null);
  assert.ok(["LISIBLE", "COMPLEXE", "LOTERIE"].includes(analysis.prediction.lisibilite));
});

test("le moteur expose les garde-fous v9.2 et garde une mise conseillee visible", () => {
  const race = createRace({ nombrePartants: 6, terrain: "bon", meteo: "soleil" });
  const participants = [
    createParticipant(1, { cote: 2.1, coteMatin: 2.2, musique: "11121", nombreVictoires: 6, nombrePlaces: 10 }),
    createParticipant(2, { cote: 2.4, coteMatin: 2.5, musique: "21212", nombreVictoires: 4, nombrePlaces: 9 }),
    createParticipant(3, { cote: 2.8, coteMatin: 2.9, musique: "22123", nombreVictoires: 3, nombrePlaces: 8 }),
    createParticipant(4, { cote: 3.2, coteMatin: 3.4, musique: "32323", nombreVictoires: 2, nombrePlaces: 7 }),
  ];

  const analysis = analyzeRaceWithParameters(race, participants, DEFAULT_ALGO_PARAMETERS);
  const visibleTicket = analysis.ranking.find((runner) => runner.prediction.decision !== "REJET");

  assert.equal(SCORING_ALGO_VERSION, "v9.2");
  assert.equal(getValueConfirmationMultiplier("LISIBLE"), 1.1);
  assert.equal(getValueConfirmationMultiplier("COMPLEXE"), 1.25);
  assert.ok(visibleTicket, "un ticket doit etre visible sur un champ lisible");
  assert.ok((visibleTicket?.prediction.miseConseillee ?? 0) > 0);
});

test("getRaceStatus distingue les courses finies et disponibles", () => {
  assert.equal(getRaceStatus("00:01", "01012020"), "finished");
  assert.ok(["prono_available", "upcoming"].includes(getRaceStatus("23:59", "31122099")));
});
