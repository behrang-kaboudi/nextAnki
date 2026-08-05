import dotenv from "dotenv";
import { Prisma, PrismaClient } from "@prisma/client";

dotenv.config();

const { findPersianWord } = await import("../src/lib/tables/persianWord.ts");
const prisma = new PrismaClient();
const batchSize = 200;

type Stats = {
  scanned: number;
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
  if (!value) return [];
  return value.split("*").filter((part) => part.trim().length > 0);
}

async function idsForOtherMeanings(value: string | null, stats: Stats): Promise<number[]> {
  const ids = new Set<number>();
  for (const rawMeaning of splitOtherMeanings(value)) {
    const result = await findPersianWord(rawMeaning);
    if (!result.item) {
      stats.missingOtherMeanings += 1;
      continue;
    }
    ids.add(result.item.id);
  }
  return [...ids];
}

async function main() {
  const stats: Stats = {
    scanned: 0,
    updated: 0,
    unchanged: 0,
    missingPrimaryMeaning: 0,
    missingOtherMeanings: 0,
    failed: 0,
  };
  let cursor: number | undefined;

  do {
    const words = await prisma.word.findMany({
      select: {
        id: true,
        meaning_fa: true,
        other_meanings_fa: true,
        meaningId: true,
        otherMeaningIds: true,
      },
      orderBy: { id: "asc" },
      take: batchSize,
      ...(cursor === undefined ? {} : { cursor: { id: cursor }, skip: 1 }),
    });

    for (const word of words) {
      stats.scanned += 1;
      try {
        const primaryMeaning = await findPersianWord(word.meaning_fa);
        const meaningId = primaryMeaning.item?.id ?? null;
        if (meaningId === null) stats.missingPrimaryMeaning += 1;

        const otherMeaningIds = await idsForOtherMeanings(word.other_meanings_fa, stats);
        if (
          word.meaningId === meaningId &&
          Array.isArray(word.otherMeaningIds) &&
          sameIds(jsonNumberArray(word.otherMeaningIds), otherMeaningIds)
        ) {
          stats.unchanged += 1;
          continue;
        }

        await prisma.word.update({
          where: { id: word.id },
          data: { meaningId, otherMeaningIds },
        });
        stats.updated += 1;
      } catch (error) {
        stats.failed += 1;
        console.error(`Word ${word.id}:`, error);
      }
    }

    cursor = words.at(-1)?.id;
  } while (cursor !== undefined);

  console.log(JSON.stringify(stats, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
