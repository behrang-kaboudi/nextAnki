import "server-only";

import { Prisma } from "@prisma/client";

import { findPersianWord } from "@/lib/tables/persianWord";
import { prisma } from "@/lib/prisma";
import { updateWord } from "@/lib/words/wordRepo";

export type LinkUnlinkedWordsToPersianWordsResult = {
  scanned: number;
  linked: number;
  updated: number;
  unchanged: number;
  missingPrimaryMeaning: number;
  missingOtherMeanings: number;
  failed: number;
};

function jsonNumberArray(value: Prisma.JsonValue | null): number[] {
  return Array.isArray(value)
    ? value.filter((item): item is number => typeof item === "number" && Number.isSafeInteger(item))
    : [];
}

function sameIds(left: number[], right: number[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function splitOtherMeanings(value: string | null): string[] {
  return value ? value.split("*").filter((part) => part.trim().length > 0) : [];
}

export async function linkUnlinkedWordsToPersianWords(): Promise<LinkUnlinkedWordsToPersianWordsResult> {
  const result: LinkUnlinkedWordsToPersianWordsResult = {
    scanned: 0,
    linked: 0,
    updated: 0,
    unchanged: 0,
    missingPrimaryMeaning: 0,
    missingOtherMeanings: 0,
    failed: 0,
  };
  let cursor: number | undefined;

  do {
    const words = await prisma.word.findMany({
      where: { meaningId: null },
      select: { id: true, meaning_fa: true, other_meanings_fa: true, otherMeaningIds: true },
      orderBy: { id: "asc" },
      take: 200,
      ...(cursor === undefined ? {} : { cursor: { id: cursor }, skip: 1 }),
    });

    for (const word of words) {
      result.scanned += 1;
      try {
        const primaryMeaning = await findPersianWord(word.meaning_fa);
        const meaningId = primaryMeaning.item?.id ?? null;
        if (meaningId === null) result.missingPrimaryMeaning += 1;

        const otherMeaningIds = new Set<number>();
        for (const rawMeaning of splitOtherMeanings(word.other_meanings_fa)) {
          const otherMeaning = await findPersianWord(rawMeaning);
          if (otherMeaning.item) otherMeaningIds.add(otherMeaning.item.id);
          else result.missingOtherMeanings += 1;
        }

        const nextOtherMeaningIds = [...otherMeaningIds];
        if (meaningId === null && sameIds(jsonNumberArray(word.otherMeaningIds), nextOtherMeaningIds)) {
          result.unchanged += 1;
          continue;
        }

        await updateWord({
          where: { id: word.id },
          data: { meaningId, otherMeaningIds: nextOtherMeaningIds },
        });
        result.updated += 1;
        if (meaningId !== null) result.linked += 1;
      } catch (error) {
        result.failed += 1;
        console.error(`Word ${word.id}:`, error);
      }
    }

    cursor = words.at(-1)?.id;
  } while (cursor !== undefined);

  return result;
}
