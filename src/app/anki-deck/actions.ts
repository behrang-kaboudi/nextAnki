"use server";

import {
  runEmlaAgainForNotesDueAfterDaysFromEnToFa,
  runFaToEnAgainForNewCardsFromEnToFaCardsDueAfterDays,
} from "@/lib/AnkiDeck/ankiDeck";
import type { Result } from "@/lib/AnkiDeck/result";
import { err, ok } from "@/lib/AnkiDeck/result";

export type ScanSummary = {
  emla: NonNullable<Awaited<ReturnType<typeof runEmlaAgainForNotesDueAfterDaysFromEnToFa>>>;
  faToEn: NonNullable<
    Awaited<ReturnType<typeof runFaToEnAgainForNewCardsFromEnToFaCardsDueAfterDays>>
  >;
};

export async function actionRunScan(): Promise<Result<ScanSummary>> {
  const emla = await runEmlaAgainForNotesDueAfterDaysFromEnToFa(30);
  if (!emla) return err("Failed to run EnToFa -> Emla workflow (AnkiConnect error).");

  const faToEn = await runFaToEnAgainForNewCardsFromEnToFaCardsDueAfterDays(15);
  if (!faToEn) return err("Failed to run EnToFa -> FaToEn workflow (AnkiConnect error).");

  return ok({ emla, faToEn });
}
