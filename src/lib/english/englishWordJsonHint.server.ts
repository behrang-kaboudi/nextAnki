import "server-only";

import type { PictureCandidateLookup } from "@/lib/ipa/setPictures/forChars";
import { pickPictureSymbolsForWord } from "@/lib/ipa/setPictures/setForAny";
import { createPreloadedPictureCandidateLookup } from "@/lib/ipa/setPictures/preloadedLookup";
import { prisma } from "@/lib/prisma";
import { stringifyJsonHintWithTimestamp } from "@/lib/words/jsonHint";
import { touchWordSensesByEnglishIds } from "@/lib/words/wordSenseRepo";

export type EnglishWordJsonHintInput = {
  id: number;
  phonetic_us_normalized: string | null;
};

export type EnglishWordJsonHintResult = {
  id: number;
  jsonHint: string | null;
  skippedNoPhonetic: boolean;
};

async function mapWithConcurrency<T>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  let nextIndex = 0;
  const workers = Array.from(
    { length: Math.min(Math.max(1, concurrency), items.length) },
    async () => {
      while (nextIndex < items.length) {
        const index = nextIndex;
        nextIndex += 1;
        await fn(items[index]!);
      }
    },
  );
  await Promise.all(workers);
}

export async function generateEnglishWordJsonHints(
  rows: EnglishWordJsonHintInput[],
  lookup?: PictureCandidateLookup,
): Promise<EnglishWordJsonHintResult[]> {
  if (!rows.length) return [];
  const batchLookup = lookup ?? (await createPreloadedPictureCandidateLookup());

  const results = await Promise.all(
    rows.map(async (row): Promise<EnglishWordJsonHintResult> => {
      if (!row.phonetic_us_normalized?.trim()) {
        return { id: row.id, jsonHint: null, skippedNoPhonetic: true };
      }

      const pictureSymbols = await pickPictureSymbolsForWord(
        {
          phonetic_us_normalized: row.phonetic_us_normalized,
          imageability: 64,
        },
        { lookup: batchLookup, includePersianImage: false },
      );
      return {
        id: row.id,
        jsonHint: pictureSymbols
          ? stringifyJsonHintWithTimestamp(pictureSymbols)
          : null,
        skippedNoPhonetic: false,
      };
    }),
  );

  const updates = results.filter(
    (result): result is EnglishWordJsonHintResult & { jsonHint: string } =>
      Boolean(result.jsonHint),
  );
  await mapWithConcurrency(updates, 10, async (result) => {
    await prisma.englishWord.update({
      where: { id: result.id },
      data: { json_hint: result.jsonHint },
    });
  });
  await touchWordSensesByEnglishIds(updates.map((result) => result.id));
  return results;
}

export async function generateEnglishWordJsonHint(englishWordId: number) {
  const row = await prisma.englishWord.findUnique({
    where: { id: englishWordId },
    select: { id: true, phonetic_us_normalized: true },
  });
  if (!row) throw new Error(`EnglishWord ${englishWordId} was not found`);
  const [result] = await generateEnglishWordJsonHints([row]);
  return result!;
}
