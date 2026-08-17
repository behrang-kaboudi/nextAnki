export type MeaningReviewCorrection = {
  id: number;
  mode: "review";
  invalid_primary_meaning?: true;
  meaning_fa?: string;
  other_meanings_fa?: string[];
  pos?: string;
  concept_explained_fa?: string;
  sentences?: Array<{
    sentence_id: number | null;
    sentence_en?: string;
    sentence_en_meaning_fa?: string;
  }>;
  invalid_sentence_ids?: number[];
};

export type MeaningReviewPreviewRecord = {
  id: number;
  mode: "review";
  missing_fields: string[];
};

export type MeaningReviewFinalizationRequest = {
  ids: number[];
  results: MeaningReviewCorrection[];
  requestKey: string;
};

export type MeaningReviewOutcome = {
  id: number;
  status: "updated" | "review_confirmed" | "already_current" | "attention_required";
  contentChanged: boolean;
  reviewStatusChanged: boolean;
  attentionRequired: boolean;
};

export class MeaningReviewSingleFlight {
  private active = false;

  begin() {
    if (this.active) return false;
    this.active = true;
    return true;
  }

  end() {
    this.active = false;
  }
}

function positiveInt(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

export function meaningReviewRequestKey(
  ids: readonly number[],
  results: readonly MeaningReviewCorrection[],
) {
  const normalize = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(normalize);
    if (value && typeof value === "object") {
      const record = value as Record<string, unknown>;
      return Object.fromEntries(
        Object.keys(record).sort().map((key) => [key, normalize(record[key])]),
      );
    }
    return value;
  };
  const source = JSON.stringify(normalize({ ids, results }));
  let hash = 0x811c9dc5;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `meaning-review-v1-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function parseDraft(id: number, value: string): MeaningReviewCorrection {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error(`The proposed JSON for WordSense ${id} is not valid JSON.`);
  }
  if (
    !parsed || typeof parsed !== "object" || Array.isArray(parsed) ||
    !positiveInt((parsed as Record<string, unknown>).id) ||
    (parsed as Record<string, unknown>).id !== id ||
    (parsed as Record<string, unknown>).mode !== "review"
  ) {
    throw new Error(`The proposed JSON for WordSense ${id} must keep the same id and mode=review.`);
  }
  return parsed as MeaningReviewCorrection;
}

export function prepareMeaningReviewFinalization(args: {
  previewRecords: readonly MeaningReviewPreviewRecord[];
  corrections: readonly MeaningReviewCorrection[];
  drafts: Readonly<Record<number, string>>;
  confirmedIds: ReadonlySet<number>;
}): MeaningReviewFinalizationRequest {
  const ids = args.previewRecords
    .filter((record) => !args.confirmedIds.has(record.id))
    .map((record) => record.id);
  if (!ids.length) {
    throw new Error("Every record in this preview has already been processed. There is nothing left to apply.");
  }
  if (new Set(ids).size !== ids.length) {
    throw new Error("The preview contains duplicate WordSense ids.");
  }
  const targetIds = new Set(ids);
  const results = args.corrections
    .filter((correction) => targetIds.has(correction.id))
    .map((correction) => parseDraft(
      correction.id,
      args.drafts[correction.id] ?? JSON.stringify(correction),
    ));
  if (new Set(results.map((result) => result.id)).size !== results.length) {
    throw new Error("The preview contains duplicate proposed results.");
  }
  return {
    ids,
    results,
    requestKey: meaningReviewRequestKey(ids, results),
  };
}

export function summarizeMeaningReviewOutcomes(outcomes: readonly MeaningReviewOutcome[]) {
  const appliedIds = outcomes.filter((outcome) => outcome.status === "updated").map((outcome) => outcome.id);
  const reviewedOnlyIds = outcomes.filter((outcome) => outcome.status === "review_confirmed").map((outcome) => outcome.id);
  const alreadyCurrentIds = outcomes.filter((outcome) => outcome.status === "already_current").map((outcome) => outcome.id);
  const attentionRequiredIds = outcomes.filter((outcome) => outcome.attentionRequired).map((outcome) => outcome.id);
  return {
    total: outcomes.length,
    updated: appliedIds.length,
    reviewConfirmed: reviewedOnlyIds.length,
    unchanged: alreadyCurrentIds.length,
    attentionRequired: attentionRequiredIds.length,
    appliedIds,
    reviewedOnlyIds,
    alreadyCurrentIds,
    attentionRequiredIds,
    failed: [] as Array<{ id: number | null; reason: string }>,
    idempotentReplay:
      alreadyCurrentIds.length > 0 && appliedIds.length === 0 && reviewedOnlyIds.length === 0,
  };
}

export function meaningReviewAtomicFailure(id: number | undefined, reason: string) {
  return {
    atomic: true as const,
    rolledBack: true as const,
    failedId: id,
    appliedIds: [] as number[],
    reviewedOnlyIds: [] as number[],
    alreadyCurrentIds: [] as number[],
    attentionRequiredIds: [] as number[],
    failed: [{ id: id ?? null, reason }],
  };
}
