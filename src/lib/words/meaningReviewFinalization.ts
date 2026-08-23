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
  review_status?: string;
  base_form?: string;
  meaning_fa?: string | null;
  other_meanings_fa?: string[] | null;
  pos?: string | null;
  concept_explained_fa?: string | null;
  sentences?: Array<{
    id: number;
    sentence_en: string;
    sentence_en_meaning_fa: string | null;
  }>;
};

export type MeaningReviewResultRecord = {
  id: number;
  mode: "review";
  review_status: "CONFIRMED" | "NEEDS_ACTION_INVALID_PRIMARY";
  base_form: string;
  meaning_fa: string | null;
  other_meanings_fa: string[] | null;
  pos: string | null;
  concept_explained_fa: string | null;
  sentences: Array<{
    sentence_id: number | null;
    sentence_en: string;
    sentence_en_meaning_fa: string | null;
  }>;
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

function sameArray<T>(left: readonly T[], right: readonly T[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function requirePreviewRecord(record: MeaningReviewPreviewRecord) {
  if (
    !record.base_form ||
    !Array.isArray(record.sentences) ||
    record.sentences.some((sentence) => !positiveInt(sentence.id) || !sentence.sentence_en?.trim())
  ) {
    throw new Error(`WordSense ${record.id} does not contain a complete current preview snapshot.`);
  }
}

export function buildMeaningReviewResultRecord(
  record: MeaningReviewPreviewRecord,
  correction?: MeaningReviewCorrection,
): MeaningReviewResultRecord {
  requirePreviewRecord(record);
  if (correction && (correction.id !== record.id || correction.mode !== "review")) {
    throw new Error(`WordSense ${record.id} received a correction for a different record or mode.`);
  }
  if (correction?.invalid_primary_meaning && Object.keys(correction).some((key) =>
    !["id", "mode", "invalid_primary_meaning"].includes(key)
  )) {
    throw new Error(`Invalid-primary-meaning result for WordSense ${record.id} cannot contain content changes.`);
  }
  const invalidSentenceIds = new Set(correction?.invalid_sentence_ids ?? []);
  const currentSentenceIds = new Set(record.sentences!.map((sentence) => sentence.id));
  const currentSentences = new Map(record.sentences!.map((sentence) => [sentence.id, sentence]));
  if ([...invalidSentenceIds].some((id) => !currentSentenceIds.has(id))) {
    throw new Error(`WordSense ${record.id} contains an unrelated invalid_sentence_id.`);
  }
  const proposedSentences = correction?.sentences ?? [];
  const newSentences = proposedSentences.filter((sentence) => sentence.sentence_id === null);
  const existingSentenceChanges = proposedSentences.filter((sentence) => sentence.sentence_id !== null);
  if (newSentences.length > 1 || existingSentenceChanges.some((sentence) =>
    !currentSentenceIds.has(sentence.sentence_id as number)
  )) {
    throw new Error(`WordSense ${record.id} contains an invalid sentence proposal.`);
  }
  if (existingSentenceChanges.some((sentence) =>
    sentence.sentence_en !== undefined &&
    sentence.sentence_en !== currentSentences.get(sentence.sentence_id as number)?.sentence_en
  )) {
    throw new Error(`WordSense ${record.id} cannot replace existing sentence text in place.`);
  }
  if (invalidSentenceIds.size > 0 && newSentences.length !== 1) {
    throw new Error(`WordSense ${record.id} requires one replacement sentence for invalid sentences.`);
  }
  if (newSentences.length > 0 && record.sentences!.length > 0 && invalidSentenceIds.size === 0) {
    throw new Error(`WordSense ${record.id} cannot add a new sentence without replacing an invalid sentence.`);
  }
  const sentenceCorrections = new Map(
    proposedSentences
      .filter((sentence) => sentence.sentence_id !== null)
      .map((sentence) => [sentence.sentence_id as number, sentence]),
  );
  const sentences: MeaningReviewResultRecord["sentences"] = record.sentences!
    .filter((sentence) => !invalidSentenceIds.has(sentence.id))
    .map((sentence) => ({
      sentence_id: sentence.id,
      sentence_en: sentence.sentence_en,
      sentence_en_meaning_fa:
        sentenceCorrections.get(sentence.id)?.sentence_en_meaning_fa ?? sentence.sentence_en_meaning_fa,
    }));
  const newSentence = newSentences[0];
  if (newSentence?.sentence_en) {
    const currentIds = record.sentences!.map((sentence) => sentence.id);
    const replacementIndex = invalidSentenceIds.size
      ? Math.min(...[...invalidSentenceIds].map((id) => currentIds.indexOf(id)).filter((index) => index >= 0))
      : sentences.length;
    sentences.splice(Math.min(replacementIndex, sentences.length), 0, {
      sentence_id: null,
      sentence_en: newSentence.sentence_en,
      sentence_en_meaning_fa: newSentence.sentence_en_meaning_fa ?? null,
    });
  }
  return {
    id: record.id,
    mode: "review",
    review_status: correction?.invalid_primary_meaning
      ? "NEEDS_ACTION_INVALID_PRIMARY"
      : "CONFIRMED",
    base_form: record.base_form!,
    meaning_fa: correction?.meaning_fa ?? record.meaning_fa ?? null,
    other_meanings_fa: correction?.other_meanings_fa ?? record.other_meanings_fa ?? null,
    pos: correction?.pos ?? record.pos ?? null,
    concept_explained_fa: correction?.concept_explained_fa ?? record.concept_explained_fa ?? null,
    sentences,
  };
}

function parseResultRecord(id: number, value: string): MeaningReviewResultRecord {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error(`The resulting JSON for WordSense ${id} is not valid JSON.`);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`The resulting JSON for WordSense ${id} must be an object.`);
  }
  const item = parsed as Record<string, unknown>;
  const allowedKeys = new Set([
    "id", "mode", "review_status", "base_form", "meaning_fa", "other_meanings_fa",
    "pos", "concept_explained_fa", "sentences",
  ]);
  if (
    Object.keys(item).some((key) => !allowedKeys.has(key)) ||
    item.id !== id ||
    item.mode !== "review" ||
    !["CONFIRMED", "NEEDS_ACTION_INVALID_PRIMARY"].includes(String(item.review_status)) ||
    typeof item.base_form !== "string" ||
    !(item.meaning_fa === null || typeof item.meaning_fa === "string") ||
    !(item.other_meanings_fa === null || (
      Array.isArray(item.other_meanings_fa) &&
      item.other_meanings_fa.every((meaning) => typeof meaning === "string" && meaning.trim())
    )) ||
    !(item.pos === null || typeof item.pos === "string") ||
    !(item.concept_explained_fa === null || typeof item.concept_explained_fa === "string") ||
    !Array.isArray(item.sentences)
  ) {
    throw new Error(`The resulting JSON for WordSense ${id} has an invalid shape or protected field.`);
  }
  const sentenceKeys = new Set(["sentence_id", "sentence_en", "sentence_en_meaning_fa"]);
  const sentences = item.sentences as Array<Record<string, unknown>>;
  if (sentences.some((sentence) =>
    !sentence || typeof sentence !== "object" || Array.isArray(sentence) ||
    Object.keys(sentence).some((key) => !sentenceKeys.has(key)) ||
    !(sentence.sentence_id === null || positiveInt(sentence.sentence_id)) ||
    typeof sentence.sentence_en !== "string" || !sentence.sentence_en.trim() ||
    !(sentence.sentence_en_meaning_fa === null || typeof sentence.sentence_en_meaning_fa === "string")
  )) {
    throw new Error(`The resulting sentences for WordSense ${id} are invalid.`);
  }
  return item as unknown as MeaningReviewResultRecord;
}

export function meaningReviewCorrectionFromResult(
  record: MeaningReviewPreviewRecord,
  result: MeaningReviewResultRecord,
): MeaningReviewCorrection | undefined {
  requirePreviewRecord(record);
  if (result.id !== record.id || result.mode !== "review" || result.base_form !== record.base_form) {
    throw new Error(`WordSense ${record.id} must keep the same id, mode, and base_form.`);
  }
  const currentResult = buildMeaningReviewResultRecord(record);
  if (result.review_status === "NEEDS_ACTION_INVALID_PRIMARY") {
    const unchangedContent = { ...result, review_status: "CONFIRMED" as const };
    if (JSON.stringify(unchangedContent) !== JSON.stringify(currentResult)) {
      throw new Error(`WordSense ${record.id} cannot edit content while marking the primary meaning invalid.`);
    }
    return { id: record.id, mode: "review", invalid_primary_meaning: true };
  }
  if (result.review_status !== "CONFIRMED") {
    throw new Error(`WordSense ${record.id} must end as CONFIRMED or NEEDS_ACTION_INVALID_PRIMARY.`);
  }
  if (!result.meaning_fa?.trim() || !Array.isArray(result.other_meanings_fa) ||
      !result.pos?.trim() || !result.concept_explained_fa?.trim() || !result.sentences.length ||
      result.sentences.some((sentence) => !sentence.sentence_en_meaning_fa?.trim())) {
    throw new Error(`WordSense ${record.id} would still have incomplete core fields.`);
  }
  const resultOtherMeanings = result.other_meanings_fa as string[];

  const correction: MeaningReviewCorrection = { id: record.id, mode: "review" };
  if (result.meaning_fa !== record.meaning_fa) correction.meaning_fa = result.meaning_fa;
  if (record.other_meanings_fa == null || !sameArray(resultOtherMeanings, record.other_meanings_fa)) {
    correction.other_meanings_fa = resultOtherMeanings;
  }
  if (result.pos !== record.pos) correction.pos = result.pos;
  if (result.concept_explained_fa !== record.concept_explained_fa) {
    correction.concept_explained_fa = result.concept_explained_fa;
  }

  const currentSentences = new Map(record.sentences!.map((sentence) => [sentence.id, sentence]));
  const numericSentenceIds = result.sentences
    .filter((sentence) => sentence.sentence_id !== null)
    .map((sentence) => sentence.sentence_id as number);
  if (new Set(numericSentenceIds).size !== numericSentenceIds.length ||
      numericSentenceIds.some((sentenceId) => !currentSentences.has(sentenceId))) {
    throw new Error(`WordSense ${record.id} contains a duplicate or unrelated existing sentence.`);
  }
  for (const sentence of result.sentences) {
    if (sentence.sentence_id === null) continue;
    const current = currentSentences.get(sentence.sentence_id)!;
    if (sentence.sentence_en !== current.sentence_en) {
      throw new Error(`Existing Sentence ${sentence.sentence_id} text cannot be replaced in place.`);
    }
  }
  const invalidIds = record.sentences!
    .filter((sentence) => !numericSentenceIds.includes(sentence.id))
    .map((sentence) => sentence.id);
  const newSentences = result.sentences.filter((sentence) => sentence.sentence_id === null);
  if (newSentences.length > 1 || (invalidIds.length > 0 && newSentences.length !== 1) ||
      (newSentences.length > 0 && record.sentences!.length > 0 && invalidIds.length === 0)) {
    throw new Error(`WordSense ${record.id} must use exactly one new sentence when replacing existing sentences.`);
  }
  const expectedExistingOrder = record.sentences!
    .filter((sentence) => !invalidIds.includes(sentence.id))
    .map((sentence) => sentence.id);
  if (!sameArray(numericSentenceIds, expectedExistingOrder)) {
    throw new Error(`WordSense ${record.id} cannot reorder existing sentences in this review.`);
  }
  const sentenceResults: NonNullable<MeaningReviewCorrection["sentences"]> = [];
  for (const sentence of result.sentences) {
    if (sentence.sentence_id === null) {
      sentenceResults.push({
        sentence_id: null,
        sentence_en: sentence.sentence_en.trim(),
        sentence_en_meaning_fa: sentence.sentence_en_meaning_fa!.trim(),
      });
      continue;
    }
    const current = currentSentences.get(sentence.sentence_id)!;
    if (sentence.sentence_en_meaning_fa !== current.sentence_en_meaning_fa) {
      sentenceResults.push({
        sentence_id: sentence.sentence_id,
        sentence_en_meaning_fa: sentence.sentence_en_meaning_fa!.trim(),
      });
    }
  }
  if (sentenceResults.length) correction.sentences = sentenceResults;
  if (invalidIds.length) correction.invalid_sentence_ids = invalidIds;
  return Object.keys(correction).length > 2 ? correction : undefined;
}

export function parseMeaningReviewResultDraft(
  record: MeaningReviewPreviewRecord,
  value: string,
) {
  return meaningReviewCorrectionFromResult(record, parseResultRecord(record.id, value));
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

export function prepareMeaningReviewFinalization(args: {
  previewRecords: readonly MeaningReviewPreviewRecord[];
  drafts: Readonly<Record<number, string>>;
  confirmedIds: ReadonlySet<number>;
}): MeaningReviewFinalizationRequest {
  const records = args.previewRecords.filter((record) => !args.confirmedIds.has(record.id));
  const ids = records.map((record) => record.id);
  if (!ids.length) {
    throw new Error("Every record in this preview has already been processed. There is nothing left to apply.");
  }
  if (new Set(ids).size !== ids.length) {
    throw new Error("The preview contains duplicate WordSense ids.");
  }
  const results = records.flatMap((record) => {
    const draft = args.drafts[record.id];
    if (!draft) throw new Error(`The resulting JSON for WordSense ${record.id} is missing.`);
    const correction = parseMeaningReviewResultDraft(record, draft);
    return correction ? [correction] : [];
  });
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
