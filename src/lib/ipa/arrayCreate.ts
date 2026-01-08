import type { PictureWord } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  FA_KEYWORDS_CONSONANTS_NORMALIZED,
  FA_KEYWORDS_VOWELS_NORMALIZED,
} from "@/lib/ipa/ipaSets";
function addS(preCollection: string[], toChange = "") {
  if (!toChange) toChange = preCollection[0];
  if (toChange.startsWith("s")) preCollection.push("e" + toChange);
}
function addReplaceMents(preCollection: string[], toChange = "") {
  if (!toChange) toChange = preCollection[0];
  preCollection.push(toChange.replace(/j/g, "ɪ"));
  preCollection.push(toChange.replace(/ɪ/g, "j"));
  preCollection.push(toChange.replace(/ɪ/g, "e"));
  preCollection.push(toChange.replace(/e/g, "ɪ"));
  preCollection.push(toChange.replace(/ʤ/g, "ʒ"));
  preCollection.push(toChange.replace(/ʒ/g, "ʤ"));
  preCollection.push(toChange.replace(/o/g, "ʊ"));
  preCollection.push(toChange.replace(/ʊ/g, "o"));
  preCollection.push(toChange.replace(/æ/g, "ʌ"));
  preCollection.push(toChange.replace(/ʌ/g, "æ"));
}
// function addReplaceMentsSecond(preCollection: string[], toChange = "") {
//   if (!toChange) toChange = preCollection[0];

//   // preCollection.push(toChange.replace(/ɪ/g, "e"));
//   // preCollection.push(toChange.replace(/e/g, "ɪ"));
//   // preCollection.push(toChange.replace(/ʤ/g, "ʒ"));
//   // preCollection.push(toChange.replace(/ʒ/g, "ʤ"));
//   // preCollection.push(toChange.replace(/o/g, "ʊ"));
//   // preCollection.push(toChange.replace(/ʊ/g, "o"));
// }

function comb2(preCollection: string[]) {
  const parts = [preCollection[0][0], preCollection[0][1]];
  squeezeCharConsonantFrame(parts[0] + parts[1], preCollection);
  preCollection.push(`_${preCollection[0]}`);
  expandConsonantPairsWithVowels(preCollection[0], preCollection);
}
function combOnly3Char(preCollection: string[]) {
  const parts = [preCollection[0][0], preCollection[0][1], preCollection[0][2]];
  preCollection.push(parts[0] + parts[1] + "_" + parts[2]);
  addReplaceMents(preCollection);
  expandConsonantPairsWithVowels(preCollection[0], preCollection);
  squeezeCharConsonantFrame(preCollection[0], preCollection);
  addS(preCollection);
  preCollection.push(parts[0] + "_" + parts[1] + parts[2]);
}
function comb3(preCollection: string[]) {
  preCollection.push(`_${preCollection[0]}`);
  const parts = [preCollection[0][0], preCollection[0][1], preCollection[0][2]];
  combOnly3Char(preCollection);
  preCollection.push(parts[0] + parts[1]);
  addReplaceMents(preCollection, parts[0] + parts[1]);
  squeezeCharConsonantFrame(parts[0] + parts[1], preCollection);
  preCollection.push(parts[0] + "_" + parts[1] + "_" + parts[2]);
  preCollection.push("_" + parts[0] + parts[1]);
  preCollection.push("_" + parts[0] + "_" + parts[1] + "_" + parts[2]);
  // preCollection.push(parts[0] + "_" + parts[2]);
  // preCollection.push(parts[0] + parts[1] + "_");
  // preCollection.push("_" + parts[1] + parts[2]);
}
function comb4(preCollection: string[]) {
  function addWordAllS(word: string) {
    preCollection.push(word);
    addS(preCollection, word);
    addReplaceMents(preCollection, word);
  }
  preCollection.push(`_${preCollection[0]}`);
  const parts = [
    preCollection[0][0],
    preCollection[0][1],
    preCollection[0][2],
    preCollection[0][3],
  ];
  addS(preCollection);
  addWordAllS(parts[0] + parts[1] + parts[2] + "_" + parts[3]);
  addWordAllS(parts[0] + parts[1] + "_" + parts[2] + parts[3]);
  addWordAllS(parts[0] + "_" + parts[1] + parts[2] + parts[3]);
  expandConsonantPairsWithVowels(preCollection[0], preCollection);
  squeezeCharConsonantFrame(preCollection[0], preCollection);
  addWordAllS(parts[0] + parts[1] + "_" + "_" + parts[2] + parts[3]);
  addWordAllS(parts[0] + parts[1] + "_" + parts[3]);
  addWordAllS(parts[0] + "_" + parts[2] + parts[3]);
  addWordAllS("_" + parts[1] + parts[2] + parts[3]);
  addWordAllS(parts[0] + parts[1] + parts[2]);
  addWordAllS(parts[1] + parts[2] + parts[3]);
  addWordAllS(parts[0] + parts[2] + parts[3]);
  // preCollection.push(parts[0] + parts[1]);
  // preCollection.push(parts[0] + "_" + parts[1] + parts[2]);
  // addReplaceMents(preCollection, parts[0] + parts[1]);
  // squeezeCharConsonantFrame(parts[0] + parts[1], preCollection);
  // preCollection.push(parts[0] + "_" + parts[1] + "_" + parts[2]);
  // preCollection.push("_" + parts[0] + parts[1]);
  // preCollection.push("_" + parts[0] + "_" + parts[1] + "_" + parts[2]);
  // preCollection.push(parts[0] + "_" + parts[2]);
  // preCollection.push(parts[0] + parts[1] + "_");
  // preCollection.push("_" + parts[1] + parts[2]);
}

