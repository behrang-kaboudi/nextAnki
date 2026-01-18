import "server-only";

import type { PictureWord, PictureWordUsage } from "@prisma/client";

import {
  addReplaceMentsForEach,
  filterByUsage,
  findPictureWordsByIpaPrefix,
} from "./shared";

import type { FaEn, SetFor2Result } from "./types";

async function findByPatternCandidates(
  phoneticNormalized: string
): Promise<PictureWord[]> {
  const preferredUsage: PictureWordUsage | null = "person";
  const a = phoneticNormalized[0] ?? "";
  const b = phoneticNormalized[1] ?? "";

  const patterns = [
    `${phoneticNormalized}`,
    `_${phoneticNormalized}`,
    `${a}_${b}`,
    `${a}__${b}`,
    `${a}${b}_`,
    `_${a}${b}`,
  ];

  for (const base of [...patterns]) addReplaceMentsForEach(patterns, base);

  for (const pattern of patterns) {
    const matches = await findPictureWordsByIpaPrefix(pattern);
    const filtered = filterByUsage(matches, preferredUsage);
    if (filtered.length > 0) return filtered;
  }

  return [];
}

function bestOfUsage(
  matches: PictureWord[],
  usage: PictureWordUsage
): FaEn | undefined {
  const filtered = filterByUsage(matches, usage);
  const sorted = [...filtered].sort(
    (a, b) =>
      Array.from(a.ipa_fa_normalized).length -
      Array.from(b.ipa_fa_normalized).length
  );
  const row = sorted[0];
  if (!row) return undefined;
  return { fa: row.fa, en: row.en, ipa_fa_normalized: row.ipa_fa_normalized };
}

export async function setFor2(
  phoneticNormalized: string
): Promise<SetFor2Result> {
  const matches = await findByPatternCandidates(phoneticNormalized);

  const symbols: SetFor2Result = {
    person: bestOfUsage(matches, "person"),
  };

  return symbols;
}
