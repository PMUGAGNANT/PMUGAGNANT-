import assert from "node:assert/strict";
import test from "node:test";

import {
  getFavoriteFormTrend,
  parseFavoriteForm,
} from "../src/features/race/lib/favorite-form";

test("parseFavoriteForm converts recent PMU music into five form bars", () => {
  const points = parseFavoriteForm("1p2pDa4p9p");

  assert.equal(points.length, 5);
  assert.equal(points[0]?.label, "1");
  assert.equal(points[0]?.score, 100);
  assert.equal(points[0]?.tone, "strong");
  assert.equal(points[2]?.label, "DAI");
  assert.equal(points[2]?.tone, "weak");
});

test("parseFavoriteForm returns neutral placeholders without music", () => {
  const points = parseFavoriteForm("");

  assert.equal(points.length, 5);
  assert.equal(points[0]?.label, "C1");
  assert.equal(points.every((point) => point.tone === "neutral"), true);
});

test("getFavoriteFormTrend detects improving and declining form", () => {
  const improving = getFavoriteFormTrend(parseFavoriteForm("1p2p8p9p0p"));
  const declining = getFavoriteFormTrend(parseFavoriteForm("8p9p1p2p3p"));

  assert.equal(improving.direction, "up");
  assert.equal(declining.direction, "down");
});
