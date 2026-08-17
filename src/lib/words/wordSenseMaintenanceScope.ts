export const WORD_SENSE_SCOPE_KINDS = [
  "explicit_ids",
  "id_range",
  "selected_rows",
  "filtered_results",
  "all_rows",
] as const;

export type WordSenseScopeKind = (typeof WORD_SENSE_SCOPE_KINDS)[number];

export type WordSenseFilterScope = {
  q: string;
  review: "all" | "pending" | "reviewed";
  missingConceptAudio: boolean;
};

export type WordSenseMaintenanceScope =
  | { kind: "explicit_ids"; input: string }
  | { kind: "id_range"; startId: number; endId: number }
  | { kind: "selected_rows"; ids: number[] }
  | { kind: "filtered_results"; filter: WordSenseFilterScope }
  | { kind: "all_rows" };

export type NormalizedWordSenseMaintenanceScope =
  | { kind: "explicit_ids"; ids: number[] }
  | { kind: "id_range"; startId: number; endId: number; ids: number[] }
  | { kind: "selected_rows"; ids: number[] }
  | { kind: "filtered_results"; filter: WordSenseFilterScope }
  | { kind: "all_rows" };

export class ScopeValidationError extends Error {
  readonly invalidTokens: string[];

  constructor(message: string, invalidTokens: string[] = []) {
    super(message);
    this.name = "ScopeValidationError";
    this.invalidTokens = invalidTokens;
  }
}

function normalizeIds(values: unknown[]): { ids: number[]; invalidTokens: string[] } {
  const ids = new Set<number>();
  const invalidTokens: string[] = [];
  for (const value of values) {
    const token = typeof value === "string" ? value.trim() : String(value);
    const id = typeof value === "number" ? value : Number(token);
    if (!Number.isSafeInteger(id) || id <= 0) invalidTokens.push(token || "(empty)");
    else ids.add(id);
  }
  return { ids: [...ids].sort((a, b) => a - b), invalidTokens: [...new Set(invalidTokens)] };
}

export function parseWordSenseIds(input: string) {
  const trimmed = input.trim();
  if (!trimmed) throw new ScopeValidationError("Enter at least one WordSense id.");

  let values: unknown[];
  if (trimmed.startsWith("[")) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      throw new ScopeValidationError("The WordSense id JSON array is not valid JSON.");
    }
    if (!Array.isArray(parsed)) {
      throw new ScopeValidationError("WordSense ids must be a JSON array or a separated list.");
    }
    values = parsed;
  } else {
    values = trimmed.split(/[\s,]+/);
  }

  const result = normalizeIds(values);
  if (result.invalidTokens.length) {
    throw new ScopeValidationError(
      `Invalid WordSense id value(s): ${result.invalidTokens.join(", ")}`,
      result.invalidTokens,
    );
  }
  if (!result.ids.length) throw new ScopeValidationError("Enter at least one WordSense id.");
  return result.ids;
}

function validateFilter(value: unknown): WordSenseFilterScope {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ScopeValidationError("The current filtered-results scope is missing.");
  }
  const filter = value as Partial<WordSenseFilterScope>;
  if (
    typeof filter.q !== "string" ||
    !["all", "pending", "reviewed"].includes(String(filter.review)) ||
    typeof filter.missingConceptAudio !== "boolean"
  ) {
    throw new ScopeValidationError("The current filtered-results scope is invalid.");
  }
  return { q: filter.q.trim(), review: filter.review!, missingConceptAudio: filter.missingConceptAudio };
}

