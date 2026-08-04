import dotenv from "dotenv";
import { Prisma, PrismaClient } from "@prisma/client";

import { normalizePersianFull, normalizePersianHalf } from "../src/lib/persian/normalize.ts";

dotenv.config();

const prisma = new PrismaClient();
const batchSize = 500;
const dryRun = process.env.DRY_RUN === "1";

type Stats = {
  scanned: number;
  created: number;
  variantsAdded: number;
  unchanged: number;
  skippedNoPersianText: number;
  skippedDuplicateNormalizedText: number;
  skippedIpaConflict: number;
  failed: number;
};

function emptyStats(): Stats {
  return {
    scanned: 0,
    created: 0,
    variantsAdded: 0,
    unchanged: 0,
    skippedNoPersianText: 0,
    skippedDuplicateNormalizedText: 0,
    skippedIpaConflict: 0,
    failed: 0,
  };
}

function stringVariants(value: Prisma.JsonValue): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function isUniqueIpaError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

async function processWord(
  word: { id: number; meaning_fa: string; meaning_fa_IPA: string; meaning_fa_IPA_normalized: string },
  stats: Stats
) {
  const rawMeaning = word.meaning_fa;
  const normalizedText = normalizePersianFull(rawMeaning);
  const canonicalText = normalizePersianHalf(rawMeaning);

  if (!normalizedText || !canonicalText) {
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
    console.warn(
      `Word ${word.id}: more than one PersianWord has normalized_text "${normalizedText}"; skipped.`
    );
    return;
  }

  const existing = matches[0];
  if (!existing) {
    try {
      if (!dryRun) {
        await prisma.persianWord.create({
          data: {
            canonical_text: canonicalText,
            normalized_text: normalizedText,
            not_normalized_texts: rawMeaning === canonicalText ? [] : [rawMeaning],
            meaning_fa_IPA: word.meaning_fa_IPA || null,
            meaning_fa_IPA_normalize: word.meaning_fa_IPA_normalized || null,
          },
        });
      }
      stats.created += 1;
    } catch (error) {
      if (isUniqueIpaError(error)) {
        stats.skippedIpaConflict += 1;
        console.warn(
          `Word ${word.id}: non-empty meaning_fa_IPA is already used by another PersianWord; skipped.`
        );
        return;
      }
      throw error;
    }
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

  if (!dryRun) {
    await prisma.persianWord.update({
      where: { id: existing.id },
      data: { not_normalized_texts: [...variants, rawMeaning] },
    });
  }
  stats.variantsAdded += 1;
}

async function main() {
  const stats = emptyStats();
  let cursor: number | undefined;

  do {
    const words = await prisma.word.findMany({
      select: {
        id: true,
        meaning_fa: true,
        meaning_fa_IPA: true,
        meaning_fa_IPA_normalized: true,
      },
      orderBy: { id: "asc" },
      take: batchSize,
      ...(cursor === undefined ? {} : { cursor: { id: cursor }, skip: 1 }),
    });

    for (const word of words) {
      stats.scanned += 1;
      try {
        await processWord(word, stats);
      } catch (error) {
        stats.failed += 1;
        console.error(`Word ${word.id}:`, error);
      }
    }

    cursor = words.at(-1)?.id;
  } while (cursor !== undefined);

  console.log(JSON.stringify({ dryRun, ...stats }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
