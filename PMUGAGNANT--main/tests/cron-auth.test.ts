import assert from "node:assert/strict";
import test from "node:test";

import { isCronSecretCandidateValid } from "../src/lib/cron-auth";

test("cron auth accepts an exact token candidate", () => {
  assert.equal(
    isCronSecretCandidateValid("TurfEdge2026PMUSecret123", [
      "TurfEdge2026PMUSecret123",
    ]),
    true
  );
});

test("cron auth accepts a plus secret when the URL decoded it as a space", () => {
  assert.equal(
    isCronSecretCandidateValid("TurfEdge+2026+PMU", ["TurfEdge 2026 PMU"]),
    true
  );
});

test("cron auth rejects missing or wrong token candidates", () => {
  assert.equal(
    isCronSecretCandidateValid("TurfEdge2026PMUSecret123", [
      null,
      undefined,
      "wrong-secret",
    ]),
    false
  );
});
