import assert from "node:assert/strict";
import test from "node:test";

import {
  buildLiveOddsDetailsFromRecord,
  formatLiveOddsLabel,
  normalizePmuOddsValue,
  parseLiveOddsDetailsFromParticipant,
} from "../src/lib/pmu-odds";

test("normalizePmuOddsValue garde les cotes PMU lisibles", () => {
  assert.equal(normalizePmuOddsValue(3.2), 3.2);
  assert.equal(normalizePmuOddsValue(320), 3.2);
  assert.equal(normalizePmuOddsValue(0), null);
  assert.equal(normalizePmuOddsValue(Number.NaN), null);
  assert.equal(normalizePmuOddsValue("3.2"), null);
});

test("parseLiveOddsDetailsFromParticipant lit la cote gagnant officielle et son heure", () => {
  const details = parseLiveOddsDetailsFromParticipant({
    numPmu: 1,
    dernierRapportDirect: {
      typePari: "SIMPLE_GAGNANT",
      rapport: 2.3,
      dateRapport: 1776780000000,
    },
  });

  assert.deepEqual(details, {
    numero: 1,
    cote: 2.3,
    typePari: "SIMPLE_GAGNANT",
    source: "PMU_PARTICIPANTS",
    updatedAtMs: 1776780000000,
    updatedAt: "16:00",
  });
  assert.equal(formatLiveOddsLabel(details), "Cote PMU GAGNANT 16:00");
});

test("buildLiveOddsDetailsFromRecord couvre le fallback masse-enjeux", () => {
  const details = buildLiveOddsDetailsFromRecord(
    {
      numeroCheval: "7",
      coteProbable: 980,
      typePari: "SIMPLE_PLACE",
    },
    "PMU_MASSE_ENJEUX"
  );

  assert.equal(details?.numero, 7);
  assert.equal(details?.cote, 9.8);
  assert.equal(details?.typePari, "SIMPLE_PLACE");
  assert.equal(formatLiveOddsLabel(details), "Cote PMU PLACE");
});
