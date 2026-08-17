import assert from "node:assert/strict";
import test from "node:test";

import {
  conceptMergePersianResolutionKey,
  preferredConceptMergePersianWordIds,
} from "./conceptMergePersianIdentity.ts";

const canonicalTextById = new Map([
  [573, "کرم"],
  [7524, "کرم"],
  [9000, "حشره"],
]);

test("an unchanged primary meaning keeps the survivor's stable PersianWord id", () => {
  assert.deepEqual(preferredConceptMergePersianWordIds({
    text: "کرم",
    field: "meaning_fa",
    sourcePrimaryId: 573,
    sourceMeaningIds: [573],
    clusterMeaningIds: [573, 7524],
    canonicalTextById,
  }), [573]);
});

test("an unchanged other meaning keeps its unique source id", () => {
  assert.deepEqual(preferredConceptMergePersianWordIds({
    text: "حشره",
    field: "other_meanings_fa",
    sourcePrimaryId: 573,
    sourceMeaningIds: [573, 9000],
    clusterMeaningIds: [573, 7524, 9000],
    canonicalTextById,
  }), [9000]);
});

test("a transferred cluster meaning reuses the one matching cluster id", () => {
  assert.deepEqual(preferredConceptMergePersianWordIds({
    text: "کرم",
    field: "other_meanings_fa",
    sourcePrimaryId: 9000,
    sourceMeaningIds: [9000],
    clusterMeaningIds: [9000, 573],
    canonicalTextById,
  }), [573]);
});

test("multiple matching cluster identities remain explicit for disambiguation", () => {
  assert.deepEqual(preferredConceptMergePersianWordIds({
    text: "کرم",
    field: "other_meanings_fa",
    sourcePrimaryId: 9000,
    sourceMeaningIds: [9000],
    clusterMeaningIds: [573, 7524, 9000],
    canonicalTextById,
  }), [573, 7524]);
});

test("resolution keys remain stable across retries", () => {
  assert.equal(conceptMergePersianResolutionKey(1282, "meaning_fa"), "retained.1282.meaning_fa.0");
  assert.equal(conceptMergePersianResolutionKey(1282, "other_meanings_fa", 2), "retained.1282.other_meanings_fa.2");
});
