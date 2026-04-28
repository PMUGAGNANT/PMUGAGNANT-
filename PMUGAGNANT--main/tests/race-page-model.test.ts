import assert from "node:assert/strict";
import test from "node:test";

import {
  buildArrivalRows,
  buildRaceQuickReadModel,
  buildTopSelections,
} from "../src/features/race/lib/race-page-model";
import type { ParticipantTableRow, RaceVerdictSummary } from "../src/features/vmax/vmax-model";

function createRow(overrides: Partial<ParticipantTableRow>): ParticipantTableRow {
  return {
    numero: 1,
    cheval: "Runner",
    jockey: "Jockey",
    entraineur: "Coach",
    cote: 5,
    scoreIa: 60,
    scoreV10: null,
    scoreV10Role: null,
    scoreSource: "engine",
    musique: null,
    mise: null,
    topFacteur: null,
    ...overrides,
  };
}

function createVerdict(overrides: Partial<RaceVerdictSummary> = {}): RaceVerdictSummary {
  return {
    verdict: "JOUER",
    numero: 1,
    cheval: "Runner",
    cote: 5,
    scorePercent: 68,
    fairOdds: 4.2,
    edge: 12,
    stake: 8,
    ...overrides,
  };
}

test("buildTopSelections garde les 5 meilleurs scores", () => {
  const rows = [
    createRow({ numero: 1, scoreIa: 58 }),
    createRow({ numero: 2, scoreIa: 81 }),
    createRow({ numero: 3, scoreIa: 42 }),
    createRow({ numero: 4, scoreIa: 73 }),
    createRow({ numero: 5, scoreIa: 66 }),
    createRow({ numero: 6, scoreIa: 61 }),
  ];

  assert.deepEqual(
    buildTopSelections(rows, 5).map((row) => row.numero),
    [2, 4, 5, 6, 1]
  );
});

test("buildRaceQuickReadModel separe bases, outsiders et eliminations", () => {
  const rows = [
    createRow({ numero: 1, cheval: "Alpha", scoreIa: 82, mise: 8, cote: 3.4 }),
    createRow({ numero: 2, cheval: "Bravo", scoreIa: 74, mise: 6, cote: 5.8 }),
    createRow({ numero: 3, cheval: "Charlie", scoreIa: 58, cote: 12 }),
    createRow({ numero: 4, cheval: "Delta", scoreIa: 49, cote: 9.5 }),
    createRow({ numero: 5, cheval: "Echo", scoreIa: 31, cote: 18 }),
    createRow({ numero: 6, cheval: "Foxtrot", scoreIa: 27, cote: 21 }),
  ];

  const model = buildRaceQuickReadModel(rows, createVerdict({ numero: 1, cheval: "Alpha" }), 72);

  assert.equal(model.confidenceLabel, "Course jouable");
  assert.deepEqual(model.bases.map((item) => item.numero), [1, 2]);
  assert.deepEqual(model.outsiders.map((item) => item.numero), [3, 4]);
  assert.deepEqual(model.eliminations.map((item) => item.numero), [6, 5]);
});

test("buildArrivalRows relie l'arrivee aux chevaux et au top IA", () => {
  const rows = [
    createRow({ numero: 7, cheval: "Mirage" }),
    createRow({ numero: 3, cheval: "Sirocco" }),
  ];

  const arrivalRows = buildArrivalRows([7, 3], rows, new Set([3]));

  assert.deepEqual(arrivalRows, [
    { numero: 7, cheval: "Mirage", selectedByIa: false },
    { numero: 3, cheval: "Sirocco", selectedByIa: true },
  ]);
});
