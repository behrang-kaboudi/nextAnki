import "server-only";

import type { SetFor2Result } from "./types";
import { FA_KEYWORDS_VOWELS_NORMALIZED } from "@/lib/ipa/ipaSets";
import { for3Char, for4Char } from "./forChars";
import { pickBestFaEn } from "./pickBestFaEn";

export async function setFor6(
  phoneticNormalized: string
): Promise<SetFor2Result> {
  const symbols: SetFor2Result = {};

  // fallback: split into 3-char + 3-char segments (same spirit as setFor5)
  let i = 0;
  let part1 = `${phoneticNormalized[i] ?? ""}${phoneticNormalized[++i] ?? ""}${phoneticNormalized[++i] ?? ""}`;
  if (
    FA_KEYWORDS_VOWELS_NORMALIZED.has(phoneticNormalized[i - 1]) &&
    FA_KEYWORDS_VOWELS_NORMALIZED.has(phoneticNormalized[i])
  ) {
    if (phoneticNormalized === "ʧʌɪldhʊd") {
      console.log("[setFor6.ts:21]", "Jobs:", "Part1:", part1);
    }
    part1 += `${phoneticNormalized[++i] ?? ""}`;
  }

  // if (i === 3) {
  //   part2 = phoneticNormalized[i] + part2;
  // }
  const persons =
    part1.length >= 4
      ? await for4Char(part1, "person")
      : await for3Char(part1, "person");
  symbols.person = pickBestFaEn(persons, phoneticNormalized);
  const part1LastChar =
    Array.from(part1).filter((ch) => ch.trim()).slice(-1)[0] ?? "";
  const personFirst5 = Array.from(symbols.person?.ipa_fa_normalized ?? "")
    .filter((ch) => ch.trim())
    .slice(0, 5)
    .join("");

  let part2 = phoneticNormalized.slice(i + 1);
  if (part1LastChar && personFirst5 && !personFirst5.includes(part1LastChar)) {
    part2 = `${part1LastChar}${part2}`;
  }
  const jobs =
    part2.length >= 4
      ? await for4Char(part2, "Job")
      : await for3Char(part2, "Job");

  symbols.job = pickBestFaEn(jobs, part2) || {
    fa: "💼",
    en: "job",
  };
  if (phoneticNormalized === "ʧʌɪldhʊd") {
    console.log("[setFor6.ts:45]", symbols);
  }
  return symbols;
}

// Note: shared `pickBestFaEn` lives in `pickBestFaEn.ts`.
