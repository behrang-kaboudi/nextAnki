import "server-only";

import type { PictureWord, PictureWordUsage } from "@prisma/client";

import {
  addReplaceMentsForEach,
  charsMissingFromBestIpa,
  filterByUsage,
  findPictureWordsByIpaPrefix,
  startsWithSAndNextIsConsonant,
} from "./shared";
import type { SetFor2Result } from "./types";
import { for1CharAdj } from "./forChars";

async function findByPattern(pattern: string): Promise<PictureWord[]> {
  const preferredUsage: PictureWordUsage | null = "person";
  const matches = await findPictureWordsByIpaPrefix(pattern);
  return filterByUsage(matches, preferredUsage);
}

async function findByPatternCandidates(
  phoneticNormalized: string,
): Promise<PictureWord[]> {
  const patterns = [
    `${phoneticNormalized[0]}${phoneticNormalized[1]}${phoneticNormalized[2]}`,
    `${phoneticNormalized[0]}${phoneticNormalized[1]}_${phoneticNormalized[2]}`,
    `${phoneticNormalized[0]}${phoneticNormalized[1]}__${phoneticNormalized[2]}`,
    `${phoneticNormalized[0]}_${phoneticNormalized[1]}${phoneticNormalized[2]}`,

    `${phoneticNormalized[0]}${phoneticNormalized[1]}___${phoneticNormalized[2]}`,
    `${phoneticNormalized[0]}_${phoneticNormalized[1]}_${phoneticNormalized[2]}`,
    `_${phoneticNormalized}`,
  ];
  for (const base of [...patterns]) addReplaceMentsForEach(patterns, base);
  patterns.push(`${phoneticNormalized[0]}${phoneticNormalized[1]}`);
  patterns.push(`${phoneticNormalized[0]}${phoneticNormalized[2]}`);
  patterns.push(`${phoneticNormalized[0]}_${phoneticNormalized[2]}`);
  patterns.push(`_${phoneticNormalized[0]}${phoneticNormalized[1]}`);
  for (const pattern of patterns) {
    const matches = await findByPattern(pattern);
    if (matches.length > 0) return matches;
  }

  return [];
}

export async function setFor3(
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
        `[setFor3] missing chars`,
        phoneticNormalized,
        charsMissingFromBestIpa(phoneticNormalized, symbols.person),
      );
    }
  }

  return symbols;
}

function pickBestPictureWord(
  matches: PictureWord[],
  usage: PictureWordUsage,
): PictureWord | undefined {
  const filtered = filterByUsage(matches, usage);
  const sorted = [...filtered].sort(
    (a, b) =>
      Array.from(a.ipa_fa_normalized).length -
      Array.from(b.ipa_fa_normalized).length,
  );
  const best = sorted[0];
  if (!best) return undefined;
  return best;
}

// Note: no PictureWord-returning variant; callers should use `setFor3` (symbols).
