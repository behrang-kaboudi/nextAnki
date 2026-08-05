import dotenv from "dotenv";
import { Prisma, PrismaClient } from "@prisma/client";

import { normalizePersianFull, normalizePersianHalf } from "../src/lib/persian/normalize.ts";

dotenv.config();

const prisma = new PrismaClient();
const batchSize = 500;

type Stats = {
  wordsScanned: number;
  meaningsScanned: number;
  created: number;
  variantsAdded: number;
  unchanged: number;
  skippedNoPersianText: number;
  skippedDuplicateNormalizedText: number;
  failed: number;
};

function stringVariants(value: Prisma.JsonValue): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function splitOtherMeanings(value: string | null): string[] {
  return (value ?? "")
    .split("*")
    .map((part) => part.trim())
    .filter(Boolean);
}

async function processMeaning(rawMeaning: string, wordId: number, stats: Stats) {
  const canonicalText = normalizePersianHalf(rawMeaning);
  const normalizedText = normalizePersianFull(rawMeaning);
  if (!canonicalText || !normalizedText) {
    stats.skippedNoPersianText += 1;
    return;
  }

  const matches = await prisma.persianWord.findMany({
    where: { normalized_text: normalizedText },
    select: { id: true, canonical_text: true, not_normalized_texts: true },
    orderBy: { id: "asc" },
    take: 2,
  });

  if (matches.length > 1) {
    stats.skippedDuplicateNormalizedText += 1;
    console.warn(`Word ${wordId}: duplicate PersianWord normalized_text "${normalizedText}"; skipped.`);
    return;
  }

  const existing = matches[0];
  if (!existing) {
    await prisma.persianWord.create({
      data: {
        canonical_text: canonicalText,
        normalized_text: normalizedText,
        not_normalized_texts: rawMeaning === canonicalText ? [] : [rawMeaning],
      },
    });
    stats.created += 1;
    return;
  }

  if (rawMeaning === existing.canonical_text) {
    stats.unchanged += 1;
    return;
  }

  const variants = stringVariants(existing.not_normalized_texts);
  if (variants.includes(rawMeaning)) {
    stats.unchanged += 1;
    return;
  }

  await prisma.persianWord.update({
    where: { id: existing.id },
    data: { not_normalized_texts: [...variants, rawMeaning] },
  });
  stats.variantsAdded += 1;
}

async function main() {
  const stats: Stats = {
    wordsScanned: 0,
    meaningsScanned: 0,
    created: 0,
    variantsAdded: 0,
    unchanged: 0,
    skippedNoPersianText: 0,
    skippedDuplicateNormalizedText: 0,
    failed: 0,
  };
  let cursor: number | undefined;

  do {
    const words = await prisma.word.findMany({
      select: { id: true, other_meanings_fa: true },
      orderBy: { id: "asc" },
      take: batchSize,
      ...(cursor === undefined ? {} : { cursor: { id: cursor }, skip: 1 }),
    });

    for (const word of words) {
      stats.wordsScanned += 1;
      for (const rawMeaning of splitOtherMeanings(word.other_meanings_fa)) {
        stats.meaningsScanned += 1;
        try {
          await processMeaning(rawMeaning, word.id, stats);
        } catch (error) {
          stats.failed += 1;
          console.error(`Word ${word.id}, meaning "${rawMeaning}":`, error);
        }
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
