"use server";

import { runFaToEnAgainForNewCardsFromEnToFaCardsDueAfterDays } from "@/lib/anki";
import type { Result } from "@/lib/anki";
import { err, ok } from "@/lib/anki";

export type ScanSummary = NonNullable<
  Awaited<ReturnType<typeof runFaToEnAgainForNewCardsFromEnToFaCardsDueAfterDays>>
>;

export async function actionRunScan(): Promise<Result<ScanSummary>> {
  const faToEn = await runFaToEnAgainForNewCardsFromEnToFaCardsDueAfterDays(15);
  if (!faToEn) return err("Failed to run EnToFa -> FaToEn workflow (AnkiConnect error).");

  return ok(faToEn);
}
