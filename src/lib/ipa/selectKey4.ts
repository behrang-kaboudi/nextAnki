import "server-only";

import { prisma } from "@/lib/prisma";
import type { PictureWord, PictureWordType, Word } from "@prisma/client";
import { extractByRegion, combination } from "@/lib/ipa/arrayCreate";
import { pickFields } from "@/lib/db/pickFields";
import { sortPictureWordsByOverlap } from "@/lib/ipa/overlap";
//(first_letter_en_hint IS NULL OR first_letter_en_hint = '')  AND
async function get4CharWords(): Promise<Word[]> {
  const rows = (await prisma.$queryRawUnsafe(
    `
SELECT *
FROM Word
WHERE  CHAR_LENGTH(phonetic_us_normalized) = 4
    `
  )) as Word[];
  return rows;
}
const GROUP_MATCH_TYPES: ReadonlySet<PictureWordType> = new Set([
  "noun",
  "person",
  "humanBody",
  "animal",
  "food",
  "place",
  "accessory",
  "tool",
  "personAdj",
  "adj",
  "personAdj_adj",
]);
function getBestMatch(matches: Array<PictureWord>, word: Word) {
  if (!matches.length) return null;
  const filtered = matches.filter((m) => {
    return GROUP_MATCH_TYPES.has(m.type);
  });
  if (!filtered.length) return null;

  const sorted = sortPictureWordsByOverlap(
    word.phonetic_us_normalized ?? "",
    filtered
  );
  return sorted[0] ?? null;
}
async function setKeys() {
  const words = await get4CharWords();
  words.map(async (w) => {
    const pre = await checkIfExists(w);
    if (pre) {
      prisma.word.update({
        where: { id: w.id },
        data: { first_letter_en_hint: pre.first_letter_en_hint },
      });
      return;
    } else {
      const keys = combination(w.phonetic_us_normalized!);
      const matches = await extractByRegion(keys);
      const bestMatch = getBestMatch(matches, w);
      if (bestMatch) {
        const hint = bestMatch.fa + "_" + bestMatch.en;
        await prisma.word.update({
          where: { id: w.id },
          data: { first_letter_en_hint: hint },
        });
      }
    }
  });
}
async function checkIfExists(word: Word) {
  const matching = await prisma.word.findFirst({
    where: {
      base_form: word.base_form,
      first_letter_en_hint: { not: "" },
      NOT: { first_letter_en_hint: null },
    },
  });

  return matching ?? null;
}
async function getMatchesFor4CharWord(ipa: string) {
  const keys = combination(ipa);
  const matches = await extractByRegion(keys);
  if (!matches.length) {
    const keys1 = combination(ipa.slice(0, 2));
    const keys2 = combination(ipa.slice(2, 4));
    console.log(`[selectKey4.ts:85]`, ipa, keys1, keys2);
  }
  return matches.filter((m) => GROUP_MATCH_TYPES.has(m.type));
}

export async function findMatchesForAll4CharWords() {
  const words = await get4CharWords();
  // await setKeys();
  const wordsWithKeys = await Promise.all(
    words.map(async (w) => {
      if (!w.phonetic_us_normalized) return { ...w, keys: [], bestMatch: null };
      const matches = await getMatchesFor4CharWord(w.phonetic_us_normalized);
      const combinationKeys = combination(w.phonetic_us_normalized);
      const keys = matches.map((r) =>
        pickFields(r, ["fa", "ipa_fa_normalized"])
      );
      const bestMatch = getBestMatch(matches, w);

      return {
        ...w,
        combinationKeys,
        keys,
        bestMatch: bestMatch
          ? pickFields(bestMatch, ["id", "fa", "ipa_fa_normalized", "type"])
          : null,
      };
    })
  );

  return { words: wordsWithKeys };
}
