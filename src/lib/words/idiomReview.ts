export type IdiomReviewDecision = {
  id: number;
  delete: boolean;
};

const MULTIWORD_SEPARATOR = /[\s\u2010-\u2015-]/u;

export function isMultiwordLexicalEntry(baseForm: string): boolean {
  return MULTIWORD_SEPARATOR.test(baseForm.trim());
}

export function idiomReviewCompletedForBaseForm(baseForm: string): boolean {
  return !isMultiwordLexicalEntry(baseForm);
}

function isPositiveId(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function hasExactKeys(record: Record<string, unknown>, keys: readonly string[]) {
  const actual = Object.keys(record);
  return actual.length === keys.length && actual.every((key) => keys.includes(key));
}

export function parseIdiomReviewDecisions(
  value: unknown,
  expectedIds?: readonly number[],
): IdiomReviewDecision[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error("Response must be a non-empty JSON array.");
  }
  const decisions = value.map((raw, index) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      throw new Error(`Response item ${index + 1} must be an object.`);
    }
    const item = raw as Record<string, unknown>;
    if (!hasExactKeys(item, ["id", "delete"]) || !isPositiveId(item.id) || typeof item.delete !== "boolean") {
      throw new Error(`Response item ${index + 1} must contain exactly { id, delete }.`);
    }
    return { id: item.id, delete: item.delete };
  });
  if (new Set(decisions.map((item) => item.id)).size !== decisions.length) {
    throw new Error("Response ids must be unique.");
  }
  if (expectedIds) {
    if (decisions.length !== expectedIds.length || decisions.some((item, index) => item.id !== expectedIds[index])) {
      throw new Error("Response must contain every loaded id exactly once and in the original order.");
    }
  }
  return decisions;
}
