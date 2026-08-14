import "server-only";

import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { primarySentenceId } from "@/lib/words/sentenceIds";

export const primarySentenceSelect = {
  id: true,
  sentence_en: true,
  sentence_en_meaning_fa: true,
  sentence_en_audio_file_name: true,
  sentence_en_audio_source_text: true,
  sentence_en_meaning_fa_audio_file_name: true,
  sentence_en_meaning_fa_audio_source_text: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.SentenceSelect;

export type PrimarySentence = Prisma.SentenceGetPayload<{
  select: typeof primarySentenceSelect;
}>;

export type WordSenseWithPrimarySentence<T extends { sentenceIds: Prisma.JsonValue | null }> = T & {
  sentence: PrimarySentence | null;
};

export async function hydrateWordsWithPrimarySentence<
  T extends { sentenceIds: Prisma.JsonValue | null },
>(words: readonly T[]): Promise<Array<WordSenseWithPrimarySentence<T>>> {
  const ids = [...new Set(words.flatMap((word) => {
    const id = primarySentenceId(word.sentenceIds);
    return id ? [id] : [];
  }))];
  const sentences = ids.length
    ? await prisma.sentence.findMany({ where: { id: { in: ids } }, select: primarySentenceSelect })
    : [];
  const byId = new Map(sentences.map((sentence) => [sentence.id, sentence]));
  return words.map((word) => ({
    ...word,
    sentence: byId.get(primarySentenceId(word.sentenceIds) ?? -1) ?? null,
  }));
}

export async function wordSenseIdsWhosePrimarySentenceContains(query: string) {
  const matchingSentences = await prisma.sentence.findMany({
    where: {
      OR: [
        { sentence_en: { contains: query } },
        { sentence_en_meaning_fa: { contains: query } },
      ],
    },
    select: { id: true },
  });
  const matchingIds = new Set(matchingSentences.map((sentence) => sentence.id));
  if (!matchingIds.size) return [];
  const words = await prisma.wordSense.findMany({ select: { id: true, sentenceIds: true } });
  return words
    .filter((word) => matchingIds.has(primarySentenceId(word.sentenceIds) ?? -1))
    .map((word) => word.id);
}
