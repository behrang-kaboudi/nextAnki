import "server-only";

import type { Word } from "@prisma/client";

import type { WordPictures } from "./types";
import { FA_KEYWORDS_VOWELS_NORMALIZED } from "@/lib/ipa/ipaSets";

import { pickBestFaEn } from "./pickBestFaEn";
import { placeholderJobPictureWord } from "./placeholders";
import { findCandidatesByPartWithS } from "./forChars";

export async function setFor6(word: Word): Promise<WordPictures> {
  const phoneticNormalized = (word.phonetic_us_normalized ?? "").trim();
  const symbols: WordPictures = {};

  // fallback: split into 3-char + 3-char segments (same spirit as setFor5)
  let i = 0;
  let part1 = `${phoneticNormalized[i]}${phoneticNormalized[++i]}${phoneticNormalized[++i]}`;
  if (phoneticNormalized.length > 6) {
    part1 += `${phoneticNormalized[++i]}`;
  }
  if (
    FA_KEYWORDS_VOWELS_NORMALIZED.has(phoneticNormalized[i - 1]) &&
    FA_KEYWORDS_VOWELS_NORMALIZED.has(phoneticNormalized[i])
  ) {
    part1 += `${phoneticNormalized[++i] ?? ""}`;
  }
  if (
    !FA_KEYWORDS_VOWELS_NORMALIZED.has(phoneticNormalized[i]) &&
    FA_KEYWORDS_VOWELS_NORMALIZED.has(phoneticNormalized[i + 1])
  ) {
    part1 += `${phoneticNormalized[++i] ?? ""}`;
  }
  if (
    !FA_KEYWORDS_VOWELS_NORMALIZED.has(phoneticNormalized[i]) &&
    !FA_KEYWORDS_VOWELS_NORMALIZED.has(phoneticNormalized[i - 1]) &&
    !FA_KEYWORDS_VOWELS_NORMALIZED.has(phoneticNormalized[i - 2])
  ) {
    part1 = part1.slice(0, part1.length - 1);
    i--;
  }
  let persons = await findCandidatesByPartWithS(part1, word);
  let i2 = i;
  while (persons.length === 0 && part1.length > 1) {
    part1 = part1.slice(0, --i2);
    persons = await findCandidatesByPartWithS(part1, word);
  }
  // console.log(`[setFor6.ts:41]`, i);
  symbols.person = pickBestFaEn(persons, part1);
  // const part1LastChar =
  //   Array.from(part1)
  //     .filter((ch) => ch.trim())
  //     .slice(-1)[0] ?? "";
  // const personFirst5 = Array.from(symbols.person?.target_ipa ?? "")
  //   .filter((ch) => ch.trim())
  //   .slice(0, 5)
  //   .join("");
  let j = 5;
  const part2 = phoneticNormalized.slice(part1.length, part1.length + 1 + j);

  // if (word.phonetic_us_normalized?.includes("eprɪʃɪeɪʃen")) {
  //   console.log(`[setFor6.ts:26]`, i, part1, part2);
  // }
  // if (part1LastChar && personFirst5 && !personFirst5.includes(part1LastChar)) {
  //   part2 = `${part1LastChar}${part2}`;
  // }
  // console.log(`[setFor6.ts:53]`, part2);
  let jobs = await findCandidatesByPartWithS(part2, word);
  while (jobs.length === 0 && j > 0) {
    jobs = await findCandidatesByPartWithS(part2.slice(0, --j), word);
  }
  // if (word.phonetic_us_normalized === "æbstrækt") {
  // console.log(`[setFor6.ts:65]`, part1, part2, jobs.length);
  // console.log(`[setFor6.ts:74]`, persons);
  // }

  symbols.job = pickBestFaEn(jobs, part2) || placeholderJobPictureWord();

  return symbols;
}

// Note: shared `pickBestFaEn` lives in `pickBestFaEn.ts`.
