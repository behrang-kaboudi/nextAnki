import "server-only";

import { PictureWord, PictureWordUsage, Word } from "@prisma/client";

import { prisma } from "@/lib/prisma";

import {
  addReplaceMentsForEach,
  charsMissingFromBestIpa,
  filterByUsage,
} from "./shared";
import type { IpaCandidate } from "./types";
import { pickBestFaEn } from "./pickBestFaEn";
import {
  findPictureWordsByIpaPrefix,
  get5CharPatterns,
  get4CharPatterns,
  get3CharPatterns,
  get2CharPatterns,
} from "./forChars";

async function findByPattern(pattern: string): Promise<IpaCandidate[]> {
  const matches = await findPictureWordsByIpaPrefix(pattern);
  if (pattern === "kʌ") {
    console.log(`[setForPersian.ts:93]`, { pattern, matches });
  }
  return filterByUsage(matches);
}

async function findByPatternCandidates(
  phoneticNormalized: string,
  word: Word & { meaning_fa_IPA_normalized?: string },
): Promise<IpaCandidate[]> {
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
    // `${a}_${c}${d}${e}${f}`,

    // 3) structured 6-char patterns (a fixed) - useful when one or two chars drift
    `${a}${b}${c}${d}_${e}_${f}`,
    `${a}${b}${c}_${d}${e}${f}`,
    `${a}${b}_${c}${d}${e}${f}`,
    // `${a}_${b}${c}${d}${e}${f}`,

    `${a}${b}${c}_${d}_${e}${f}`,
    `${a}${b}_${c}_${d}${e}${f}`,
    // `${a}_${b}${c}_${d}${e}${f}`,
    // `${a}_${b}_${c}${d}${e}${f}`,
    // `${a}_${b}_${c}_${d}${e}${f}`,
    // `${a}_${b}_${c}_${d}_${e}${f}`,
  ];

  for (const base of [...patterns]) addReplaceMentsForEach(patterns, base);
  patterns.push(...get5CharPatterns(`${a}${b}${c}${d}${e}`));
  patterns.push(...get5CharPatterns(`${a}${b}${c}${d}${f}`));
  patterns.push(...get5CharPatterns(`${a}${b}${c}${e}${f}`));
  patterns.push(...get5CharPatterns(`${a}${b}${d}${e}${f}`));
  patterns.push(...get5CharPatterns(`${a}${c}${d}${e}${f}`));
  patterns.push(...get5CharPatterns(`${a}${b}${c}${d}${e}`));

  // looser fallbacks (pattern-style), similar spirit to setFor4
  patterns.push(...get4CharPatterns(`${a}${b}${c}${d}`));
  patterns.push(...get4CharPatterns(`${a}${b}${c}${e}`));
  patterns.push(...get4CharPatterns(`${a}${b}${d}${e}`));

  patterns.push(...get3CharPatterns(`${a}${b}${c}`));
  patterns.push(...get3CharPatterns(`${a}${b}${d}`));

  patterns.push(...get2CharPatterns(`${a}${b}`));

  // patterns.push(`${a}${b}${c}${e}`);
  // patterns.push(`${a}${b}${d}${e}`);
  // if (phoneticNormalized === "kʌfɪ") {
  //   for (const p of patterns) {
  //     console.log(`[setForPersian.ts:94]`, p);
  //   }
  // }
  for (const pattern of patterns) {
    let matches = await findByPattern(pattern);
    matches = matches.filter((match) => {
      return match.target_ipa !== (word.meaning_fa_IPA_normalized ?? "");
    });
    matches = matches.filter((match) => {
      if (match.target_lang && match.target_lang === "en") return false;
      return true;
    });
    matches = matches.filter((match) => {
      if (match.target_ipa.length < 8) return true;
      return false;
    });
    if (matches.length > 0) {
      return matches;
    }
  }

  return [];
}

export async function setForPersian(word: Word & { meaning_fa_IPA_normalized?: string }): Promise<IpaCandidate | null> {
  const phoneticNormalized = word.meaning_fa_IPA_normalized ?? "";
  const matches = await findByPatternCandidates(phoneticNormalized, word);

  // if (word.base_form === "goad") {
  //   console.log(`[setForPersian.ts:104]`, matches, phoneticNormalized);
  // }
  const best = pickBestFaEn(matches, phoneticNormalized);
  return best ? best : null;
}

// Note: shared `pickBestFaEn` lives in `pickBestFaEn.ts`.