function expandConsonantPairsWithVowels(
  input: string,
  preCollection: string[]
) {
  const vowels = Array.from(FA_KEYWORDS_VOWELS_NORMALIZED);
  const existing = new Set(preCollection);
  const queue: string[] = [input];

  while (queue.length) {
    const current = queue.pop()!;
    const chars = Array.from(current);

    for (let i = 0; i < chars.length - 1; i++) {
      const left = chars[i] ?? "";
      const right = chars[i + 1] ?? "";
      if (
        !FA_KEYWORDS_CONSONANTS_NORMALIZED.has(left) ||
        !FA_KEYWORDS_CONSONANTS_NORMALIZED.has(right)
      ) {
        continue;
      }

      for (const vowel of vowels) {
        const nextChars = [...chars];
        nextChars.splice(i + 1, 0, vowel);
        const next = nextChars.join("");
        if (existing.has(next)) continue;
        existing.add(next);
        preCollection.push(next);
        queue.push(next);
      }
    }
  }
}

function squeezeCharConsonantFrame(input: string, preCollection: string[]) {
  const chars = Array.from(input);
  if (chars.length < 3) return;

  const first = chars[0] ?? "";
  const third = chars[2] ?? "";
  if (
    !FA_KEYWORDS_CONSONANTS_NORMALIZED.has(first) ||
    !FA_KEYWORDS_CONSONANTS_NORMALIZED.has(third)
  ) {
    return;
  }

  const squeezed = first + third;
  if (!preCollection.includes(squeezed)) preCollection.push(squeezed);
}

export function combination(value: string): string[] {
  const collection: string[] = [];
  collection.push(value);
  if (value.length == 2) comb2(collection);
  if (value.length == 3) comb3(collection);
  if (value.length == 4) comb4(collection);
  return Array.from(new Set(collection));
}
export async function extractByRegion(
  patterns: string[]
): Promise<PictureWord[]> {
  const rows: PictureWord[] = [];
  if (!patterns.length) return [];
  const baseQuery = "SELECT * FROM PictureWord WHERE ipa_fa_normalized LIKE ";

  for (const pattern of patterns) {
    const query = baseQuery + "'" + pattern + "%'";
    const result = await prisma.$queryRawUnsafe<PictureWord[]>(query);
    rows.push(...result);
  }
  return rows.flat();
}
