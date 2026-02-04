import "server-only";

import type { PictureWordUsage, Word } from "@prisma/client";

import { addReplaceMentsForEach, filterByUsage, IpaCandidate } from "./shared";
import { findPictureWordsByIpaPrefix } from "./forChars";

import type { SetFor2Result } from "./types";

async function findByPatternCandidates(
  phoneticNormalized: string,
): Promise<IpaCandidate[]> {
  const preferredUsage: PictureWordUsage | null = "person";
  const a = phoneticNormalized[0] ?? "";
  const b = phoneticNormalized[1] ?? "";

  const patterns = [
    `${phoneticNormalized}`,
    // `_${phoneticNormalized}`,
    `${a}_${b}`,
    // `${a}__${b}`,
    // `${a}${b}_`,
    `_${a}${b}`,
  ];

  for (const base of [...patterns]) addReplaceMentsForEach(patterns, base);

  for (const pattern of patterns) {
    const matches = await findPictureWordsByIpaPrefix(pattern);
    const filtered1 = matches.filter((m) => m.target_ipa != phoneticNormalized);
    const filtered2 = filtered1.filter((m) => !m.target_lang);
    const filtered3 = filterByUsage(filtered2, preferredUsage);
    if (filtered3.length > 0) return filtered3;
  }

  return [];
}

function bestOfUsage(
  matches: IpaCandidate[],
  usage: PictureWordUsage,
): IpaCandidate | undefined {
  const filtered = filterByUsage(matches, usage);
  const sorted = [...filtered].sort(
    (a, b) => Array.from(a.target_ipa).length - Array.from(b.target_ipa).length,
  );
  const row = sorted[0];
  if (!row) return undefined;
  return row;
}

export async function setFor2(
  word: Pick<Word, "phonetic_us_normalized">,
): Promise<SetFor2Result> {
  const phoneticNormalized = (word.phonetic_us_normalized ?? "").trim();
  const matches = await findByPatternCandidates(phoneticNormalized);

  const symbols: SetFor2Result = {
    person: bestOfUsage(matches, "person"),
  };

  return symbols;
}
