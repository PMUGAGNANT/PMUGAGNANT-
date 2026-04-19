import assert from "node:assert/strict";
import test from "node:test";

import { selectRaceRolesV10 } from "../src/lib/predictions/roles-v10";
import type { ScoreV10Breakdown } from "../src/lib/predictions/scoring-v10";

function score(
  chevalNum: number,
  overrides: Partial<ScoreV10Breakdown>
): ScoreV10Breakdown {
  return {
    chevalNum,
    chevalNom: `Cheval ${chevalNum}`,
    jockey: `Jockey ${chevalNum}`,
    cote: 5,
    scoreC1: 10,
    scoreC2: 20,
    scoreC3: 8,
    scoreC4: 8,
    scoreV10: 50,
    decision: "SURVEILLER",
    recentTop3Count: 1,
    recentSample: 3,
    jockeyWinRate: null,
    jockeySample: 0,
    distanceSample: 0,
    distanceTop3: false,
    ...overrides,
  };
}

test("selectRaceRolesV10 attribue les rôles sans doublon", () => {
  const roles = selectRaceRolesV10([
    score(1, { scoreV10: 82, cote: 8, scoreC1: 18, scoreC3: 12, scoreC4: 20 }),
    score(2, { scoreV10: 65, cote: 12, scoreC1: 18, scoreC3: 10, scoreC4: 12 }),
    score(3, { scoreV10: 61, cote: 3, scoreC1: 10, scoreC3: 25, scoreC4: 10 }),
    score(4, { scoreV10: 58, cote: 5, scoreC1: 10, scoreC3: 8, scoreC4: 25 }),
    score(5, { scoreV10: 52, cote: 18, scoreC1: 18, scoreC3: 4, scoreC4: 9 }),
  ]);

  assert.deepEqual(
    roles.map((role) => role.role),
    ["CHOIX", "PEPITE", "CHASSEUR", "PODIUM", "OUTSIDER"]
  );
  assert.equal(new Set(roles.map((role) => role.chevalNum)).size, roles.length);
  assert.equal(roles.find((role) => role.role === "PODIUM")?.betType, "PLACE");
});

test("selectRaceRolesV10 ne force pas les slots sans candidat", () => {
  const roles = selectRaceRolesV10([
    score(1, { scoreV10: 72, cote: 4, scoreC1: 10 }),
    score(2, { scoreV10: 45, cote: 4.5, scoreC1: 0 }),
  ]);

  assert.deepEqual(
    roles.map((role) => role.role),
    ["CHOIX", "PODIUM"]
  );
});
