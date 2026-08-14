import "server-only";

import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export const WORD_SENSE_ENGLISH_FIELDS_SELECT = {
  base_form: true,
  phonetic_us: true,
  phonetic_us_normalized: true,
  json_hint: true,
  audio_file_name: true,
  audio_source_text: true,
} satisfies Prisma.EnglishWordSelect;

export type WordSenseEnglishFields = Prisma.EnglishWordGetPayload<{
  select: typeof WORD_SENSE_ENGLISH_FIELDS_SELECT;
}>;

export type WordEnglishReference = { englishId: number };

export type WordWithEnglishFields<T extends WordEnglishReference> = T & WordSenseEnglishFields;

export type WordWithEnglishRelation<T> = T & { english: WordSenseEnglishFields };

export function flattenWordSenseEnglishRelation<T>(
  word: WordWithEnglishRelation<T>,
): T & WordSenseEnglishFields {
  const { english, ...rest } = word;
  return { ...rest, ...english } as T & WordSenseEnglishFields;
}

export async function hydrateWordSensesWithEnglishFields<T extends WordEnglishReference>(
  words: readonly T[],
): Promise<Array<WordWithEnglishFields<T>>> {
  if (!words.length) return [];
  const ids = Array.from(new Set(words.map((word) => word.englishId)));
  const englishWords = await prisma.englishWord.findMany({
    where: { id: { in: ids } },
    select: { id: true, ...WORD_SENSE_ENGLISH_FIELDS_SELECT },
  });
  const byId = new Map(englishWords.map(({ id, ...fields }) => [id, fields]));

  return words.map((word) => {
    const fields = byId.get(word.englishId);
    if (!fields) throw new Error(`EnglishWord ${word.englishId} referenced by WordSense was not found.`);
    return { ...word, ...fields };
  });
}

export async function hydrateWordSenseWithEnglishFields<T extends WordEnglishReference>(word: T) {
  return (await hydrateWordSensesWithEnglishFields([word]))[0]!;
}
