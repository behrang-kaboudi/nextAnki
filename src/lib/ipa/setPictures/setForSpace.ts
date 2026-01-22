import "server-only";

import { PictureWordUsage } from "@prisma/client";

import type { SetFor2Result } from "./types";
import { for3Char } from "./forChars";
import { pickBestFaEn } from "./pickBestFaEn";
import { placeholderJobPictureWord } from "./placeholders";

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
  symbols.job = pickBestFaEn(jobs, phoneticNormalized) || placeholderJobPictureWord();

  return symbols;
}
