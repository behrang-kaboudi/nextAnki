import { ankiRequest } from "@/lib/AnkiConnect";
import type { Result } from "./result";
import { err, ok } from "./result";

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

