import assert from "node:assert/strict";
import test from "node:test";
import { getSafeRedirectPath } from "../src/lib/safe-redirect";

test("getSafeRedirectPath keeps internal paths with query strings", () => {
  assert.equal(
    getSafeRedirectPath("/mes-paris?billing=checkout"),
    "/mes-paris?billing=checkout"
  );
});

test("getSafeRedirectPath rejects external and malformed redirects", () => {
  assert.equal(getSafeRedirectPath("https://example.com", "/"), "/");
  assert.equal(getSafeRedirectPath("//example.com", "/"), "/");
  assert.equal(getSafeRedirectPath("/\\example.com", "/dashboard"), "/dashboard");
});
