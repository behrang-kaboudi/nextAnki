import "server-only";

import type { Word } from "@prisma/client";

import { pickPictureSymbolsForWord } from "@/lib/ipa/setPictures/setForAny";
import { prisma } from "@/lib/prisma";
import { stringifyJsonHintWithTimestamp } from "@/lib/words/jsonHint";

export async function generateEnglishWordJsonHint(englishWordId: number) {
  const row = await prisma.englishWord.findUnique({
    where: { id: englishWordId },
    select: { id: true, phonetic_us_normalized: true },
  });
  if (!row) throw new Error(`EnglishWord ${englishWordId} was not found`);
  if (!row.phonetic_us_normalized?.trim()) return { jsonHint: null, skippedNoPhonetic: true };

  // The picture-symbol generator only reads these two fields when imageability is
  // at the threshold, which intentionally disables Word-only Persian-meaning logic.
  const pictureSymbols = await pickPictureSymbolsForWord({
    phonetic_us_normalized: row.phonetic_us_normalized,
    imageability: 64,
  } as Word);
  const jsonHint = pictureSymbols ? stringifyJsonHintWithTimestamp(pictureSymbols) : null;
  if (jsonHint) await prisma.englishWord.update({ where: { id: row.id }, data: { json_hint: jsonHint } });
  return { jsonHint, skippedNoPhonetic: false };
}
