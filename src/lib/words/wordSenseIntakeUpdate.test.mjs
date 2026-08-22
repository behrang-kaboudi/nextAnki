import assert from "node:assert/strict";
import test from "node:test";

import { parseWordSenseIntakeUpdateInput } from "./wordSenseIntakeUpdate.ts";

test("parses one additive other-meanings update", () => {
  assert.deepEqual(parseWordSenseIntakeUpdateInput({
    id: 41952,
    expected_updated_at: "2026-08-22T12:00:00.000Z",
    changes: {
      other_meanings_fa: {
        add: ["به اندازه"],
        remove: [],
      },
    },
  }), {
    id: 41952,
    expected_updated_at: "2026-08-22T12:00:00.000Z",
    changes: {
      other_meanings_fa: {
        add: ["به اندازه"],
        remove: [],
      },
    },
  });
});

test("rejects a meaning that appears in both add and remove", () => {
  assert.throws(() => parseWordSenseIntakeUpdateInput({
    id: 41952,
    expected_updated_at: "2026-08-22T12:00:00.000Z",
    changes: {
      other_meanings_fa: {
        add: ["به اندازه"],
        remove: ["به‌اندازه"],
      },
    },
  }), /cannot be added and removed/);
});

test("rejects empty and unexpected update shapes", () => {
  assert.throws(() => parseWordSenseIntakeUpdateInput({
    id: 1,
    expected_updated_at: "2026-08-22T12:00:00.000Z",
    changes: { other_meanings_fa: { add: [], remove: [] } },
  }), /At least one/);
  assert.throws(() => parseWordSenseIntakeUpdateInput({
    id: 1,
    expected_updated_at: "2026-08-22T12:00:00.000Z",
    changes: { other_meanings_fa: { add: ["معنی"], remove: [] }, meaning_fa: "معنی" },
  }), /changes must contain exactly/);
});
