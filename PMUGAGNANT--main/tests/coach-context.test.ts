import test from "node:test";
import assert from "node:assert/strict";

import {
  buildDirectCoachAnswer,
  buildFallbackCoachAnswer,
  getCoachIntentForQuestion,
  type CoachContextItem,
} from "../src/lib/coach-context";

const coachContext: CoachContextItem[] = [
  {
    id: "2026-04-23-1-4-7",
    date: "2026-04-23",
    race: "R1C4",
    hippodrome: "CHANTILLY",
    courseName: "Prix Test",
    meta: "Plat - 1600m - 14 partants - 15:20",
    horseNumber: 7,
    horseName: "MAROLY",
    decision: "VALIDE",
    betType: "GAGNANT",
    confidence: 8.1,
    score: 82,
    value: 0.18,
    odds: 4.2,
    stake: 10,
    result: "EN_ATTENTE",
    finishPosition: null,
    premiumLocked: false,
  },
  {
    id: "2026-04-23-1-4-6",
    date: "2026-04-23",
    race: "R1C4",
    hippodrome: "CHANTILLY",
    courseName: "Prix Test",
    meta: "Plat - 1600m - 14 partants - 15:20",
    horseNumber: 6,
    horseName: "MAGIC CASH",
    decision: "SURVEILLANCE",
    betType: "PLACE",
    confidence: 6.4,
    score: 76,
    value: 0.06,
    odds: 6.8,
    stake: 4,
    result: "EN_ATTENTE",
    finishPosition: null,
    premiumLocked: false,
  },
];

test("coach repond directement aux questions non hippiques", () => {
  assert.equal(getCoachIntentForQuestion("bonjour"), "greeting");

  const answer = buildDirectCoachAnswer("bonjour", "premium");

  assert.ok(answer);
  assert.match(answer, /Salut, je suis le Coach TurfEdge/);
  assert.doesNotMatch(answer, /score \d+\/100/);
});

test("coach explique une question pourquoi avec le cheval demande", () => {
  assert.equal(getCoachIntentForQuestion("Pourquoi R1C4 #7 ?"), "why");

  const answer = buildFallbackCoachAnswer("Pourquoi R1C4 #7 ?", coachContext, "premium");

  assert.match(answer, /Pourquoi je lis R1C4 #7 MAROLY/);
  assert.match(answer, /Decision: VALIDE/);
  assert.match(answer, /cote 4\.2/);
});

test("coach compare les rivaux au lieu de servir une fiche generique", () => {
  const answer = buildFallbackCoachAnswer("Compare R1C4 #7", coachContext, "premium");

  assert.match(answer, /Comparaison autour de R1C4 #7 MAROLY/);
  assert.match(answer, /Rivaux: R1C4 #6 MAGIC CASH/);
});
