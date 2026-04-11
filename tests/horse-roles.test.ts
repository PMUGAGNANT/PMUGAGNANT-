import test from "node:test";
import assert from "node:assert/strict";

import { detecterRoles, type ParticipantBase } from "../src/lib/horse-roles";

function runner(overrides: Partial<ParticipantBase>): ParticipantBase {
  return {
    cheval_num: 1,
    cheval_nom: "Cheval test",
    cote_matin: 10,
    cote_depart: 10,
    score_cheval: 50,
    confiance: 5,
    ...overrides,
  };
}

test("detecte les quatre roles sans attribuer deux roles au meme cheval", () => {
  const roles = detecterRoles(
    [
      runner({
        cheval_num: 1,
        cheval_nom: "Le Favori",
        cote_matin: 3,
        cote_depart: 2.8,
        score_cheval: 58,
      }),
      runner({
        cheval_num: 2,
        cheval_nom: "La Pepite",
        cote_matin: 8,
        cote_depart: 8.4,
        score_cheval: 72,
      }),
      runner({
        cheval_num: 3,
        cheval_nom: "Le Rocket",
        cote_matin: 18,
        cote_depart: 10,
        score_cheval: 58,
      }),
      runner({
        cheval_num: 4,
        cheval_nom: "L Oublie",
        cote_matin: 22,
        cote_depart: 21,
        score_cheval: 67,
      }),
    ],
    "COMPLEXE"
  );

  assert.deepEqual(
    roles.map((role) => role.role),
    ["FAVORI", "PEPITE", "OUTSIDER", "OUBLIE"]
  );
  assert.deepEqual(
    roles.map((role) => role.cheval_num),
    [1, 2, 3, 4]
  );
  assert.equal(new Set(roles.map((role) => role.cheval_num)).size, roles.length);
});

test("bloque la pepite en lisibilite LOTERIE", () => {
  const roles = detecterRoles(
    [
      runner({ cheval_num: 1, cote_matin: 2.9, score_cheval: 82 }),
      runner({ cheval_num: 2, cote_matin: 8, score_cheval: 91 }),
      runner({ cheval_num: 3, cote_matin: 18, cote_depart: 12, score_cheval: 58 }),
    ],
    "LOTERIE"
  );

  assert.equal(roles.some((role) => role.role === "PEPITE"), false);
  assert.equal(roles[0]?.role, "FAVORI");
});

test("priorise la plus forte baisse pour l outsider", () => {
  const roles = detecterRoles(
    [
      runner({ cheval_num: 1, cote_matin: 4, score_cheval: 55 }),
      runner({ cheval_num: 2, cote_matin: 7, score_cheval: 64 }),
      runner({ cheval_num: 3, cote_matin: 16, cote_depart: 12, score_cheval: 55 }),
      runner({ cheval_num: 4, cote_matin: 20, cote_depart: 10, score_cheval: 54 }),
    ],
    "LISIBLE"
  );

  assert.equal(roles.find((role) => role.role === "OUTSIDER")?.cheval_num, 4);
});

test("ne retient pas un oublie avec signal marche fort", () => {
  const roles = detecterRoles(
    [
      runner({ cheval_num: 1, cote_matin: 3.5, score_cheval: 55 }),
      runner({ cheval_num: 2, cote_matin: 9, score_cheval: 70 }),
      runner({ cheval_num: 3, cote_matin: 18, cote_depart: 16, score_cheval: 66 }),
      runner({ cheval_num: 4, cote_matin: 19, cote_depart: 14, score_cheval: 80 }),
    ],
    "COMPLEXE"
  );

  assert.equal(roles.find((role) => role.role === "OUBLIE")?.cheval_num, 3);
  assert.notEqual(roles.find((role) => role.role === "OUBLIE")?.cheval_num, 4);
});
