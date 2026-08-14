import "server-only";

import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { touchWordSensesByIds } from "@/lib/words/wordSenseRepo";

export const PERSIAN_WORD_MEANING_SELECT = {
  id: true,
  canonical_text: true,
  normalized_text: true,
  meaning_fa_IPA: true,
  meaning_fa_IPA_normalize: true,
  meaning_fa_IPA_confirmed: true,
  audio_file_name: true,
} satisfies Prisma.PersianWordSelect;

export type PersianWordMeaning = Prisma.PersianWordGetPayload<{
  select: typeof PERSIAN_WORD_MEANING_SELECT;
}>;

export type WordMeaningReference = {
  meaningId: number | null;
  otherMeaningIds: Prisma.JsonValue | null;
};

export type WordSenseWithPersianMeanings<T extends WordMeaningReference> = T & {
  primaryPersianWord: PersianWordMeaning | null;
  otherPersianWords: PersianWordMeaning[];
  // Compatibility values are derived only at read time; they are never stored on WordSense.
  meaning_fa: string;
  meaning_fa_IPA: string;
  meaning_fa_IPA_normalized: string;
  meaning_fa_IPA_confirmed: boolean;
  other_meanings_fa: string | null;
};

export function meaningIds(value: Prisma.JsonValue | null): number[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<number>();
  const ids: number[] = [];
  for (const item of value) {
    if (typeof item !== "number" || !Number.isSafeInteger(item) || item <= 0 || seen.has(item)) continue;
    seen.add(item);
    ids.push(item);
  }
  return ids;
}

export async function hydrateWordSensesWithPersianMeanings<T extends WordMeaningReference>(
  words: readonly T[],
): Promise<Array<WordSenseWithPersianMeanings<T>>> {
  if (!words.length) return [];
  const ids = Array.from(new Set(words.flatMap((word) => [word.meaningId, ...meaningIds(word.otherMeaningIds)]).filter((id): id is number => id !== null)));
  const meanings = ids.length
    ? await prisma.persianWord.findMany({ where: { id: { in: ids } }, select: PERSIAN_WORD_MEANING_SELECT })
    : [];
  const byId = new Map(meanings.map((meaning) => [meaning.id, meaning]));

  return words.map((word) => {
    const primaryPersianWord = word.meaningId == null ? null : byId.get(word.meaningId) ?? null;
    const otherPersianWords = meaningIds(word.otherMeaningIds)
      .filter((id) => id !== word.meaningId)
      .flatMap((id) => {
        const meaning = byId.get(id);
        return meaning ? [meaning] : [];
      });
    return {
      ...word,
      primaryPersianWord,
      otherPersianWords,
      meaning_fa: primaryPersianWord?.canonical_text ?? "",
      meaning_fa_IPA: primaryPersianWord?.meaning_fa_IPA ?? "",
      meaning_fa_IPA_normalized: primaryPersianWord?.meaning_fa_IPA_normalize ?? "",
      meaning_fa_IPA_confirmed: primaryPersianWord?.meaning_fa_IPA_confirmed ?? false,
      other_meanings_fa: otherPersianWords.length ? otherPersianWords.map((meaning) => meaning.canonical_text).join("*") : null,
    };
  });
}

export async function hydrateWordSenseWithPersianMeanings<T extends WordMeaningReference>(word: T) {
  return (await hydrateWordSensesWithPersianMeanings([word]))[0]!;
}

export async function touchWordsReferencingPersianWord(
  persianWordId: number,
  options?: {
    resetConceptMergeReviewed?: boolean;
    resetMeaningReviewStatus?: boolean;
  },
) {
  const references = await prisma.wordSense.findMany({
    where: {
      OR: [
        { meaningId: persianWordId },
        { otherMeaningIds: { array_contains: persianWordId } },
        { otherMeaningIds: { array_contains: String(persianWordId) } },
      ],
    },
    select: { id: true },
  });
  await touchWordSensesByIds(references.map((reference) => reference.id), options);
  return references.length;
}

export async function touchWordsReferencingPersianWords(persianWordIds: readonly number[]) {
  const targetIds = new Set(persianWordIds);
  if (!targetIds.size) return 0;
  const references = await prisma.wordSense.findMany({
    select: { id: true, meaningId: true, otherMeaningIds: true },
  });
  const wordSenseIds = references
    .filter((reference) =>
      (reference.meaningId !== null && targetIds.has(reference.meaningId)) ||
      meaningIds(reference.otherMeaningIds).some((id) => targetIds.has(id)),
    )
    .map((reference) => reference.id);
  await touchWordSensesByIds(wordSenseIds);
  return wordSenseIds.length;
}

export async function getPersianWordReferences(persianWordId: number) {
  const [primary, secondary] = await Promise.all([
    prisma.wordSense.findMany({ where: { meaningId: persianWordId }, select: { id: true, english: { select: { base_form: true } } } }),
    prisma.wordSense.findMany({
      where: {
        OR: [
          { otherMeaningIds: { array_contains: persianWordId } },
          { otherMeaningIds: { array_contains: String(persianWordId) } },
        ],
      },
      select: { id: true, english: { select: { base_form: true } } },
    }),
  ]);
  const byId = new Map<number, { id: number; base_form: string; roles: Array<"primary" | "secondary"> }>();
  for (const word of primary) byId.set(word.id, { id: word.id, base_form: word.english.base_form, roles: ["primary"] });
  for (const word of secondary) {
    const existing = byId.get(word.id);
    if (existing) existing.roles.push("secondary");
    else byId.set(word.id, { id: word.id, base_form: word.english.base_form, roles: ["secondary"] });
  }
  return [...byId.values()].sort((left, right) => left.base_form.localeCompare(right.base_form) || left.id - right.id);
}
