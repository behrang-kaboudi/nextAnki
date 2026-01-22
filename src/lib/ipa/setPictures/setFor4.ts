import "server-only";

import { PictureWord, PictureWordUsage } from "@prisma/client";

import {
  addReplaceMentsForEach,
  filterByUsage,
  findPictureWordsByIpaPrefix,
  startsWithSAndNextIsConsonant,
  charsMissingFromBestIpa,
  sortCharsConsonantsThenVowels,
} from "./shared";
import type { SetFor2Result } from "./types";
import { for2Char, for1CharAdj } from "./forChars";
import { pickBestFaEn } from "./pickBestFaEn";
import { placeholderJobPictureWord } from "./placeholders";

async function findByPattern(pattern: string): Promise<PictureWord[]> {
  const preferredUsage: PictureWordUsage | null = PictureWordUsage.person;
  const matches = await findPictureWordsByIpaPrefix(pattern);
  return filterByUsage(matches, preferredUsage);
}

async function findByPatternCandidates(
  phoneticNormalized: string
): Promise<PictureWord[]> {
  const a = phoneticNormalized[0] ?? "";
  const b = phoneticNormalized[1] ?? "";
  const c = phoneticNormalized[2] ?? "";
  const d = phoneticNormalized[3] ?? "";

  const patterns = [
    `${a}${b}${c}${d}`,
    `${a}${b}${c}_${d}`,
    `${a}${b}_${c}${d}`,
    `${a}_${b}${c}${d}`,

    `${a}${b}_${c}_${d}`,
    `${a}_${b}${c}_${d}`,
    `${a}_${b}_${c}${d}`,
    `${a}_${b}_${c}_${d}`,

    `${a}${b}${c}__${d}`,
    `${a}${b}__${c}${d}`,
    // `${a}__${b}${c}${d}`,
    `${a}${b}${c}___${d}`,
    `_${phoneticNormalized}`,
  ];

  for (const base of [...patterns]) addReplaceMentsForEach(patterns, base);

  // keep a few looser fallbacks similar to setFor3
  patterns.push(`${a}${b}${c}`);
  patterns.push(`${a}${b}${d}`);
  patterns.push(`${a}${b}ـ${d}`);
  patterns.push(`${a}${c}${d}`);
  patterns.push(`${a}ـ${c}${d}`);

  for (const pattern of patterns) {
    const matches = await findByPattern(pattern);
    if (matches.length > 0) return matches;
  }

  return [];
}

export async function setFor4(
  phoneticNormalized: string
): Promise<SetFor2Result> {
  phoneticNormalized = phoneticNormalized.replace(" ", "");
  let matches = await findByPatternCandidates(phoneticNormalized);
  if (
    matches.length === 0 &&
    startsWithSAndNextIsConsonant(phoneticNormalized)
  ) {
    matches = await findByPatternCandidates(`e${phoneticNormalized}`);
  }
  const symbols: SetFor2Result = {
    person: pickBestFaEn(matches, phoneticNormalized),
  };
  if (matches.length > 0) {
    const missedChars = charsMissingFromBestIpa(
      phoneticNormalized,
      symbols.person
    );
    if (missedChars.length > 0) {
      const sortedMissed = sortCharsConsonantsThenVowels(missedChars);

      const adjMatches = await for1CharAdj(sortedMissed[0]);
      // if (phoneticNormalized === "veɪt") {
      //   console.log("debug kætʰ", missedChars, sortedMissed, adjMatches);
      // }
      const adjCandidate = pickBestFaEn(adjMatches, phoneticNormalized);
      symbols.adj = adjCandidate;
      if (!adjCandidate) {
        console.log(`[setFor4] missing chars`, phoneticNormalized);
      }
    }
  }
  if (matches.length === 0) {
    const persons = await for2Char(
      phoneticNormalized[0] + phoneticNormalized[1],
      PictureWordUsage.person
    );
    symbols.person = pickBestFaEn(persons, phoneticNormalized);
    const jobs = await for2Char(
      phoneticNormalized[2] + phoneticNormalized[3],
      PictureWordUsage.Job
    );
    symbols.job =
      pickBestFaEn(jobs, phoneticNormalized) || placeholderJobPictureWord();
    if (symbols.job.en === "job")
      console.log(`[setFor4.ts:123]`, "Nooooooooooooooooooooooooooo");
  }

  return symbols;
}

// Note: no PictureWord-returning variant; callers should use `setFor4` (symbols).
