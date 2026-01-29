import "server-only";

import type { PictureWord, PictureWordUsage } from "@prisma/client";

import { prisma } from "@/lib/prisma";

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
  phoneticNormalized: string,
): Promise<SetFor2Result> {
  const matches = await findByPatternCandidates(phoneticNormalized);

  const symbols: SetFor2Result = {
    person: bestOfUsage(matches, "person"),
  };

  return symbols;
}
