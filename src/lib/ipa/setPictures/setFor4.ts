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

export async function setFor4(
  word: Word,
  lookup?: PictureCandidateLookup,
): Promise<WordPictures> {
  const phoneticNormalized = (word.phonetic_us_normalized ?? "")
    .trim()
    .replace(" ", "");
  const matches = await findCandidatesByPartWithS(phoneticNormalized, word, lookup);
  // if (matches.length === 0) {
  //   matches = await findCandidatesByPartWithS(
  //     phoneticNormalized[0] + phoneticNormalized[1] + phoneticNormalized[2],
  //     word,
  //   );
  // }
  // if (matches.length === 0) {
  //   matches = await findCandidatesByPartWithS(
  //     phoneticNormalized[0] + phoneticNormalized[1] + phoneticNormalized[3],
  //     word,
  //   );
  // }
  // if (matches.length === 0) {
  //   matches = await findCandidatesByPartWithS(
  //     phoneticNormalized[0] + phoneticNormalized[2] + phoneticNormalized[3],
  //     word,
  //   );
  // }
  // if (matches.length === 0) {
  //   matches = await findCandidatesByPartWithS(
  //     phoneticNormalized[0] + phoneticNormalized[2] + phoneticNormalized[3],
  //     word,
  //   );
  // }
  // if (matches.length === 0) {
  //   matches = await findCandidatesByPartWithS(
  //     phoneticNormalized[1] + phoneticNormalized[2] + phoneticNormalized[3],
  //     word,
  //   );
  // }
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
      // if (phoneticNormalized === "veɪt") {
      //   console.log("debug kætʰ", missedChars, sortedMissed, adjMatches);
      // }
      const adjCandidate = pickBestFaEn(adjMatches, phoneticNormalized);
      symbols.adj = adjCandidate;
    }
  }
  if (matches.length === 0) {
    const persons = await findCandidatesByPart(
      phoneticNormalized[0] + phoneticNormalized[1],
      word,
      lookup,
    );
    symbols.person = pickBestFaEn(persons, phoneticNormalized);
    const jobs = await findCandidatesByPart(
      phoneticNormalized[2] + phoneticNormalized[3],
      word,
      lookup,
    );

    symbols.job =
      pickBestFaEn(jobs, phoneticNormalized) || placeholderJobPictureWord();
    if (symbols.job.en === "job")
      console.log(
        `[setFor4.ts:123]`,
        "NoooooooooooooooooooooooooooJobJobJobJobJobJobJobJobJobJobJobJobJobJob",
      );
  }

  return symbols;
}

// Note: no PictureWord-returning variant; callers should use `setFor4` (symbols).
