import { ankiRequest } from "../client";
import { WordAnkiConstants } from "./constants";
import {
  buildCardsDueAfterDaysQuery,
  buildNotesDueAfterDaysQuery,
  buildNewCardsInDeckByNoteIdsQuery,
} from "./queries";
import {
  chunkArray,
  findCardsByQuery,
  getNoteIdsForCardIds,
  pressAgainOnce,
} from "./workflowHelpers";

export type StudiedDueCountResult = {
  deck: string;
  dueAfterDays: number;
  noteIds: number[];
};

export async function getStudiedNotesDueInDays(
  deck: string,
  dueAfterDays = 30
): Promise<StudiedDueCountResult | null> {
  const query = buildNotesDueAfterDaysQuery(deck, dueAfterDays);
  const noteIds = await ankiRequest("findNotes", { query });
  if (!noteIds) return null;
  return { deck, dueAfterDays, noteIds };
}

export async function getEnToFaStudiedNotesDueAfterDays(dueAfterDays = 30) {
  const studied = await getStudiedNotesDueInDays(
    WordAnkiConstants.decks.EnToFa,
    dueAfterDays
  );
  return studied;
}

export type FaToEnAgainFromEnToFaWorkflowResult = {
  sourceDeck: string;
  targetDeck: string;
  dueAfterDays: number;
  sourceCardIds: number[];
  sourceNoteIds: number[];
  targetNewCardIdsMatched: number[];
  answeredAgainCardIds: number[];
  failedCardIds: number[];
};

export async function runFaToEnAgainForNewCardsFromEnToFaCardsDueAfterDays(
  dueAfterDays = 15,
): Promise<FaToEnAgainFromEnToFaWorkflowResult | null> {
  const sourceDeck = WordAnkiConstants.decks.EnToFa;
  const targetDeck = WordAnkiConstants.decks.FaToEn;

  const sourceQuery = buildCardsDueAfterDaysQuery(sourceDeck, dueAfterDays);
  const sourceCardsRes = await findCardsByQuery(sourceQuery);
  if (!sourceCardsRes.ok) return null;
  const sourceCardIds = sourceCardsRes.value;

  if (sourceCardIds.length === 0) {
    return {
      sourceDeck,
      targetDeck,
      dueAfterDays,
      sourceCardIds,
      sourceNoteIds: [],
      targetNewCardIdsMatched: [],
      answeredAgainCardIds: [],
      failedCardIds: [],
    };
  }

  const noteIdsRes = await getNoteIdsForCardIds(sourceCardIds);
  if (!noteIdsRes.ok) return null;
  const sourceNoteIds = noteIdsRes.value;

  if (sourceNoteIds.length === 0) {
    return {
      sourceDeck,
      targetDeck,
      dueAfterDays,
      sourceCardIds,
      sourceNoteIds: [],
      targetNewCardIdsMatched: [],
      answeredAgainCardIds: [],
      failedCardIds: [],
    };
  }

  const matchedTargetCardIds: number[] = [];
  const noteIdChunks = chunkArray(sourceNoteIds, 250);
  for (const chunk of noteIdChunks) {
    const targetQuery = buildNewCardsInDeckByNoteIdsQuery(targetDeck, chunk);
    const res = await findCardsByQuery(targetQuery);
    if (!res.ok) return null;
    matchedTargetCardIds.push(...res.value);
  }

  if (matchedTargetCardIds.length === 0) {
    return {
      sourceDeck,
      targetDeck,
      dueAfterDays,
      sourceCardIds,
      sourceNoteIds,
      targetNewCardIdsMatched: [],
      answeredAgainCardIds: [],
      failedCardIds: [],
    };
  }

  const againRes = await pressAgainOnce(matchedTargetCardIds);
  if (!againRes.ok) return null;
  const answeredAgain = againRes.value.okCardIds;
  const failed = againRes.value.failedCardIds;

  return {
    sourceDeck,
    targetDeck,
    dueAfterDays,
    sourceCardIds,
    sourceNoteIds,
    targetNewCardIdsMatched: matchedTargetCardIds,
    answeredAgainCardIds: answeredAgain,
    failedCardIds: failed,
  };
}
