import "server-only";

import type { SetFor2Result } from "./types";
import { for3Char } from "./forChars";
import { pickBestFaEn } from "./pickBestFaEn";

export async function setFor6(
  phoneticNormalized: string
): Promise<SetFor2Result> {
  const symbols: SetFor2Result = {};

  // fallback: split into 3-char + 3-char segments (same spirit as setFor5)

  const persons = await for3Char(
    `${phoneticNormalized[0] ?? ""}${phoneticNormalized[1] ?? ""}${phoneticNormalized[2] ?? ""}`,
    "person"
  );
  symbols.person = pickBestFaEn(persons, phoneticNormalized);

  const jobs = await for3Char(
    `${phoneticNormalized[3] ?? ""}${phoneticNormalized[4] ?? ""}${phoneticNormalized[5] ?? ""}`,
    "Job"
  );
  symbols.job = pickBestFaEn(jobs, phoneticNormalized) || {
    fa: "💼",
    en: "job",
  };

  return symbols;
}

// Note: shared `pickBestFaEn` lives in `pickBestFaEn.ts`.
