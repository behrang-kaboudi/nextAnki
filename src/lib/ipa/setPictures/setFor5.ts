import "server-only";

import { PictureWordUsage } from "@prisma/client";

import {
  addReplaceMentsForEach,
  charsMissingFromBestIpa,
  filterByUsage,
  sortCharsConsonantsThenVowels,
  startsWithSAndNextIsConsonant,
  IpaCandidate,
} from "./shared";
import type { SetFor2Result } from "./types";
import {
  for2Char,
  for1CharAdj,
  for3Char,
  findPictureWordsByIpaPrefix,
} from "./forChars";
import { pickBestFaEn } from "./pickBestFaEn";
import { placeholderJobPictureWord } from "./placeholders";

async function findByPattern(pattern: string): Promise<IpaCandidate[]> {
  const preferredUsage: PictureWordUsage | null = PictureWordUsage.person;
  const matches = await findPictureWordsByIpaPrefix(pattern);
  return filterByUsage(matches, preferredUsage);
}

async function findByPatternCandidates(
  phoneticNormalized: string,
): Promise<IpaCandidate[]> {
  const a = phoneticNormalized[0] ?? "";
  const b = phoneticNormalized[1] ?? "";
  const c = phoneticNormalized[2] ?? "";
  const d = phoneticNormalized[3] ?? "";
  const e = phoneticNormalized[4] ?? "";

  const patterns = [
    `${a}${b}${c}${d}${e}`,
    `${a}${b}${c}${d}_${e}`,
    `${a}${b}${c}_${d}${e}`,
    `${a}${b}_${c}${d}${e}`,
    `${a}_${b}${c}${d}${e}`,

    `${a}${b}${c}_${d}_${e}`,
    `${a}${b}_${c}_${d}${e}`,
    `${a}_${b}${c}_${d}${e}`,
    `${a}_${b}_${c}${d}${e}`,
    `${a}_${b}_${c}_${d}${e}`,
    `${a}_${b}_${c}_${d}_${e}`,

    `${a}${b}${c}${d}__${e}`,
    `${a}${b}${c}__${d}${e}`,
    `${a}${b}__${c}${d}${e}`,
    `${a}${b}${c}${d}___${e}`,
    `${a}${b}${c}_${e}`,
    `${a}${b}_${d}${e}`,
    `${a}_${c}${d}${e}`,
    `${a}${b}${c}${d}`,
    `_${phoneticNormalized}`,
  ];

  for (const base of [...patterns]) addReplaceMentsForEach(patterns, base);

  // looser fallbacks (pattern-style), similar spirit to setFor4
  // patterns.push(`${a}${b}${c}${d}`);
  // patterns.push(`${a}${b}${c}${e}`);
  // patterns.push(`${a}${b}${d}${e}`);

  for (const pattern of patterns) {
    const matches = await findByPattern(pattern);
    if (matches.length > 0) return matches;
  }

  return [];
}

export async function setFor5(
  phoneticNormalized: string,
): Promise<SetFor2Result> {
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
      symbols.person,
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
  if (matches.length > 0) {
    const missedChars = charsMissingFromBestIpa(
      phoneticNormalized,
      symbols.person,
    );
    if (missedChars.length > 0) {
      const adjMatches = await for1CharAdj(missedChars[0]);
      const adjCandidate = pickBestFaEn(adjMatches, phoneticNormalized);
      symbols.adj = adjCandidate;
      if (!adjCandidate) {
        console.log(`[setFor5] missing chars`, phoneticNormalized);
      }
    }
  }
  // keep same style of fallback as setFor4 (2-char segments)
  if (matches.length === 0) {
    const persons = await for2Char(
      `${phoneticNormalized[0] ?? ""}${phoneticNormalized[1] ?? ""}`,
      "person",
    );
    symbols.person = pickBestFaEn(persons, phoneticNormalized);

    const jobs = await for3Char(
      `${phoneticNormalized[2] ?? ""}${phoneticNormalized[3] ?? ""}${phoneticNormalized[4] ?? ""}`,
      "Job",
    );
    symbols.job =
      pickBestFaEn(jobs, phoneticNormalized) || placeholderJobPictureWord();
  }

  return symbols;
}

// Note: shared `pickBestFaEn` lives in `pickBestFaEn.ts`.
