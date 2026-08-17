import assert from "node:assert/strict";
import test from "node:test";
import { hasRole } from "../permissions/index.ts";

import {
  ScopeValidationError,
  analyzeSentenceLinkImpact,
  isIdempotentMaintenanceReplay,
  mergeRestoredSentenceIds,
  missingRequestedIds,
  normalizeWordSenseMaintenanceScope,
  parseWordSenseIds,
  sameSentenceLinkState,
} from "./wordSenseMaintenanceScope.ts";

test("parses JSON and separated ids, normalizes order, and removes duplicates", () => {
  assert.deepEqual(parseWordSenseIds("[9, 2, 9, \"4\"]"), [2, 4, 9]);
  assert.deepEqual(parseWordSenseIds("9, 2\n4  9"), [2, 4, 9]);
});

test("rejects invalid ids and reversed ranges instead of silently narrowing Scope", () => {
  assert.throws(() => parseWordSenseIds("1, nope, -2"), ScopeValidationError);
  assert.throws(
    () => normalizeWordSenseMaintenanceScope({ kind: "id_range", startId: 10, endId: 3 }),
    /start id must not exceed/,
  );
});

test("reports every requested id that was not found", () => {
  assert.deepEqual(missingRequestedIds([2, 4, 6, 8], [2, 8]), [4, 6]);
});

test("classifies shared and newly unreferenced sentences for only the scoped rows", () => {
  const impact = analyzeSentenceLinkImpact(
    [{ id: 1, sentenceIds: [10, 20] }, { id: 2, sentenceIds: [20, 30] }],
    [{ id: 1, sentenceIds: [10, 20] }, { id: 2, sentenceIds: [20, 30] }, { id: 3, sentenceIds: [30, 40] }],
  );
  assert.deepEqual(impact.sharedSentenceIds, [30]);
  assert.deepEqual(impact.orphanedSentenceIds, [10, 20]);
  assert.equal(impact.linkCount, 4);
});

test("detects stale previews when scoped links, timestamps, or row membership change", () => {
  const expected = [{ id: 1, sentenceIds: [10], updatedAt: "2026-01-01T00:00:00.000Z" }];
  assert.equal(sameSentenceLinkState(expected, expected), true);
  assert.equal(sameSentenceLinkState(expected, [{ ...expected[0], sentenceIds: [11] }]), false);
  assert.equal(sameSentenceLinkState(expected, [{ ...expected[0], updatedAt: "2026-01-02T00:00:00.000Z" }]), false);
  assert.equal(sameSentenceLinkState(expected, []), false);
});

test("idempotency keys replay only the same preview", () => {
  assert.equal(isIdempotentMaintenanceReplay("preview-a", "preview-a"), true);
  assert.equal(isIdempotentMaintenanceReplay("preview-a", "preview-b"), false);
});

test("Undo restores original links without discarding links added later", () => {
  assert.deepEqual(mergeRestoredSentenceIds([10, 20], [20, 30]), [10, 20, 30]);
});

test("maintenance authorization policy distinguishes admin from non-admin roles", () => {
  assert.equal(hasRole(["admin"], "admin"), true);
  assert.equal(hasRole(["editor"], "admin"), false);
  assert.equal(hasRole(undefined, "admin"), false);
});
