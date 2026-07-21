import { ankiRequest } from "../client";
import type { Result } from "./result";
import { err, ok } from "./result";
import { quoteAnkiSearchValue } from "./queries";

export function chunkArray<T>(items: T[], chunkSize: number) {
  if (chunkSize <= 0) return [items];
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += chunkSize) chunks.push(items.slice(i, i + chunkSize));
  return chunks;
}

export async function findCardsByQuery(query: string): Promise<Result<number[]>> {
  const cardIds = await ankiRequest("findCards", { query });
  if (!cardIds) return err(`findCards failed for query: ${query}`);
  return ok(cardIds);
}

export async function findCardIdsInDeck(deckName: string): Promise<Result<number[]>> {
  const query = `deck:${quoteAnkiSearchValue(deckName)}`;
  return findCardsByQuery(query);
}

export type AnkiCardInfo = {
  cardId: number;
  interval?: number;
  note: number;
  deckName: string;
  modelName: string;
  ord: number;
  type: number;
  queue: number;
  due: number;
  factor: number;
  reps: number;
  lapses: number;
  left: number;
  mod: number;
};

export type AnkiRevlogEntry = {
  id: number;
  usn: number;
  ease: number;
  ivl: number;
  lastIvl: number;
  factor: number;
  time: number;
  type: number;
};

export async function getCardsInfoByCardIds(cardIds: number[], chunkSize = 100): Promise<Result<AnkiCardInfo[]>> {
  const out: AnkiCardInfo[] = [];
  for (const chunk of chunkArray(cardIds, chunkSize)) {
    const info = await ankiRequest("cardsInfo", { cards: chunk });
    if (!info) return err("cardsInfo failed while loading card info");
    out.push(...(info as unknown as AnkiCardInfo[]));
  }
  return ok(out);
}

export async function getLastRevlogByCardIds(
  cardIds: number[],
  chunkSize = 100,
): Promise<Result<Map<number, AnkiRevlogEntry | null>>> {
  const out = new Map<number, AnkiRevlogEntry | null>();
  for (const chunk of chunkArray(cardIds, chunkSize)) {
    const res = await ankiRequest("getReviewsOfCards", { cards: chunk });
    if (!res) return err("getReviewsOfCards failed while loading revlog");

    const byCardId = res as Record<string, AnkiRevlogEntry[]>;
    for (const cardId of chunk) {
      const reviews = byCardId[String(cardId)] ?? [];
      const last = reviews.reduce<AnkiRevlogEntry | null>(
        (best, r) => (best === null || r.id > best.id ? r : best),
        null,
      );
      out.set(cardId, last);
    }
  }
  return ok(out);
}

export async function findNotesByQuery(query: string): Promise<Result<number[]>> {
  const noteIds = await ankiRequest("findNotes", { query });
  if (!noteIds) return err(`findNotes failed for query: ${query}`);
  return ok(noteIds);
}

export async function getNoteIdsForCardIds(cardIds: number[]): Promise<Result<number[]>> {
  const noteIds = new Set<number>();
  for (const chunk of chunkArray(cardIds, 200)) {
    const info = await ankiRequest("cardsInfo", { cards: chunk });
    if (!info) return err("cardsInfo failed while mapping cards -> notes");
    for (const card of info) noteIds.add(card.note);
  }
  return ok(Array.from(noteIds));
}

export async function filterNewCardIds(cardIds: number[]): Promise<Result<number[]>> {
  const newCardIds: number[] = [];
  for (const chunk of chunkArray(cardIds, 200)) {
    const info = await ankiRequest("cardsInfo", { cards: chunk });
    if (!info) return err("cardsInfo failed while filtering new cards");
    for (const card of info) {
      const isNew = card.queue === 0 || card.type === 0;
      if (isNew) newCardIds.push(card.cardId);
    }
  }
  return ok(newCardIds);
}

export async function pressAgainOnce(cardIds: number[]): Promise<Result<{ okCardIds: number[]; failedCardIds: number[] }>> {
  const okCardIds: number[] = [];
  const failedCardIds: number[] = [];
  for (const chunk of chunkArray(cardIds, 200)) {
    const res = await ankiRequest("answerCards", {
      answers: chunk.map((cardId) => ({ cardId, ease: 1 as const })),
    });
    if (res === null) failedCardIds.push(...chunk);
    else okCardIds.push(...chunk);
  }
  return ok({ okCardIds, failedCardIds });
}
