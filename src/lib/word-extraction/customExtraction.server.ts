import "server-only";

import { Prisma } from "@prisma/client";

import type { CustomExtractionFieldKey } from "@/lib/word-extraction/customExtractionFields";
import { prisma } from "@/lib/prisma";
import { wordSentenceIds } from "@/lib/words/sentenceIds";
import { meaningReviewNotNeedsActionWhere } from "@/lib/words/meaningReviewStatus";

export async function listWordIdsMissingSentenceTranslation() {
  const missingSentences = await prisma.sentence.findMany({
    where: { OR: [{ sentence_en_meaning_fa: null }, { sentence_en_meaning_fa: "" }] },
    select: { id: true },
  });
  const missingIds = new Set(missingSentences.map((sentence) => sentence.id));
  if (!missingIds.size) return [];

  const words = await prisma.wordSense.findMany({
    where: meaningReviewNotNeedsActionWhere,
    select: { id: true, sentenceIds: true },
  });
  return words
    .filter((word) => wordSentenceIds(word.sentenceIds).some((sentenceId) => missingIds.has(sentenceId)))
    .map((word) => word.id);
}

export function customExtractionMissingWhere(field: CustomExtractionFieldKey): Prisma.WordSenseWhereInput {
  switch (field) {
    case "base_form":
      return { english: { base_form: "" } };
    case "meaning_fa":
      return { OR: [{ meaning: { is: null } }, { meaning: { is: { canonical_text: "" } } }] };
    case "other_meanings_fa":
      return {
        meaning: { isNot: null },
        OR: [
          { otherMeaningIds: { equals: Prisma.DbNull } },
          { otherMeaningIds: { equals: Prisma.JsonNull } },
        ],
      };
    case "meaning_fa_IPA":
      return { meaning: { is: { OR: [{ meaning_fa_IPA: null }, { meaning_fa_IPA: "" }] } } };
    case "phonetic_us":
      return { OR: [{ english: { phonetic_us: null } }, { english: { phonetic_us: "" } }] };
    case "sentence_en":
      return {
        OR: [
          { sentenceIds: { equals: Prisma.DbNull } },
          { sentenceIds: { equals: Prisma.JsonNull } },
          { sentenceIds: { equals: [] } },
        ],
      };
    case "sentence_en_meaning_fa":
      // `sentenceIds` is JSON, so this cross-table condition is resolved by
      // listWordIdsMissingSentenceTranslation() before building the WordSense query.
      return { id: { lt: 0 } };
    case "imageability":
      return { OR: [{ imageability: null }, { imageability: { lte: 0 } }] };
    case "learning_depth":
      return { OR: [{ learning_depth: null }, { learning_depth: 0 }] };
    case "productive_target":
      return { OR: [{ productive_target: null }, { productive_target: 0 }] };
    case "pos":
      return { OR: [{ pos: null }, { pos: "" }] };
    case "concept_explained_fa":
      return { OR: [{ concept_explained_fa: null }, { concept_explained_fa: "" }] };
    case "other_meanings_en":
      return { OR: [{ other_meanings_en: null }, { other_meanings_en: "" }] };
    case "category":
      return { OR: [{ category: null }, { category: "" }] };
    case "hint_to_select":
      return { OR: [{ hint_to_select: null }, { hint_to_select: "" }] };
  }
}

export async function countCustomExtractionPendingWork(
  field: CustomExtractionFieldKey,
) {
  if (field === "sentence_en_meaning_fa") {
    return (await listWordIdsMissingSentenceTranslation()).length;
  }
  if (field === "other_meanings_fa") {
    return prisma.wordSense.count({
      where: { AND: [meaningReviewNotNeedsActionWhere, customExtractionMissingWhere(field)] },
    });
  }
  return prisma.wordSense.count({
    where: { AND: [meaningReviewNotNeedsActionWhere, customExtractionMissingWhere(field)] },
  });
}
