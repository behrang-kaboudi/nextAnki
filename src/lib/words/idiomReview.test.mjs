import assert from "node:assert/strict";
import test from "node:test";

import {
  idiomReviewCompletedForBaseForm,
  isMultiwordLexicalEntry,
  parseIdiomReviewDecisions,
} from "./idiomReview.ts";

test("single words are auto-complete while spaced and hyphenated forms require review", () => {
  assert.equal(isMultiwordLexicalEntry("mirror"), false);
  assert.equal(idiomReviewCompletedForBaseForm("mirror"), true);
  assert.equal(isMultiwordLexicalEntry("bathroom mirror"), true);
  assert.equal(idiomReviewCompletedForBaseForm("bathroom mirror"), false);
  assert.equal(isMultiwordLexicalEntry("rear-view mirror"), true);
  assert.equal(isMultiwordLexicalEntry("mother–in–law"), true);
});

test("response parser accepts only ordered id and delete booleans", () => {
  assert.deepEqual(parseIdiomReviewDecisions([
    { id: 10, delete: true },
    { id: 20, delete: false },
  ], [10, 20]), [
    { id: 10, delete: true },
    { id: 20, delete: false },
  ]);
});

test("response parser rejects extra keys, duplicate ids, and reordered coverage", () => {
  assert.throws(
    () => parseIdiomReviewDecisions([{ id: 10, delete: true, reason: "extra" }]),
    /exactly \{ id, delete \}/,
  );
  assert.throws(
    () => parseIdiomReviewDecisions([{ id: 10, delete: true }, { id: 10, delete: false }]),
    /unique/,
  );
  assert.throws(
    () => parseIdiomReviewDecisions([{ id: 20, delete: false }, { id: 10, delete: true }], [10, 20]),
    /original order/,
  );
});
