import assert from "node:assert/strict";
import test from "node:test";
import { defaultDograState, normalizeDograState, summarizeDograState } from "./dogra-store.mjs";

test("Dogra defaults are server-shaped and reportable", () => {
  const state = defaultDograState();
  const summary = summarizeDograState(state);
  assert.equal(state.schemaVersion, 1);
  assert.ok(state.campaigns.length > 0);
  assert.ok(summary.targeted > 0);
  assert.ok(summary.contracted >= summary.live);
});

test("Dogra normalization rejects malformed collection shapes", () => {
  const state = normalizeDograState({ campaigns: "bad", opportunities: null, cohorts: 42 });
  assert.ok(Array.isArray(state.campaigns));
  assert.ok(Array.isArray(state.opportunities));
  assert.ok(Array.isArray(state.cohorts));
});
