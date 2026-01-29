import "server-only";

import { IpaCandidate } from "./shared";

function charCounts(value: string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const ch of Array.from((value ?? "").trim())) {
    if (!ch.trim()) continue;
    counts.set(ch, (counts.get(ch) ?? 0) + 1);
  }
  return counts;
}

function firstFiveNoSpace(value: string): string {
  const chars = Array.from(value ?? "").filter((ch) => ch.trim());
  return chars.slice(0, 5).join("");
}

function overlapScore(candidate: string, target: string): number {
  const a = charCounts(firstFiveNoSpace(candidate));
  const b = charCounts(firstFiveNoSpace(target));
  let score = 0;
  for (const [ch, countB] of b) {
    score += Math.min(a.get(ch) ?? 0, countB);
  }
  return score;
}

export function pickBestFaEn(
  matches: IpaCandidate[],
  targetChars: string,
): IpaCandidate | undefined {
  const sorted = [...matches].sort((a, b) => {
    const aIpa = a.target_ipa ?? "";
    const bIpa = b.target_ipa ?? "";
    const aScore = overlapScore(aIpa, targetChars);
    const bScore = overlapScore(bIpa, targetChars);
    if (aScore !== bScore) return bScore - aScore; // higher overlap first
    return String(a.fa ?? "").localeCompare(String(b.fa ?? ""), "fa");
  });
  const best = sorted[0];
  if (!best) return undefined;
  return best;
}
