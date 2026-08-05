import "server-only";

import { prisma } from "@/lib/prisma";
import type { PictureWord, PictureWordType, Word } from "@prisma/client";
import { extractByRegion, combination } from "@/lib/ipa/arrayCreate";
import { pickFields } from "@/lib/db/pickFields";
import { sortPictureWordsByOverlap } from "@/lib/ipa/overlap";
import type { WordEnglishFields } from "@/lib/english/wordEnglishFields.server";
import { updateWord } from "@/lib/words/wordRepo";
//
type WordWithEnglish = Word & WordEnglishFields;
async function get2CharWords(): Promise<WordWithEnglish[]> {
  const rows = (await prisma.$queryRawUnsafe(
    `
SELECT w.*, ew.base_form, ew.phonetic_us, ew.phonetic_us_normalized, ew.json_hint
FROM Word w
INNER JOIN english_word ew ON ew.id = w.englishId
WHERE (w.first_letter_en_hint IS NULL OR w.first_letter_en_hint = '') AND CHAR_LENGTH(ew.phonetic_us_normalized) = 2;
    `
  )) as WordWithEnglish[];
  return rows;
}

const GROUP_MATCH_TYPES: ReadonlySet<PictureWordType> = new Set([
  "noun",
  "person",
  "animal",
  "food",
  "place",
  "accessory",
  "tool",
  "sport",
]);

function getBestMatch(matches: Array<PictureWord>, word: WordWithEnglish) {
  if (!matches.length) return null;
  const sorted = sortPictureWordsByOverlap(
    word.phonetic_us_normalized ?? "",
    matches
  );
  return sorted[0] ?? null;
}
async function setKeys() {
  const words = await get2CharWords();
  words.map(async (w) => {
    const pre = await checkIfExists(w);
    if (pre) {
      updateWord({
        where: { id: w.id },
        data: { first_letter_en_hint: pre.first_letter_en_hint },
      });
      return;
    } else {
      const keys = combination(w.phonetic_us_normalized!);
      const matches = await extractByRegion(keys);
      const bestMatch = getBestMatch(
        matches.filter((m) => GROUP_MATCH_TYPES.has(m.type)),
        w
      );
      if (bestMatch) {
        console.log(`[selectKey2.ts:65]`, keys, bestMatch);
        const hint = bestMatch.fa + "_" + bestMatch.en;
        await updateWord({
          where: { id: w.id },
          data: { first_letter_en_hint: hint },
        });
      }
    }
  });
}
async function checkIfExists(word: WordWithEnglish) {
  const matching = await prisma.word.findFirst({
    where: {
      englishId: word.englishId,
      first_letter_en_hint: { not: "" },
      NOT: { first_letter_en_hint: null },
    },
  });

  return matching ?? null;
}

async function getMatchesFor2CharWord(ipa: string) {
  const keys = combination(ipa);
  const matches = await extractByRegion(keys);
  return matches.filter((m) => GROUP_MATCH_TYPES.has(m.type));
}
export async function findMatchesForAll2CharWords() {
  // await setKeys();
  const words = await get2CharWords();

  const wordsWithKeys = await Promise.all(
    words.map(async (w) => {
      if (!w.phonetic_us_normalized) return { ...w, keys: [], bestMatch: null };

      const matches = await getMatchesFor2CharWord(w.phonetic_us_normalized);
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
