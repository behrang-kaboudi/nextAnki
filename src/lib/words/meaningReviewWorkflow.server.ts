import "server-only";

import { MeaningReviewStatus, type Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { wordSentenceIds } from "@/lib/words/sentenceIds";

export const MEANING_REVIEW_CORE_FIELDS = [
  "meaning_fa",
  "other_meanings_fa",
  "pos",
  "concept_explained_fa",
  "sentence_en",
  "sentence_en_meaning_fa",
] as const;

export type MeaningReviewCoreField = (typeof MEANING_REVIEW_CORE_FIELDS)[number];

type MeaningReviewRow = Prisma.WordSenseGetPayload<{
  select: typeof meaningReviewSelect;
}>;

const meaningReviewSelect = {
  id: true,
  meaningReviewStatus: true,
  meaningId: true,
  otherMeaningIds: true,
  pos: true,
  concept_explained_fa: true,
  sentenceIds: true,
  english: { select: { base_form: true } },
  meaning: { select: { canonical_text: true } },
} satisfies Prisma.WordSenseSelect;

export type MeaningReviewPromptRecord = {
  id: number;
  mode: "review";
  review_status: MeaningReviewStatus;
  missing_fields: MeaningReviewCoreField[];
  requested_fields: MeaningReviewCoreField[];
  base_form: string;
  meaning_fa: string | null;
  other_meanings_fa: string[] | null;
  pos: string | null;
  concept_explained_fa: string | null;
  sentences: Array<{
    id: number;
    sentence_en: string;
    sentence_en_meaning_fa: string | null;
  }>;
};

export type MeaningReviewEligibilitySummary = {
  totalEligible: number;
  pendingReview: number;
  excludedMissingMeaning: number;
  needsAction: number;
  missingOtherMeanings: number;
  missingPos: number;
  missingConcept: number;
  missingSentence: number;
  missingSentenceTranslation: number;
};

function nonBlank(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function referencedIds(value: Prisma.JsonValue | null) {
  return wordSentenceIds(value);
}

function otherMeaningIds(value: Prisma.JsonValue | null) {
  if (!Array.isArray(value)) return null;
  const ids = value.filter(
    (item): item is number =>
      typeof item === "number" && Number.isSafeInteger(item) && item > 0,
  );
  return ids.length === value.length && new Set(ids).size === ids.length
    ? ids
    : null;
}

function buildPromptRecord(
  row: MeaningReviewRow,
  sentencesById: Map<number, {
    id: number;
    sentence_en: string;
    sentence_en_meaning_fa: string | null;
  }>,
  otherMeaningsById: Map<number, string>,
): MeaningReviewPromptRecord {
  const meaningFa = nonBlank(row.meaning?.canonical_text);
  const pos = nonBlank(row.pos);
  const concept = nonBlank(row.concept_explained_fa);
  const sentences = referencedIds(row.sentenceIds).flatMap((id) => {
    const sentence = sentencesById.get(id);
    const sentenceEn = nonBlank(sentence?.sentence_en);
    return sentence && sentenceEn
      ? [{
          id: sentence.id,
          sentence_en: sentenceEn,
          sentence_en_meaning_fa: nonBlank(sentence.sentence_en_meaning_fa),
        }]
      : [];
  });
  const storedOtherIds = otherMeaningIds(row.otherMeaningIds);
  const resolvedOtherMeanings = storedOtherIds?.flatMap((id) => {
    const meaning = nonBlank(otherMeaningsById.get(id));
    return meaning ? [meaning] : [];
  }) ?? null;
  const otherMeanings =
    storedOtherIds !== null && resolvedOtherMeanings?.length === storedOtherIds.length
      ? resolvedOtherMeanings
      : null;

  const missingFields: MeaningReviewCoreField[] = [];
  if (!meaningFa) missingFields.push("meaning_fa");
  if (otherMeanings === null) missingFields.push("other_meanings_fa");
  if (!pos) missingFields.push("pos");
  if (!concept) missingFields.push("concept_explained_fa");
  if (!sentences.length) missingFields.push("sentence_en");
  if (sentences.some((sentence) => !sentence.sentence_en_meaning_fa)) {
    missingFields.push("sentence_en_meaning_fa");
  }

  return {
    id: row.id,
    mode: "review",
    review_status: row.meaningReviewStatus,
    missing_fields: missingFields,
    requested_fields: missingFields.filter((field) => field !== "meaning_fa"),
    base_form: row.english.base_form,
    meaning_fa: meaningFa,
    other_meanings_fa: otherMeanings,
    pos,
    concept_explained_fa: concept,
    sentences,
  };
}

export function summarizeMeaningReviewEligibility(
  records: readonly MeaningReviewPromptRecord[],
): MeaningReviewEligibilitySummary {
  const eligible = records.filter(isMeaningReviewEligible);
  const has = (record: MeaningReviewPromptRecord, field: MeaningReviewCoreField) =>
    record.missing_fields.includes(field);
  return {
    totalEligible: eligible.length,
    pendingReview: eligible.length,
    excludedMissingMeaning: records.filter((record) => !record.meaning_fa).length,
    needsAction: records.filter((record) => record.review_status.startsWith("NEEDS_ACTION_")).length,
    missingOtherMeanings: eligible.filter((record) => has(record, "other_meanings_fa")).length,
    missingPos: eligible.filter((record) => has(record, "pos")).length,
    missingConcept: eligible.filter((record) => has(record, "concept_explained_fa")).length,
    missingSentence: eligible.filter((record) => has(record, "sentence_en")).length,
    missingSentenceTranslation: eligible.filter((record) => has(record, "sentence_en_meaning_fa")).length,
  };
}

export function isMeaningReviewEligible(record: MeaningReviewPromptRecord) {
  return Boolean(
    record.meaning_fa && record.review_status === MeaningReviewStatus.PENDING,
  );
}

export async function loadMeaningReviewPromptRecords(options: {
  ids?: readonly number[];
  eligibleOnly?: boolean;
} = {}) {
  const rows = await prisma.wordSense.findMany({
    where: options.ids ? { id: { in: [...options.ids] } } : undefined,
    orderBy: { id: "asc" },
    select: meaningReviewSelect,
  });
  const sentenceIds = [...new Set(rows.flatMap((row) => referencedIds(row.sentenceIds)))];
  const rawOtherMeaningIds = [...new Set(rows.flatMap((row) => otherMeaningIds(row.otherMeaningIds) ?? []))];
  const [sentences, otherMeanings] = await Promise.all([
    sentenceIds.length
      ? prisma.sentence.findMany({
          where: { id: { in: sentenceIds } },
          select: { id: true, sentence_en: true, sentence_en_meaning_fa: true },
        })
      : [],
    rawOtherMeaningIds.length
      ? prisma.persianWord.findMany({
          where: { id: { in: rawOtherMeaningIds } },
          select: { id: true, canonical_text: true },
        })
      : [],
  ]);
  const sentencesById = new Map(sentences.map((sentence) => [sentence.id, sentence]));
  const otherMeaningsById = new Map(
    otherMeanings.map((meaning) => [meaning.id, meaning.canonical_text]),
  );
  const records = rows.map((row) => buildPromptRecord(row, sentencesById, otherMeaningsById));
  return options.eligibleOnly
    ? records.filter(isMeaningReviewEligible)
    : records;
}

export async function getMeaningReviewEligibilitySummary() {
  return summarizeMeaningReviewEligibility(await loadMeaningReviewPromptRecords());
}
