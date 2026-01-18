import "server-only";

import { PictureWord, PictureWordUsage } from "@prisma/client";

import type { FaEn, SetFor2Result } from "./types";
import { for3Char } from "./forChars";

export async function setForSpace(
  phoneticNormalized: string
): Promise<SetFor2Result> {
  const parts = (phoneticNormalized ?? "").split(" ");
  const symbols: SetFor2Result = { person: undefined, job: undefined };
  const part0 = (parts[0] ?? "").trim();
  const part1 = (parts[1] ?? "").trim();

  const persons = await for3Char(part0, PictureWordUsage.person);
  symbols.person = pickBestFaEn(persons, phoneticNormalized);
  const jobs = await for3Char(part1, PictureWordUsage.Job);
  symbols.job = pickBestFaEn(jobs, phoneticNormalized) || {
    fa: "💼",
    en: "job",
  };

  return symbols;
}

function charCounts(value: string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const ch of Array.from((value ?? "").trim())) {
    if (!ch.trim()) continue;
    counts.set(ch, (counts.get(ch) ?? 0) + 1);
  }
  return counts;
}

function overlapScore(candidate: string, target: string): number {
  const a = charCounts(candidate);
  const b = charCounts(target);
  let score = 0;
  for (const [ch, countB] of b) {
    score += Math.min(a.get(ch) ?? 0, countB);
  }
  return score;
}

function pickBestFaEn(
  matches: PictureWord[],
  targetChars: string
): FaEn | undefined {
  const sorted = [...matches].sort((a, b) => {
    const aIpa = a.ipa_fa_normalized ?? "";
    const bIpa = b.ipa_fa_normalized ?? "";
    const aScore = overlapScore(aIpa, targetChars);
    const bScore = overlapScore(bIpa, targetChars);
    if (aScore !== bScore) return bScore - aScore; // higher overlap first
    const aLen = Array.from(aIpa).length;
    const bLen = Array.from(bIpa).length;
    if (aLen !== bLen) return aLen - bLen; // then shorter IPA
    return String(a.fa ?? "").localeCompare(String(b.fa ?? ""), "fa");
  });
  const best = sorted[0];
  if (!best) return undefined;
  return {
    fa: best.fa,
    en: best.en,
    ipa_fa_normalized: best.ipa_fa_normalized,
  };
}

// Note: no PictureWord-returning variant; callers should use `setFor4` (symbols).
