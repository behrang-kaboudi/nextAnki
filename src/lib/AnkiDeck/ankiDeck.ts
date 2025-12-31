import { ankiRequest } from "@/lib/AnkiConnect";
import { WordAnkiConstants, type WordDeckName } from "./constants";
import {
  buildCardsDueAfterDaysQuery,
  buildNotesDueAfterDaysQuery,
  buildCardsInDeckByNoteIdsQuery,
  buildNewCardsInDeckByNoteIdsQuery,
} from "./queries";
import {
  chunkArray,
  filterNewCardIds,
  findCardsByQuery,
  findNotesByQuery,
  getNoteIdsForCardIds,
  pressAgainOnce,
} from "./workflowHelpers";

export type StudiedDueCountResult = {
  deck: WordDeckName;
  dueAfterDays: number;
  noteIds: number[];
};

export async function getStudiedNotesDueInDays(
  deck: WordDeckName,
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

export type EmlaAgainWorkflowResult = {
  sourceDeck: WordDeckName;
  targetDeck: WordDeckName;
  dueAfterDays: number;
  sourceNoteIds: number[];
  emlaCardIdsMatched: number[];
  emlaCardIdsNew: number[];
  emlaCardsSample?: Array<{
    cardId: number;
    note: number;
    deckName: string;
    queue: number;
    type: number;
    due: number;
    reps: number;
    lapses: number;
  }>;
  answeredAgainCardIds: number[];
  failedCardIds: number[];
};

export async function runEmlaAgainForNotesDueAfterDaysFromEnToFa(
  dueAfterDays = 30,
): Promise<EmlaAgainWorkflowResult | null> {
  const sourceDeck = WordAnkiConstants.decks.EnToFa;
  const targetDeck = WordAnkiConstants.decks.Emla;

  const sourceQuery = buildNotesDueAfterDaysQuery(sourceDeck, dueAfterDays);
  const source = await findNotesByQuery(sourceQuery);
  if (!source.ok) return null;
  const sourceNoteIds = source.value;
  if (sourceNoteIds.length === 0) {
    return {
      sourceDeck,
      targetDeck,
      dueAfterDays,
      sourceNoteIds,
      emlaCardIdsMatched: [],
      emlaCardIdsNew: [],
      emlaCardsSample: [],
      answeredAgainCardIds: [],
      failedCardIds: [],
    };
  }

  const matchedCardIds: number[] = [];
  const noteIdChunks = chunkArray(sourceNoteIds, 250);
  for (const chunk of noteIdChunks) {
    const query = buildCardsInDeckByNoteIdsQuery(targetDeck, chunk);
    const res = await findCardsByQuery(query);
    if (!res.ok) return null;
    matchedCardIds.push(...res.value);
  }

  if (matchedCardIds.length === 0) {
    return {
      sourceDeck,
      targetDeck,
      dueAfterDays,
      sourceNoteIds,
      emlaCardIdsMatched: [],
      emlaCardIdsNew: [],
      emlaCardsSample: [],
      answeredAgainCardIds: [],
      failedCardIds: [],
    };
  }

  const newRes = await filterNewCardIds(matchedCardIds);
  if (!newRes.ok) return null;
  const newCardIds = newRes.value;

  if (newCardIds.length === 0) {
    return {
      sourceDeck,
      targetDeck,
      dueAfterDays,
      sourceNoteIds,
      emlaCardIdsMatched: matchedCardIds,
      emlaCardIdsNew: [],
      emlaCardsSample: [],
      answeredAgainCardIds: [],
      failedCardIds: [],
    };
  }

  const emlaCardsSample: EmlaAgainWorkflowResult["emlaCardsSample"] = undefined;

  const againRes = await pressAgainOnce(newCardIds);
  if (!againRes.ok) return null;
  const answeredAgain = againRes.value.okCardIds;
  const failed = againRes.value.failedCardIds;

  return {
    sourceDeck,
    targetDeck,
    dueAfterDays,
    sourceNoteIds,
    emlaCardIdsMatched: matchedCardIds,
    emlaCardIdsNew: newCardIds,
    emlaCardsSample,
    answeredAgainCardIds: answeredAgain,
    failedCardIds: failed,
  };
}

export type FaToEnAgainFromEnToFaWorkflowResult = {
  sourceDeck: WordDeckName;
  targetDeck: WordDeckName;
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
