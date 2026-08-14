import "server-only";

import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { meaningIds } from "@/lib/words/persianMeanings.server";

export type SynonymEnglishWord = {
  wordId: number;
  base_form: string;
  audio_file_name: string | null;
};

export type WordSynonymReference = {
  id: number;
  synonymIds: Prisma.JsonValue | null;
};

export type WordSenseWithEnglishSynonyms<T extends WordSynonymReference> = T & {
  synonymEnglishWords: SynonymEnglishWord[];
};

export async function hydrateWordSensesWithEnglishSynonyms<T extends WordSynonymReference>(
  words: readonly T[],
): Promise<Array<WordSenseWithEnglishSynonyms<T>>> {
  if (!words.length) return [];

  const ids = [...new Set(words.flatMap((word) => meaningIds(word.synonymIds)))];
  const synonyms = ids.length
    ? await prisma.wordSense.findMany({
        where: { id: { in: ids } },
        select: {
          id: true,
          english: { select: { base_form: true, audio_file_name: true } },
        },
      })
    : [];
  const byId = new Map(
    synonyms.map((synonym) => [
      synonym.id,
      {
        wordId: synonym.id,
        base_form: synonym.english.base_form,
        audio_file_name: synonym.english.audio_file_name,
      },
    ]),
  );

  return words.map((word) => ({
    ...word,
    synonymEnglishWords: meaningIds(word.synonymIds)
      .filter((id) => id !== word.id)
      .flatMap((id) => {
        const synonym = byId.get(id);
        return synonym ? [synonym] : [];
      }),
  }));
}

export async function hydrateWordSenseWithEnglishSynonyms<T extends WordSynonymReference>(word: T) {
  return (await hydrateWordSensesWithEnglishSynonyms([word]))[0]!;
}
