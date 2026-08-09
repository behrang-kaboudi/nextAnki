import "server-only";

import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { wordSentenceIds } from "@/lib/words/sentenceIds";

export type MeaningReviewSentenceSource = {
  sentenceIds: Prisma.JsonValue | null;
};

export function meaningReviewSentenceIds(word: MeaningReviewSentenceSource) {
  return wordSentenceIds(word.sentenceIds);
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
