import "server-only";

import "server-only";

import { type Word } from "@prisma/client";

import {
  charsMissingFromBestIpa,
  sortCharsConsonantsThenVowels,
} from "./shared";
import type { WordPictures } from "./types";
import {
  for1CharAdj,
  findCandidatesByPartWithS,
  findCandidatesByPart,
  type PictureCandidateLookup,
} from "./forChars";
import { pickBestFaEn } from "./pickBestFaEn";
import { placeholderJobPictureWord } from "./placeholders";

export async function setFor5(
  word: Word,
  lookup?: PictureCandidateLookup,
): Promise<WordPictures> {
  const phoneticNormalized = (word.phonetic_us_normalized ?? "").trim();
  const matches = await findCandidatesByPartWithS(phoneticNormalized, word, lookup);
  const symbols: WordPictures = {};
  if (matches.length > 0) {
    symbols.person = pickBestFaEn(matches, phoneticNormalized);
    const missedChars = charsMissingFromBestIpa(
      phoneticNormalized,
      symbols.person,
    );
    if (missedChars.length > 0) {
      const sortedMissed = sortCharsConsonantsThenVowels(missedChars);
      const adjMatches = await for1CharAdj(sortedMissed[0], lookup);
      const adjCandidate = pickBestFaEn(adjMatches, phoneticNormalized);
      symbols.adj = adjCandidate;
    }
  }

  // keep same style of fallback as setFor4 (2-char segments)
  if (matches.length === 0) {
    let i = 3;
    let persons = await findCandidatesByPartWithS(
      phoneticNormalized[i] + phoneticNormalized[++i] + phoneticNormalized[++i],
      word,
      lookup,
    );
    if (persons.length === 0) {
      i = 2;
      persons = await findCandidatesByPartWithS(
        phoneticNormalized[0] + phoneticNormalized[1],
        word,
        lookup,
      );
    }
    symbols.person = pickBestFaEn(persons, phoneticNormalized);
    const part2 = phoneticNormalized.slice(i);
    let jobs = await findCandidatesByPart(part2, word, lookup);
    if (jobs.length === 0) {
      jobs = await findCandidatesByPartWithS(
        part2[0] + part2[1],
        word,
        lookup,
      );
    }
    const job = pickBestFaEn(jobs, phoneticNormalized);
    symbols.job = job || placeholderJobPictureWord();

  }

  return symbols;
}

// Note: shared `pickBestFaEn` lives in `pickBestFaEn.ts`.
