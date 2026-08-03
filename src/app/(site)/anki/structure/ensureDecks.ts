import { ankiOperations } from "@/lib/anki";
import { WordAnkiConstants } from "@/lib/anki";
import type { AnkiStructureConfig } from "@/lib/anki/structureSettings";

import { loadDeckNames } from "./deckNames";
import type { LogFn, StepResult } from "./types";

export const requiredStructureDecks = [
  WordAnkiConstants.decks.tempRoot,
  WordAnkiConstants.decks.root,
  WordAnkiConstants.decks.EnToFa,
  WordAnkiConstants.decks.EnToFaKnowingFilter,
  WordAnkiConstants.decks.EnToFaRev,
  WordAnkiConstants.decks.FaToEn,
  WordAnkiConstants.decks.FaToEnKnowingFilter,
  WordAnkiConstants.decks.FaToEnRev,
  WordAnkiConstants.decks.Emla,
  WordAnkiConstants.decks.Rahnama,
  WordAnkiConstants.decks.Rahnama2,
];

export function requiredDecksFromConfig(config: AnkiStructureConfig) {
  return config.decks.filter((deck) => deck.managed).map((deck) => deck.name);
}

async function createMissingDecks(missingDecks: string[], appendLog: LogFn): Promise<StepResult> {
  for (const deck of missingDecks) {
    appendLog(`Creating deck: ${deck} ...`);
    const res = await ankiOperations.createDeck({ deck });
    if (!res.ok) {
      appendLog(`✗ createDeck failed: ${res.error}`);
      return { ok: false };
    }
    appendLog(`✓ Created (id=${res.result})`);
  }

  return { ok: true };
}

async function confirmDecksExist(deckNames: string[], appendLog: LogFn): Promise<StepResult> {
  const after = await loadDeckNames();
  if (!after.ok) {
    appendLog(`✗ ${after.error}`);
    return { ok: false };
  }

  for (const deck of deckNames) {
    appendLog(`${after.deckSet.has(deck) ? "✓ Confirmed" : "✗ Still missing"}: ${deck}`);
  }

  return { ok: true };
}

export async function ensureRequiredDecks(
  appendLog: LogFn,
  config?: AnkiStructureConfig,
): Promise<StepResult> {
  appendLog("Step 1: Ensure decks (roots + subdecks)...");
  const desiredDecks = config ? requiredDecksFromConfig(config) : requiredStructureDecks;

  const before = await loadDeckNames();
  if (!before.ok) {
    appendLog(`✗ ${before.error}`);
    return { ok: false };
  }

  const missing = desiredDecks.filter((d) => !before.deckSet.has(d));
  for (const deck of desiredDecks) {
    appendLog(`${before.deckSet.has(deck) ? "✓" : "✗"} ${deck}`);
  }

  const createResult = await createMissingDecks(missing, appendLog);
  if (!createResult.ok) return createResult;

  const confirmResult = await confirmDecksExist(desiredDecks, appendLog);
  if (!confirmResult.ok) return confirmResult;

  appendLog("Step 1: Done.");
  return { ok: true };
}
