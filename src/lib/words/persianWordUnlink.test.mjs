import assert from "node:assert/strict";
import test from "node:test";

import { removePersianWordIdFromJsonArray } from "./persianWordUnlink.ts";

test("removes numeric and legacy string PersianWord IDs without changing other values", () => {
  assert.deepEqual(removePersianWordIdFromJsonArray([12, "12", 13, "note"], 12), [13, "note"]);
});

test("returns an empty reviewed array when the target is the only alternate meaning", () => {
  assert.deepEqual(removePersianWordIdFromJsonArray([12], 12), []);
});

test("does not treat non-array JSON as alternate meaning links", () => {
  assert.equal(removePersianWordIdFromJsonArray(null, 12), null);
  assert.equal(removePersianWordIdFromJsonArray({ id: 12 }, 12), null);
});
