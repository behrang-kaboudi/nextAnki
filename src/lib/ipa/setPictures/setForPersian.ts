import "server-only";

import { PictureWord, PictureWordUsage } from "@prisma/client";

import {
  addReplaceMentsForEach,
  charsMissingFromBestIpa,
  filterByUsage,
  findPictureWordsByIpaPrefix,
  sortCharsConsonantsThenVowels,
  startsWithSAndNextIsConsonant,
} from "./shared";
import type { SetFor2Result, FaEn } from "./types";
import { for2Char, for1CharAdj, for3Char } from "./forChars";
import { pickBestFaEn } from "./pickBestFaEn";

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
  const e = phoneticNormalized[4] ?? "";
  const f = phoneticNormalized[5] ?? "";

  const patterns = [
    // 1) strict: keep the 1st char (`a`) fixed in position 0
    `${a}${b}${c}${d}${e}${f}`,

    // 2) single wildcard (still keep `a` fixed)
    `${a}${b}${c}${d}${e}_`,
    `${a}${b}${c}${d}_${f}`,
    `${a}${b}${c}_${e}${f}`,
    `${a}${b}_${d}${e}${f}`,
    `${a}_${c}${d}${e}${f}`,

    // 3) structured 6-char patterns (a fixed) - useful when one or two chars drift
    `${a}${b}${c}${d}_${e}_${f}`,
    `${a}${b}${c}_${d}${e}${f}`,
    `${a}${b}_${c}${d}${e}${f}`,
    `${a}_${b}${c}${d}${e}${f}`,

    `${a}${b}${c}_${d}_${e}${f}`,
    `${a}${b}_${c}_${d}${e}${f}`,
    `${a}_${b}${c}_${d}${e}${f}`,
    `${a}_${b}_${c}${d}${e}${f}`,
    `${a}_${b}_${c}_${d}${e}${f}`,
    `${a}_${b}_${c}_${d}_${e}${f}`,

    // 5) two/three wildcards in the middle (a fixed)
    `${a}${b}${c}${d}__${e}${f}`,
    `${a}${b}${c}__${d}${e}${f}`,
    `${a}${b}__${c}${d}${e}${f}`,
    `${a}${b}${c}${d}___${e}${f}`,

    // 6) shorter exact prefixes (a fixed) – fallback, but still respects 1st-char stability
    `${a}${b}${c}${d}${e}`,
    `${a}${b}${c}${d}${f}`,
    `${a}${b}${c}${e}${f}`,
    `${a}${b}${d}${e}${f}`,
    `${a}${c}${d}${e}${f}`,

    `${a}${b}${c}${d}`,
    `${a}${b}${c}${e}`,
    `${a}${b}${d}${e}`,
    `${a}${b}${c}`,
    `${a}${b}_${c}`,

    // 7) absolute last-resort: allow 1st-char to drift (kept last on purpose)
    `_${phoneticNormalized}`,

    // 4) two wildcards at the end (strong prefix, loose tail) - still a fixed
    `${a}${b}${c}${d}`,
    `${a}${b}${c}`,
    `${a}${b}`,
    `${a}`,
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

export async function setForPersian(
  phoneticNormalized: string
): Promise<FaEn | null> {
  const matches = await findByPatternCandidates(phoneticNormalized);
  const best = pickBestFaEn(matches, phoneticNormalized);
  return best ? best : null;
}

// Note: shared `pickBestFaEn` lives in `pickBestFaEn.ts`.
