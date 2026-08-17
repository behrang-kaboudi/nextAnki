import assert from "node:assert/strict";
import test from "node:test";

import {
  MeaningReviewSingleFlight,
  meaningReviewAtomicFailure,
  meaningReviewRequestKey,
  prepareMeaningReviewFinalization,
  summarizeMeaningReviewOutcomes,
} from "./meaningReviewFinalization.ts";

const previewRecords = [
  { id: 1, mode: "review", missing_fields: [] },
  { id: 2, mode: "review", missing_fields: ["pos"] },
  { id: 3, mode: "review", missing_fields: [] },
];
const corrections = [
  { id: 1, mode: "review", meaning_fa: "یک" },
  { id: 2, mode: "review", pos: "noun" },
];

test("the final action includes every unconfirmed preview id and the edited drafts", () => {
  const request = prepareMeaningReviewFinalization({
    previewRecords,
    corrections,
    drafts: {
      1: JSON.stringify({ id: 1, mode: "review", meaning_fa: "ویرایش‌شده" }),
      2: JSON.stringify(corrections[1]),
    },
    confirmedIds: new Set(),
  });
  assert.deepEqual(request.ids, [1, 2, 3]);
  assert.deepEqual(request.results, [
    { id: 1, mode: "review", meaning_fa: "ویرایش‌شده" },
    corrections[1],
  ]);
});

test("reviewed-only rows remain in scope while an invalid-primary result remains explicit", () => {
  const request = prepareMeaningReviewFinalization({
    previewRecords,
    corrections: [{ id: 1, mode: "review", invalid_primary_meaning: true }],
    drafts: {},
    confirmedIds: new Set(),
  });
  assert.deepEqual(request.ids, [1, 2, 3]);
  assert.deepEqual(request.results, [{ id: 1, mode: "review", invalid_primary_meaning: true }]);
});

test("invalid edited JSON blocks the complete batch before it is submitted", () => {
  assert.throws(() => prepareMeaningReviewFinalization({
    previewRecords,
    corrections,
    drafts: { 1: "{not-json", 2: JSON.stringify(corrections[1]) },
    confirmedIds: new Set(),
  }), /WordSense 1 is not valid JSON/);
});

test("a no-op is reported instead of silently closing", () => {
  assert.throws(() => prepareMeaningReviewFinalization({
    previewRecords,
    corrections,
    drafts: {},
    confirmedIds: new Set([1, 2, 3]),
  }), /nothing left to apply/);
});

test("the request key is stable for a retry and changes with the payload", () => {
  const first = meaningReviewRequestKey([1, 2], corrections);
  assert.equal(first, meaningReviewRequestKey([1, 2], corrections));
  assert.notEqual(first, meaningReviewRequestKey([1, 2], [{ ...corrections[0], meaning_fa: "دو" }]));
});

test("the single-flight gate rejects a double submit and permits a later retry", () => {
  const gate = new MeaningReviewSingleFlight();
  assert.equal(gate.begin(), true);
  assert.equal(gate.begin(), false);
  gate.end();
  assert.equal(gate.begin(), true);
});

test("success results distinguish updated, reviewed-only, needs-action, and retry outcomes", () => {
  const summary = summarizeMeaningReviewOutcomes([
    { id: 1, status: "updated", contentChanged: true, reviewStatusChanged: true, attentionRequired: false },
    { id: 2, status: "review_confirmed", contentChanged: false, reviewStatusChanged: true, attentionRequired: false },
    { id: 3, status: "attention_required", contentChanged: false, reviewStatusChanged: false, attentionRequired: true },
    { id: 4, status: "attention_required", contentChanged: false, reviewStatusChanged: true, attentionRequired: true },
  ]);
  assert.deepEqual(summary.appliedIds, [1]);
  assert.deepEqual(summary.reviewedOnlyIds, [2]);
  assert.deepEqual(summary.attentionRequiredIds, [3, 4]);
  assert.equal(summary.idempotentReplay, false);

  const invalidOnly = summarizeMeaningReviewOutcomes([
    { id: 3, status: "attention_required", contentChanged: false, reviewStatusChanged: false, attentionRequired: true },
  ]);
  assert.equal(invalidOnly.idempotentReplay, false);

  const retry = summarizeMeaningReviewOutcomes([
    { id: 1, status: "already_current", contentChanged: false, reviewStatusChanged: false, attentionRequired: false },
    { id: 3, status: "attention_required", contentChanged: false, reviewStatusChanged: false, attentionRequired: true },
  ]);
  assert.equal(retry.idempotentReplay, true);
});

test("a backend failure reports the id and guarantees empty applied groups", () => {
  const failure = meaningReviewAtomicFailure(22, "simulated failure");
  assert.equal(failure.rolledBack, true);
  assert.deepEqual(failure.appliedIds, []);
  assert.deepEqual(failure.failed, [{ id: 22, reason: "simulated failure" }]);
});
