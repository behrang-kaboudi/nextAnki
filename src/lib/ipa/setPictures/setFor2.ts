import "server-only";

import type { PictureWordUsage } from "@prisma/client";

import { filterByUsage } from "./shared";
import {
  findCandidatesByPart,
  type PictureCandidateLookup,
} from "./forChars";
import type { IpaCandidate, WordPictureInput, WordPictures } from "./types";

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
  word: WordPictureInput,
  lookup?: PictureCandidateLookup,
): Promise<WordPictures> {
  const phoneticNormalized = (word.phonetic_us_normalized ?? "").trim();
  const matches = await findCandidatesByPart(phoneticNormalized, word, lookup);
  const symbols: WordPictures = {
    person: bestOfUsage(matches, "person"),
  };
  return symbols;
}
