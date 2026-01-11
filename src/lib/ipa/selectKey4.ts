import "server-only";

import { prisma } from "@/lib/prisma";
import type { PictureWord, PictureWordType, Word } from "@prisma/client";
import { extractByRegion, combination } from "@/lib/ipa/arrayCreate";
import { pickFields } from "@/lib/db/pickFields";
import { sortPictureWordsByOverlap } from "@/lib/ipa/overlap";
import { mergeKeysAndPictureWords } from "./mergKeys";
import { normalizeIPA } from "./ipaSets";
//(first_letter_en_hint IS NULL OR first_letter_en_hint = '')  AND
async function get4CharWords(): Promise<Word[]> {
  const rows = (await prisma.$queryRawUnsafe(
    `
SELECT *
FROM Word
WHERE (first_letter_en_hint IS NULL OR first_letter_en_hint = '')
  AND (
    CHAR_LENGTH(phonetic_us_normalized) = 4
    OR (
      CHAR_LENGTH(phonetic_us_normalized) = 5
      AND phonetic_us_normalized LIKE '% %'
    )
  );

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
  "sport",
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

type Direct4CharMatches = { style: "direct"; matches: PictureWord[] };
type Merged4CharMatches = {
  style: "merged";
  parts: { first2: PictureWord[]; last2: PictureWord[] };
  pairs: Array<[PictureWord, PictureWord]>;
};
type MatchesFor4CharWord = Direct4CharMatches | Merged4CharMatches;

function orderedOverlapSize(source: string, candidate: string) {
  const a = source ?? "";
  const b = candidate ?? "";
  const n = Math.min(a.length, b.length);
  let count = 0;
  for (let i = 0; i < n; i += 1) {
    if (a[i] !== b[i]) break;
    count += 1;
  }
  return count;
}

function sortPairsByIpaOverlap(
  pairs: Array<[PictureWord, PictureWord]>,
  ipa: string
) {
  return [...pairs].sort((a, b) => {
    const target = ipa ?? "";
    const aIpa =
      (a[0].ipa_fa_normalized ?? "") + (a[1].ipa_fa_normalized ?? "");
    const bIpa =
      (b[0].ipa_fa_normalized ?? "") + (b[1].ipa_fa_normalized ?? "");

    const firstCharInTargetScore = (pair: [PictureWord, PictureWord]) => {
      const leftFirst = (pair[0].ipa_fa_normalized ?? "")[0] ?? "";
      const rightFirst = (pair[1].ipa_fa_normalized ?? "")[0] ?? "";
      const leftIdx = leftFirst ? target.indexOf(leftFirst) : -1;
      const rightIdx = rightFirst ? target.indexOf(rightFirst) : -1;
      if (leftIdx >= 0 && rightIdx >= 0) return leftIdx < rightIdx ? 2 : 0;
      if (leftIdx >= 0 || rightIdx >= 0) return 1;
      return 0;
    };

    const aFirstScore = firstCharInTargetScore(a);
    const bFirstScore = firstCharInTargetScore(b);
    if (aFirstScore !== bFirstScore) return bFirstScore - aFirstScore;

    const aOverlap = orderedOverlapSize(target, aIpa);
    const bOverlap = orderedOverlapSize(target, bIpa);
    if (aOverlap !== bOverlap) return bOverlap - aOverlap;

    const aFaLen = (a[0].fa ?? "").length + (a[1].fa ?? "").length;
    const bFaLen = (b[0].fa ?? "").length + (b[1].fa ?? "").length;
    if (aFaLen !== bFaLen) return aFaLen - bFaLen;

    return aIpa.localeCompare(bIpa);
  });
}

async function getMatchesFor4CharWord(
  ipa: string
): Promise<MatchesFor4CharWord> {
  const keys = combination(ipa);
  const matches = await extractByRegion(keys);

  if (matches.length > 0) {
    return {
      style: "direct",
      matches: matches.filter((m) => GROUP_MATCH_TYPES.has(m.type)),
    };
  }
  let pairs: Array<[PictureWord, PictureWord]> = [];
  const keys1 = combination(ipa.slice(0, 2));
  keys1.push(...combination(ipa.slice(0, 3)));

  const keys2: string[] = [];

  keys2.push(...combination(ipa.slice(2, 4)));
  keys2.push(...combination(ipa.slice(1, 4)));

  //
  let matches1 = await extractByRegion(keys1);
  if (matches1.length === 0) {
    keys1.push(...combination(ipa.slice(0, 1)));
    matches1 = await extractByRegion(keys1);
  }
  let matches2 = await extractByRegion(keys2);
  if (matches2.length === 0) {
    keys2.push(...combination(ipa.slice(2, 3)));
    matches2 = await extractByRegion(keys2);
    // if (matches2.length === 0) {
    //   keys2.push(...combination(ipa.slice(3, 4)));
    //   matches2 = await extractByRegion(keys2);
    // }
  }
  pairs = mergeKeysAndPictureWords(matches1, matches2, ipa);
  // let matches2: PictureWord[] = [];
  // if (matches1.length > 0) {
  //   keys2 = combination(ipa.slice(2, 4));
  //   matches2 = await extractByRegion(keys2);
  //   if (matches2.length > 0) {
  //     pairs = mergeKeysAndPictureWords(matches1, matches2, ipa);
  //   }
  // }
  // if (pairs.length === 0) {
  //   keys1 = combination(ipa.slice(0, 3));
  //   matches1 = await extractByRegion(keys1);
  //   if (matches1.length > 0) {
  //     keys2 = combination(ipa.slice(3, 4));
  //     matches2 = await extractByRegion(keys2);
  //     if (matches2.length > 0) {
  //       pairs = mergeKeysAndPictureWords(matches1, matches2, ipa);
  //     }
  //   }
  // }
  // if (pairs.length === 0) {
  //   keys1 = combination(ipa.slice(0, 1));
  //   matches1 = await extractByRegion(keys1);
  //   if (matches1.length > 0) {
  //     keys2 = combination(ipa.slice(1, 4));
  //     matches2 = await extractByRegion(keys2);
  //     if (matches2.length > 0) {
  //       pairs = mergeKeysAndPictureWords(matches1, matches2, ipa);
  //     }
  //   }
  // }
  // if (pairs.length === 0) {
  //   keys1 = combination(ipa.slice(0, 1));
  //   matches1 = await extractByRegion(keys1);
  //   if (matches1.length > 0) {
  //     keys2 = combination(ipa.slice(3, 4));
  //     matches2 = await extractByRegion(keys2);
  //     if (matches2.length > 0) {
  //       pairs = mergeKeysAndPictureWords(matches1, matches2, ipa);
  //     }
  //   }
  // }
  // // Make `pairs` distinct (by left/right ids)
  // if (pairs.length > 1) {
  //   const seen = new Set<string>();
  //   pairs = pairs.filter(([left, right]) => {
  //     const key = `${left.id}:${right.id}`;
  //     if (seen.has(key)) return false;
  //     seen.add(key);
  //     return true;
  //   });
  // }
  const sortedPairs = sortPairsByIpaOverlap(pairs, ipa).slice(0, 2);
  return {
    style: "merged",
    parts: { first2: matches1, last2: matches2 },
    pairs: sortedPairs,
  };
}

export async function findMatchesForAll4CharWords() {
  const words = await get4CharWords();
  // await setKeys();
  const wordsWithKeys = await Promise.all(
    words.map(async (w) => {
      if (!w.phonetic_us_normalized) return { ...w, keys: [], bestMatch: null };
      const normalizeIPA = w.phonetic_us_normalized.replaceAll(" ", "");
      const matchResult = await getMatchesFor4CharWord(normalizeIPA);
      const combinationKeys = combination(normalizeIPA);
      if (matchResult.style === "direct") {
        const keys = matchResult.matches.map((r) =>
          pickFields(r, ["fa", "ipa_fa_normalized"])
        );
        const bestMatch = getBestMatch(matchResult.matches, w);

        return {
          ...w,
          matchStyle: "direct" as const,
          combinationKeys,
          keys,
          mergedPairs: [],
          bestMatch: bestMatch
            ? pickFields(bestMatch, ["id", "fa", "ipa_fa_normalized", "type"])
            : null,
        };
      }

      const mergedPairs = matchResult.pairs.map(([left, right]) => ({
        left: pickFields(left, ["id", "fa", "ipa_fa_normalized", "type"]),
        right: pickFields(right, ["id", "fa", "ipa_fa_normalized", "type"]),
      }));

      return {
        ...w,
        matchStyle: "merged" as const,
        combinationKeys,
        keys: [],
        mergedPairs,
        bestMatch: null,
        parts: {
          first2: matchResult.parts.first2.map((r) =>
            pickFields(r, ["fa", "ipa_fa_normalized"])
          ),
          last2: matchResult.parts.last2.map((r) =>
            pickFields(r, ["fa", "ipa_fa_normalized"])
          ),
        },
      };
    })
  );

  return { words: wordsWithKeys };
}
