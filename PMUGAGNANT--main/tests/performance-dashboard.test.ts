import test from "node:test";
import assert from "node:assert/strict";

import { buildPerformanceDashboard } from "../src/features/performance/performance-model";
import type { CourseRecordRow, PredictionRow, RunnerOutcomeRow } from "../src/lib/types";

function createCourse(overrides: Partial<CourseRecordRow> = {}): CourseRecordRow {
  return {
    date: "2026-04-01",
    reunion: 1,
    course: 1,
    hippodrome: "Vincennes",
    nom_course: "Prix Test",
    heure_depart: "14:30",
    discipline: "TROT ATTELE",
    allocation: 50000,
    distance: 2700,
    nombre_partants: 12,
    terrain: "bon",
    meteo: "soleil",
    lisibilite: "LISIBLE",
    score_lisibilite: 72,
    coefficient_lisibilite: 1,
    decision_course: "VALIDE",
    ...overrides,
  };
}

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

function createOutcome(overrides: Partial<RunnerOutcomeRow> = {}): RunnerOutcomeRow {
  return {
    date: "2026-04-10",
    reunion: 1,
    course: 1,
    cheval_num: 1,
    ordre_arrivee: 7,
    resultat_gagnant: false,
    resultat_place: false,
    rapport_gagnant: null,
    rapport_place: null,
    non_partant: false,
    ...overrides,
  };
}

test("buildPerformanceDashboard calcule les KPI ROI et gain net", () => {
  const dashboard = buildPerformanceDashboard(
    [
      createPrediction(),
      createPrediction({
        cheval_num: 2,
        cheval_nom: "Cheval 2",
        resultat_gagnant: false,
        resultat_place: false,
        gain_simule: 0,
      }),
    ],
    [createCourse()],
    { period: "30j", segment: "ALL", betType: "ALL" },
    "2026-04-15T12:00:00.000Z"
  );

  assert.equal(dashboard.kpis.validatedBets, 2);
  assert.equal(dashboard.kpis.totalStake, 20);
  assert.equal(dashboard.kpis.totalGain, 40);
  assert.equal(dashboard.kpis.netGain, 20);
  assert.equal(dashboard.kpis.globalRoi, 100);
  assert.equal(dashboard.kpis.paybackRate, 200);
  assert.equal(dashboard.kpis.winRate, 50);
  assert.equal(dashboard.kpis.placeRate, 50);
  assert.equal(dashboard.risk.bestDayProfit, 20);
  assert.equal(dashboard.risk.worstDayProfit, 20);
  assert.equal(dashboard.risk.calibrationSampleSize, 2);
  assert.equal(dashboard.timeline[0]?.betCount, 2);
});

test("buildPerformanceDashboard filtre segment et type de pari", () => {
  const dashboard = buildPerformanceDashboard(
    [
      createPrediction(),
      createPrediction({
        date: "2026-04-02",
        reunion: 1,
        course: 2,
        pari_conseille: "PLACE",
        resultat_gagnant: false,
        resultat_place: true,
        gain_simule: 18,
      }),
    ],
    [
      createCourse(),
      createCourse({
        date: "2026-04-02",
        course: 2,
        discipline: "PLAT",
        distance: 1400,
      }),
    ],
    { period: "30j", segment: "PLAT_SPRINT", betType: "PLACE" }
  );

  assert.equal(dashboard.kpis.validatedBets, 1);
  assert.equal(dashboard.kpis.totalGain, 18);
  assert.equal(dashboard.segments.find((row) => row.segment === "PLAT_SPRINT")?.bets, 1);
  assert.equal(dashboard.segments.find((row) => row.segment === "PLAT_SPRINT")?.places, 1);
  assert.equal(dashboard.segments.find((row) => row.segment === "PLAT_SPRINT")?.netGain, 8);
  assert.equal(dashboard.segments.find((row) => row.segment === "TROT_ATTELE")?.bets, 0);
});

test("buildPerformanceDashboard filtre hippodrome et distance puis expose les mises comparees", () => {
  const dashboard = buildPerformanceDashboard(
    [
      createPrediction({
        date: "2026-04-10",
        hippodrome: "Chantilly",
        mise_simulee: 8,
        gain_simule: 16,
      }),
      createPrediction({
        date: "2026-04-10",
        reunion: 2,
        course: 1,
        hippodrome: "Vincennes",
        mise_simulee: 10,
        gain_simule: 0,
      }),
    ],
    [
      createCourse({
        date: "2026-04-10",
        hippodrome: "Chantilly",
        discipline: "PLAT",
        distance: 1400,
      }),
      createCourse({
        date: "2026-04-10",
        reunion: 2,
        course: 1,
        hippodrome: "Vincennes",
        distance: 2700,
      }),
    ],
    {
      period: "30j",
      segment: "ALL",
      betType: "ALL",
      hippodrome: "Chantilly",
      distance: "SPRINT",
    },
    "2026-04-15T12:00:00.000Z",
    null,
    [
      createOutcome({
        ordre_arrivee: 1,
        resultat_gagnant: true,
        resultat_place: true,
      }),
    ]
  );

  assert.equal(dashboard.kpis.validatedBets, 1);
  assert.equal(dashboard.kpis.totalStake, 8);
  assert.equal(dashboard.kpis.totalGain, 16);
  assert.equal(dashboard.rangeSummaries.length, 3);
  assert.equal(dashboard.rangeSummaries.find((item) => item.period === "7j")?.bets, 1);
  assert.equal(dashboard.comparisonRows[0]?.suggestedStake, 8);
  assert.equal(dashboard.comparisonRows[0]?.actualStake, 8);
  assert.equal(dashboard.comparisonRows[0]?.result, "GAGNANT");
  assert.equal(dashboard.comparisonRows[0]?.finishPosition, 1);
  assert.ok(dashboard.availableHippodromes.includes("Chantilly"));
});

test("buildPerformanceDashboard affiche la place exacte hors podium depuis les arrivees", () => {
  const dashboard = buildPerformanceDashboard(
    [
      createPrediction({
        date: "2026-04-10",
        mise_simulee: 8,
        resultat_gagnant: null,
        resultat_place: null,
        gain_simule: null,
      }),
    ],
    [
      createCourse({
        date: "2026-04-10",
      }),
    ],
    { period: "30j", segment: "ALL", betType: "ALL" },
    "2026-04-15T12:00:00.000Z",
    null,
    [createOutcome()]
  );

  assert.equal(dashboard.comparisonRows[0]?.finishPosition, 7);
  assert.equal(dashboard.comparisonRows[0]?.result, "PERDU");
  assert.equal(dashboard.comparisonRows[0]?.gain, 0);
  assert.equal(dashboard.comparisonRows[0]?.netGain, -8);
});
