import "server-only";

import type { Word } from "@prisma/client";

import type { WordPictures } from "./types";
// import { for3Char } from "./forChars";
import { pickBestFaEn } from "./pickBestFaEn";
import { placeholderJobPictureWord } from "./placeholders";
import {
  findCandidatesByPartWithS,
  type PictureCandidateLookup,
} from "./forChars";
export async function setForSpace(
  word: Word,
  lookup?: PictureCandidateLookup,
): Promise<WordPictures> {
  const parts = (word.phonetic_us_normalized ?? "").split(" ");
  const symbols: WordPictures = {};
  const part0 = (parts[0] ?? "").trim();
  const part1 = (parts[1] ?? "").trim();
  let i = 5;
  let persons = await findCandidatesByPartWithS(part0.slice(0, 5), word, lookup);
  while (persons.length === 0 && i > 0) {
    persons = await findCandidatesByPartWithS(part0.slice(0, --i), word, lookup);
  }
  symbols.person = pickBestFaEn(persons, part0);
  i = 5;
  let jobs = await findCandidatesByPartWithS(part1.slice(0, 5), word, lookup);
  while (jobs.length === 0 && i > 0) {
    jobs = await findCandidatesByPartWithS(part1.slice(0, --i), word, lookup);
  }
  symbols.job = pickBestFaEn(jobs, part1) || placeholderJobPictureWord();

  return symbols;
  // return {};
}
