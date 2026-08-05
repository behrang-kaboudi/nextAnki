import "server-only";

import type { Word } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { meaningIds } from "@/lib/words/persianMeanings.server";

import {
  addReplaceMentsForEach,
  filterByUsage,
} from "./shared";
import type { IpaCandidate } from "./types";
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
  excludedIpa: string,
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
      return match.target_ipa !== excludedIpa;
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

function overlapScore(candidate: string, target: string): number {
  const candidateCounts = new Map<string, number>();
  for (const char of Array.from(candidate)
    .filter((char) => char.trim())
    .slice(0, 5)) {
    candidateCounts.set(char, (candidateCounts.get(char) ?? 0) + 1);
  }

  let score = 0;
  const targetCounts = new Map<string, number>();
  for (const char of Array.from(target)
    .filter((char) => char.trim())
    .slice(0, 5)) {
    targetCounts.set(char, (targetCounts.get(char) ?? 0) + 1);
  }
  for (const [char, count] of targetCounts) {
    score += Math.min(candidateCounts.get(char) ?? 0, count);
  }
  return score;
}

type PersianCandidate = {
  candidate: IpaCandidate;
  targetIpa: string;
  isPrimaryMeaning: boolean;
};

function pickBestPersianCandidate(candidates: PersianCandidate[]): IpaCandidate | null {
  const best = [...candidates].sort((left, right) => {
    const leftScore = overlapScore(left.candidate.target_ipa, left.targetIpa);
    const rightScore = overlapScore(right.candidate.target_ipa, right.targetIpa);
    if (leftScore !== rightScore) return rightScore - leftScore;

    const leftLength = Array.from(left.candidate.target_ipa).length;
    const rightLength = Array.from(right.candidate.target_ipa).length;
    if (leftLength !== rightLength) return leftLength - rightLength;

    // The primary meaning breaks only otherwise equal choices.
    if (left.isPrimaryMeaning !== right.isPrimaryMeaning)
      return left.isPrimaryMeaning ? -1 : 1;

    return left.candidate.fa.localeCompare(right.candidate.fa, "fa");
  })[0];
  return best?.candidate ?? null;
}

export async function setForPersian(word: Word): Promise<IpaCandidate | null> {
  const primaryMeaningId = word.meaningId;
  const meaningIdsToSearch = [
    ...(primaryMeaningId == null ? [] : [primaryMeaningId]),
    ...meaningIds(word.otherMeaningIds).filter((id) => id !== primaryMeaningId),
  ];
  if (!meaningIdsToSearch.length) return null;

  const meanings = await prisma.persianWord.findMany({
    where: { id: { in: meaningIdsToSearch } },
    select: { id: true, meaning_fa_IPA_normalize: true },
  });
  const meaningsById = new Map(
    meanings.map((meaning) => [meaning.id, meaning]),
  );
  const candidates: PersianCandidate[] = [];
  const seen = new Set<string>();

  // Search every linked meaning. Each meaning returns every candidate for its best
  // matching pattern; selection happens only after the combined candidate set exists.
  for (const meaningId of meaningIdsToSearch) {
    const phoneticNormalized =
      meaningsById.get(meaningId)?.meaning_fa_IPA_normalize?.trim() ?? "";
    if (!phoneticNormalized) continue;

    const matches = await findByPatternCandidates(
      phoneticNormalized,
      phoneticNormalized,
    );
    for (const candidate of matches) {
      const key = `${candidate.source}|${candidate.target_lang}|${candidate.fa}|${candidate.en}|${candidate.target_ipa}|${candidate.usage}`;
      if (seen.has(key)) continue;
      seen.add(key);
      candidates.push({
        candidate,
        targetIpa: phoneticNormalized,
        isPrimaryMeaning: meaningId === primaryMeaningId,
      });
    }
  }

  return pickBestPersianCandidate(candidates);
}
