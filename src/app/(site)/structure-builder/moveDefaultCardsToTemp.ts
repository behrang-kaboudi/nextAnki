import {
  ankiOperations,
  AnkiNoteTypes,
  chunkArray,
  quoteAnkiSearchValue,
  WordAnkiConstants,
} from "@/lib/anki";

import type { LogFn, StepResult } from "./types";
import type { AnkiStructureConfig } from "@/lib/anki/structureSettings";
import { findStructureDeck } from "@/lib/anki/structureSettings";

function defaultMetaLexVr9CardsQuery(sourceDeck: string, noteTypeName: string) {
  return [
    `note:${quoteAnkiSearchValue(noteTypeName)}`,
    `deck:${quoteAnkiSearchValue(sourceDeck)}`,
  ].join(" ");
}

async function loadExactDefaultCardIds(
  cardIds: number[],
  sourceDeck: string,
  noteTypeName: string,
  appendLog: LogFn,
) {
  const exactCardIds: number[] = [];

  for (const ids of chunkArray(cardIds, 250)) {
    const infoRes = await ankiOperations.cardsInfo({ cards: ids });
    if (!infoRes.ok || !infoRes.result) {
      appendLog(`✗ cardsInfo failed: ${infoRes.ok ? "null result" : infoRes.error}`);
      return null;
    }

    for (const card of infoRes.result) {
      if (card.modelName === noteTypeName && card.deckName === sourceDeck) {
        exactCardIds.push(card.cardId);
      }
    }
  }

  return exactCardIds;
}

export async function moveDefaultMetaLexVr9CardsToTemp(
  appendLog: LogFn,
  config?: AnkiStructureConfig,
): Promise<StepResult> {
  const sourceDeck =
    (config ? findStructureDeck(config, config.moveCards.sourceDeckId)?.name : null) ??
    WordAnkiConstants.decks.default;
  const targetDeck =
    (config ? findStructureDeck(config, config.moveCards.targetDeckId)?.name : null) ??
    WordAnkiConstants.decks.tempRoot;
  const noteTypeName = config?.noteType.name ?? AnkiNoteTypes.META_LEX_VR9;
  appendLog(`Step 6: Move ${noteTypeName} cards from ${sourceDeck} to ${targetDeck}...`);

  const createDeckRes = await ankiOperations.createDeck({ deck: targetDeck });
  if (!createDeckRes.ok) {
    appendLog(`✗ Could not ensure target deck: ${createDeckRes.error}`);
    return { ok: false };
  }

  const query = defaultMetaLexVr9CardsQuery(sourceDeck, noteTypeName);
  appendLog(`Query: ${query}`);

  const findRes = await ankiOperations.findCards({ query });
  if (!findRes.ok || !findRes.result) {
    appendLog(`✗ findCards failed: ${findRes.ok ? "null result" : findRes.error}`);
    return { ok: false };
  }

  const exactCardIds = await loadExactDefaultCardIds(findRes.result, sourceDeck, noteTypeName, appendLog);
  if (!exactCardIds) return { ok: false };

  const ignoredCount = findRes.result.length - exactCardIds.length;
  if (ignoredCount > 0) {
    appendLog(`Safety check ignored ${ignoredCount} card(s) that were not exactly in ${sourceDeck}.`);
  }

  if (exactCardIds.length === 0) {
    appendLog(`✓ No ${noteTypeName} cards found exactly in ${sourceDeck}.`);
    appendLog("Step 6: Done.");
    return { ok: true };
  }

  appendLog(`Moving ${exactCardIds.length} card(s) to ${targetDeck}...`);
  for (const ids of chunkArray(exactCardIds, 500)) {
    const moveRes = await ankiOperations.changeDeck({ cards: ids, deck: targetDeck });
    if (!moveRes.ok) {
      appendLog(`✗ changeDeck failed: ${moveRes.error}`);
      return { ok: false };
    }
  }

  const remainingInDefault = await loadExactDefaultCardIds(
    exactCardIds,
    sourceDeck,
    noteTypeName,
    appendLog,
  );
  if (!remainingInDefault) return { ok: false };
  if (remainingInDefault.length > 0) {
    appendLog(`✗ ${remainingInDefault.length} card(s) are still in ${sourceDeck}.`);
    return { ok: false };
  }

  appendLog(`✓ Moved and confirmed ${exactCardIds.length} card(s).`);
  appendLog("Step 6: Done.");
  return { ok: true };
}