export function normalizeWordSenseMaintenanceScope(value: unknown): NormalizedWordSenseMaintenanceScope {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ScopeValidationError("A maintenance Scope is required.");
  }
  const scope = value as Record<string, unknown>;
  if (!WORD_SENSE_SCOPE_KINDS.includes(scope.kind as WordSenseScopeKind)) {
    throw new ScopeValidationError("The selected maintenance Scope is not supported.");
  }
  switch (scope.kind as WordSenseScopeKind) {
    case "explicit_ids":
      if (typeof scope.input !== "string") throw new ScopeValidationError("Enter WordSense ids.");
      return { kind: "explicit_ids", ids: parseWordSenseIds(scope.input) };
    case "selected_rows": {
      if (!Array.isArray(scope.ids)) throw new ScopeValidationError("Select at least one WordSense row.");
      const result = normalizeIds(scope.ids);
      if (result.invalidTokens.length) {
        throw new ScopeValidationError(`Invalid selected WordSense id(s): ${result.invalidTokens.join(", ")}`, result.invalidTokens);
      }
      if (!result.ids.length) throw new ScopeValidationError("Select at least one WordSense row.");
      return { kind: "selected_rows", ids: result.ids };
    }
    case "id_range": {
      const startId = Number(scope.startId);
      const endId = Number(scope.endId);
      if (!Number.isSafeInteger(startId) || startId <= 0 || !Number.isSafeInteger(endId) || endId <= 0) {
        throw new ScopeValidationError("Range endpoints must be positive WordSense ids.");
      }
      if (startId > endId) throw new ScopeValidationError("The range start id must not exceed the end id.");
      if (endId - startId > 100_000) throw new ScopeValidationError("The WordSense id range is too large.");
      return {
        kind: "id_range",
        startId,
        endId,
        ids: Array.from({ length: endId - startId + 1 }, (_, index) => startId + index),
      };
    }
    case "filtered_results":
      return { kind: "filtered_results", filter: validateFilter(scope.filter) };
    case "all_rows":
      return { kind: "all_rows" };
  }
}

export type SentenceLinkWordState = { id: number; sentenceIds: number[] };

export function analyzeSentenceLinkImpact(scopedWords: SentenceLinkWordState[], allWords: SentenceLinkWordState[]) {
  const scopedIds = new Set(scopedWords.map((word) => word.id));
  const affectedWords = scopedWords.filter((word) => word.sentenceIds.length > 0);
  const linkedSentenceIds = [...new Set(affectedWords.flatMap((word) => word.sentenceIds))].sort((a, b) => a - b);
  const linkedByUnselected = new Set(
    allWords
      .filter((word) => !scopedIds.has(word.id))
      .flatMap((word) => word.sentenceIds),
  );
  const sharedSentenceIds = linkedSentenceIds.filter((id) => linkedByUnselected.has(id));
  const orphanedSentenceIds = linkedSentenceIds.filter((id) => !linkedByUnselected.has(id));
  return {
    affectedWordIds: affectedWords.map((word) => word.id),
    linkCount: affectedWords.reduce((count, word) => count + word.sentenceIds.length, 0),
    linkedSentenceIds,
    sharedSentenceIds,
    orphanedSentenceIds,
  };
}

export function sameSentenceLinkState(
  expected: Array<{ id: number; sentenceIds: number[]; updatedAt: string }>,
  current: Array<{ id: number; sentenceIds: number[]; updatedAt: string }>,
) {
  if (expected.length !== current.length) return false;
  const currentById = new Map(current.map((row) => [row.id, row]));
  return expected.every((row) => {
    const match = currentById.get(row.id);
    return Boolean(match && match.updatedAt === row.updatedAt &&
      match.sentenceIds.length === row.sentenceIds.length &&
      match.sentenceIds.every((id, index) => id === row.sentenceIds[index]));
  });
}

export function missingRequestedIds(requestedIds: number[], foundIds: number[]) {
  const found = new Set(foundIds);
  return requestedIds.filter((id) => !found.has(id));
}

export function mergeRestoredSentenceIds(originalIds: number[], currentIds: number[]) {
  return [...originalIds, ...currentIds.filter((id) => !originalIds.includes(id))];
}

export function isIdempotentMaintenanceReplay(existingPreviewId: string, requestedPreviewId: string) {
  return existingPreviewId === requestedPreviewId;
}
