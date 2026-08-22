import { normalizePersianForStorage, normalizePersianFull } from "../persian/normalize.ts";

export type OtherMeaningsUpdate = {
  add: string[];
  remove: string[];
};

export type WordSenseIntakeUpdateInput = {
  id: number;
  expected_updated_at: string;
  changes: {
    other_meanings_fa: OtherMeaningsUpdate;
  };
};

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[]) {
  const keys = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();
  return keys.length === sortedExpected.length && keys.every((key, index) => key === sortedExpected[index]);
}

function parseMeaningList(value: unknown, field: string) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || !item.trim())) {
    throw new Error(`${field} must be an array of non-empty Persian strings.`);
  }
  const items = value.map((item) => normalizePersianForStorage((item as string).trim()));
  if (items.some((item) => !normalizePersianFull(item))) {
    throw new Error(`${field} must contain Persian letters.`);
  }
  const normalized = items.map(normalizePersianFull);
  if (new Set(normalized).size !== normalized.length) {
    throw new Error(`${field} must not contain duplicate meanings.`);
  }
  return items;
}

export function parseWordSenseIntakeUpdateInput(value: unknown): WordSenseIntakeUpdateInput {
  if (!isObject(value) || !exactKeys(value, ["id", "expected_updated_at", "changes"])) {
    throw new Error("Request body must contain exactly id, expected_updated_at, and changes.");
  }
  if (typeof value.id !== "number" || !Number.isSafeInteger(value.id) || value.id <= 0) {
    throw new Error("id must be a positive integer.");
  }
  if (typeof value.expected_updated_at !== "string" || !value.expected_updated_at.trim()) {
    throw new Error("expected_updated_at must be an ISO timestamp string.");
  }
  const expectedDate = new Date(value.expected_updated_at);
  if (!Number.isFinite(expectedDate.getTime()) || expectedDate.toISOString() !== value.expected_updated_at) {
    throw new Error("expected_updated_at must be an exact ISO timestamp.");
  }
  if (!isObject(value.changes) || !exactKeys(value.changes, ["other_meanings_fa"])) {
    throw new Error("changes must contain exactly other_meanings_fa.");
  }
  const rawOtherMeanings = value.changes.other_meanings_fa;
  if (!isObject(rawOtherMeanings) || !exactKeys(rawOtherMeanings, ["add", "remove"])) {
    throw new Error("other_meanings_fa must contain exactly add and remove arrays.");
  }
  const add = parseMeaningList(rawOtherMeanings.add, "other_meanings_fa.add");
  const remove = parseMeaningList(rawOtherMeanings.remove, "other_meanings_fa.remove");
  if (!add.length && !remove.length) {
    throw new Error("At least one other meaning must be added or removed.");
  }
  const removeSet = new Set(remove.map(normalizePersianFull));
  if (add.some((meaning) => removeSet.has(normalizePersianFull(meaning)))) {
    throw new Error("The same meaning cannot be added and removed in one update.");
  }
  return {
    id: value.id,
    expected_updated_at: value.expected_updated_at,
    changes: { other_meanings_fa: { add, remove } },
  };
}
