import type { WordDeckName } from "./constants";

export function quoteAnkiSearchValue(value: string) {
  const escaped = value.replaceAll('"', '\\"');
  return `"${escaped}"`;
}

export function buildCardsDueAfterDaysQuery(deck: WordDeckName, dueAfterDays: number) {
  return `deck:${quoteAnkiSearchValue(deck)} is:review prop:due>${dueAfterDays}`;
}

export function buildNotesDueAfterDaysQuery(deck: WordDeckName, dueAfterDays: number) {
  return `deck:${quoteAnkiSearchValue(deck)} is:review prop:due>${dueAfterDays}`;
}

export function buildCardsInDeckByNoteIdsQuery(deck: WordDeckName, noteIds: number[]) {
  const nidQuery = noteIds.map((id) => `nid:${id}`).join(" OR ");
  return `deck:${quoteAnkiSearchValue(deck)} (${nidQuery})`;
}

export function buildNewCardsInDeckByNoteIdsQuery(deck: WordDeckName, noteIds: number[]) {
  const nidQuery = noteIds.map((id) => `nid:${id}`).join(" OR ");
  return `deck:${quoteAnkiSearchValue(deck)} is:new (${nidQuery})`;
}

