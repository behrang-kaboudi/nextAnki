import "server-only";

import type { PictureWordUsage, Word } from "@prisma/client";

import { charsMissingFromBestIpa, filterByUsage } from "./shared";
import type { WordPictures, IpaCandidate } from "./types";
import { for1CharAdj, findCandidatesByPartWithS } from "./forChars";

export async function setFor3(word: Word): Promise<WordPictures> {
  const phoneticNormalized = (word.phonetic_us_normalized ?? "").trim();
  // first find for the whole 3 chars, then for 2 chars and for 1 char  adj
  let matches = await findCandidatesByPartWithS(phoneticNormalized, word);
  if (matches.length === 0) {
    matches = await findCandidatesByPartWithS(
      phoneticNormalized.slice(0, 2),
      word,
    );
  }
  const symbols: WordPictures = {
    person: pickBestPictureWord(matches, "person"),
  };
  const missedChars = charsMissingFromBestIpa(
    phoneticNormalized,
    symbols.person,
  );
  if (missedChars.length > 0) {
    const adjMatches = await for1CharAdj(missedChars[0]);
    const adjCandidate = pickBestPictureWord(adjMatches, "adj");
    symbols.adj = adjCandidate;

    if (!adjCandidate) {
      console.log(
        `[setFor3] missing chars 000000000000000000000`,
        phoneticNormalized,
        charsMissingFromBestIpa(phoneticNormalized, symbols.person),
      );
    }
  }

  return symbols;
}

function pickBestPictureWord(
  matches: IpaCandidate[],
  usage: PictureWordUsage,
): IpaCandidate | undefined {
  const filtered = filterByUsage(matches, usage);
  const sorted = [...filtered].sort(
    (a, b) => Array.from(a.target_ipa).length - Array.from(b.target_ipa).length,
  );
  const best = sorted[0];
  if (!best) return undefined;
  return best;
}

// Note: no PictureWord-returning variant; callers should use `setFor3` (symbols).
