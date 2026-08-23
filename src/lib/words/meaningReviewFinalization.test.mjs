import assert from "node:assert/strict";
import test from "node:test";

import {
  buildMeaningReviewResultRecord,
  MeaningReviewSingleFlight,
  meaningReviewCorrectionFromResult,
  meaningReviewAtomicFailure,
  meaningReviewRequestKey,
  prepareMeaningReviewFinalization,
  summarizeMeaningReviewOutcomes,
} from "./meaningReviewFinalization.ts";

const previewRecords = [
  {
    id: 1, mode: "review", review_status: "PENDING", missing_fields: [], base_form: "initiative",
    meaning_fa: "ابتکار عمل", other_meanings_fa: ["پیش قدمی"], pos: "noun",
    concept_explained_fa: "آغاز مستقلانهٔ یک کار.",
    sentences: [{ id: 11, sentence_en: "She showed initiative at work.", sentence_en_meaning_fa: "او در محل کار ابتکار نشان داد." }],
  },
  {
    id: 2, mode: "review", review_status: "PENDING", missing_fields: [], base_form: "icon",
    meaning_fa: "آیکون", other_meanings_fa: [], pos: "noun",
    concept_explained_fa: "یک نماد تصویری در رابط کاربری است.",
    sentences: [{ id: 22, sentence_en: "Tap the app icon.", sentence_en_meaning_fa: "روی آیکون برنامه بزنید." }],
  },
  {
    id: 3, mode: "review", review_status: "PENDING", missing_fields: [], base_form: "harness",
    meaning_fa: "سامانه اجرایی", other_meanings_fa: ["چارچوب اجرایی"], pos: "noun",
    concept_explained_fa: "سامانه‌ای برای مدیریت اجرای ایجنت است.",
    sentences: [{ id: 33, sentence_en: "The harness manages tool calls.", sentence_en_meaning_fa: "سامانهٔ اجرایی فراخوانی ابزارها را مدیریت می‌کند." }],
  },
];
const corrections = [
  { id: 1, mode: "review", meaning_fa: "یک" },
  { id: 2, mode: "review", pos: "adjective" },
];

test("the final action includes every reviewed id and derives patches from complete result records", () => {
  const first = buildMeaningReviewResultRecord(previewRecords[0], corrections[0]);
  first.meaning_fa = "ویرایش‌شده";
  const request = prepareMeaningReviewFinalization({
    previewRecords,
    drafts: {
      1: JSON.stringify(first),
      2: JSON.stringify(buildMeaningReviewResultRecord(previewRecords[1], corrections[1])),
      3: JSON.stringify(buildMeaningReviewResultRecord(previewRecords[2])),
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
    drafts: {
      1: JSON.stringify(buildMeaningReviewResultRecord(
        previewRecords[0],
        { id: 1, mode: "review", invalid_primary_meaning: true },
      )),
      2: JSON.stringify(buildMeaningReviewResultRecord(previewRecords[1])),
      3: JSON.stringify(buildMeaningReviewResultRecord(previewRecords[2])),
    },
    confirmedIds: new Set(),
  });
  assert.deepEqual(request.ids, [1, 2, 3]);
  assert.deepEqual(request.results, [{ id: 1, mode: "review", invalid_primary_meaning: true }]);
});

test("invalid edited JSON blocks the complete batch before it is submitted", () => {
  assert.throws(() => prepareMeaningReviewFinalization({
    previewRecords,
    drafts: {
      1: "{not-json",
      2: JSON.stringify(buildMeaningReviewResultRecord(previewRecords[1])),
      3: JSON.stringify(buildMeaningReviewResultRecord(previewRecords[2])),
    },
    confirmedIds: new Set(),
  }), /resulting JSON for WordSense 1 is not valid JSON/);
});

test("a no-op is reported instead of silently closing", () => {
  assert.throws(() => prepareMeaningReviewFinalization({
    previewRecords,
    drafts: {},
    confirmedIds: new Set([1, 2, 3]),
  }), /nothing left to apply/);
});

test("an empty alternative array is displayed and submitted as an explicit deletion", () => {
  const result = buildMeaningReviewResultRecord(previewRecords[0], {
    id: 1,
    mode: "review",
    other_meanings_fa: [],
  });
  assert.deepEqual(result.other_meanings_fa, []);
  assert.deepEqual(meaningReviewCorrectionFromResult(previewRecords[0], result), {
    id: 1,
    mode: "review",
    other_meanings_fa: [],
  });
});

test("a replacement sentence is shown in final position and converts back to the API contract", () => {
  const patch = {
    id: 1,
    mode: "review",
    invalid_sentence_ids: [11],
    sentences: [{
      sentence_id: null,
      sentence_en: "She solved the problem without being asked.",
      sentence_en_meaning_fa: "او بدون اینکه از او خواسته شود مشکل را حل کرد.",
    }],
  };
  const result = buildMeaningReviewResultRecord(previewRecords[0], patch);
  assert.equal(result.sentences[0].sentence_id, null);
  assert.deepEqual(meaningReviewCorrectionFromResult(previewRecords[0], result), patch);
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
