import "server-only";

import type { PictureWordUsage, Word } from "@prisma/client";

import { filterByUsage } from "./shared";
import { findCandidatesByPart } from "./forChars";
import type { IpaCandidate, WordPictures } from "./types";

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

export async function setFor2(word: Word): Promise<WordPictures> {
  const phoneticNormalized = (word.phonetic_us_normalized ?? "").trim();
  const matches = await findCandidatesByPart(phoneticNormalized, word);
  const symbols: WordPictures = {
    person: bestOfUsage(matches, "person"),
  };
  return symbols;
}
