import "server-only";

import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export type MeaningReviewSentenceSource = {
  sentenceId: number | null;
  sentenceIds: Prisma.JsonValue | null;
};

export function meaningReviewSentenceIds(word: MeaningReviewSentenceSource) {
  const arrayIds = Array.isArray(word.sentenceIds)
    ? word.sentenceIds.filter(
        (id): id is number =>
          typeof id === "number" && Number.isSafeInteger(id) && id > 0,
      )
    : [];
  return [...new Set([
    ...(word.sentenceId === null ? [] : [word.sentenceId]),
    ...arrayIds,
  ])];
}

export async function hydrateMeaningReviewSentences<
  T extends MeaningReviewSentenceSource,
>(words: readonly T[]) {
  const ids = [...new Set(words.flatMap(meaningReviewSentenceIds))];
  const sentences = ids.length
    ? await prisma.sentence.findMany({
        where: { id: { in: ids } },
        select: {
          id: true,
          sentence_en: true,
          sentence_en_meaning_fa: true,
        },
      })
    : [];
  const byId = new Map(sentences.map((sentence) => [sentence.id, sentence]));
  return words.map((word) => ({
    ...word,
    reviewSentences: meaningReviewSentenceIds(word).flatMap((id) => {
      const sentence = byId.get(id);
      return sentence ? [sentence] : [];
    }),
  }));
}
