import "server-only";

import type { PictureWordUsage, Word } from "@prisma/client";

import {
  addReplaceMentsForEach,
  charsMissingFromBestIpa,
  filterByUsage,
  IpaCandidate,
  startsWithSAndNextIsConsonant,
} from "./shared";
import { SetFor2Result } from "./types";
import { for1CharAdj, findPictureWordsByIpaPrefix } from "./forChars";

async function findByPattern(pattern: string): Promise<IpaCandidate[]> {
  const preferredUsage: PictureWordUsage | null = "person";
  const matches = await findPictureWordsByIpaPrefix(pattern);
  return filterByUsage(matches, preferredUsage);
}

async function findByPatternCandidates(
  phoneticNormalized: string,
): Promise<IpaCandidate[]> {
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
    const filtered1 = matches.filter((m) => m.target_ipa != phoneticNormalized);
    const filtered2 = filtered1.filter((m) => {
      if (!m.target_lang) return true;
      if (m.target_ipa.length <= 2) return true;
      return false;
    });
    const filtered3 = filterByUsage(filtered2, null);
    if (filtered3.length > 0) return filtered3;
  }

  return [];
}

export async function setFor3(
  word: Pick<Word, "phonetic_us_normalized">,
): Promise<SetFor2Result> {
  const phoneticNormalized = (word.phonetic_us_normalized ?? "").trim();
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
