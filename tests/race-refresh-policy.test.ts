import test from "node:test";
import assert from "node:assert/strict";

import {
  getPreRaceRefreshDecision,
  getResultRefreshDecision,
} from "../src/lib/race-refresh-policy";
import type { RaceSummary } from "../src/lib/types";

function createRace(overrides: Partial<RaceSummary> = {}): RaceSummary {
  return {
    dateStr: "09042026",
    reunion: 1,
    course: 1,
    hippodrome: "Auteuil",
    pays: "FRA",
    nomCourse: "Prix Test",
    heureDepart: "12:00",
    discipline: "Plat",
    estTrot: false,
    estPlat: true,
    estQuinte: false,
    allocation: 10000,
    distance: 2000,
    nombrePartants: 16,
    meteo: null,
    terrain: null,
    ...overrides,
  };
}

test("pre-race ignore les courses trop lointaines", () => {
  const race = createRace({ heureDepart: "15:30" });
  const decision = getPreRaceRefreshDecision(
    race,
    new Date("2026-04-09T08:00:00.000Z")
  );

  assert.equal(decision.due, false);
  assert.equal(decision.intervalMinutes, null);
  assert.equal(decision.reason, "trop-loin");
});

test("pre-race accelere une quinte dans la fenetre 180-60 minutes", () => {
  const race = createRace({ estQuinte: true, heureDepart: "12:00" });
  const decision = getPreRaceRefreshDecision(
    race,
    new Date("2026-04-09T08:30:00.000Z")
  );

  assert.equal(decision.intervalMinutes, 30);
  assert.equal(decision.due, true);
  assert.equal(decision.lane, "monitor");
});

test("pre-race garde une course standard sur une cadence plus lente avant T-60", () => {
  const race = createRace({ heureDepart: "12:00" });
  const decision = getPreRaceRefreshDecision(
    race,
    new Date("2026-04-09T08:30:00.000Z")
  );

  assert.equal(decision.intervalMinutes, 60);
  assert.equal(decision.due, false);
  assert.equal(decision.lane, "monitor");
});

test("pre-race passe en cadence active dans la derniere heure", () => {
  const race = createRace({ heureDepart: "11:20" });
  const decision = getPreRaceRefreshDecision(
    race,
    new Date("2026-04-09T08:40:00.000Z")
  );

  assert.equal(decision.intervalMinutes, 10);
  assert.equal(decision.due, true);
  assert.equal(decision.lane, "active");
});

test("result sync verifie vite juste apres le depart puis ralentit", () => {
  const justFinished = createRace({ heureDepart: "14:00" });
  const hotDecision = getResultRefreshDecision(
    justFinished,
    new Date("2026-04-09T12:25:00.000Z")
  );
  assert.equal(hotDecision.intervalMinutes, 5);
  assert.equal(hotDecision.due, true);
  assert.equal(hotDecision.lane, "settlement");

  const standardDecision = getResultRefreshDecision(
    justFinished,
    new Date("2026-04-09T13:45:00.000Z")
  );
  assert.equal(standardDecision.intervalMinutes, 10);
  assert.equal(standardDecision.due, false);
  assert.equal(standardDecision.reason, "resultat-standard");
});
