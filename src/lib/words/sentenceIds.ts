import type { Prisma } from "@prisma/client";

export function wordSentenceIds(value: Prisma.JsonValue | null | undefined): number[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter(
    (item): item is number =>
      typeof item === "number" && Number.isSafeInteger(item) && item > 0,
  ))];
}

export function primarySentenceId(value: Prisma.JsonValue | null | undefined): number | null {
  return wordSentenceIds(value)[0] ?? null;
}

export function appendWordSentenceId(
  value: Prisma.JsonValue | null | undefined,
  sentenceId: number,
): number[] {
  return [...new Set([...wordSentenceIds(value), sentenceId])];
}

export function removeWordSentenceIds(
  value: Prisma.JsonValue | null | undefined,
  removedIds: readonly number[],
): number[] {
  const removed = new Set(removedIds);
  return wordSentenceIds(value).filter((id) => !removed.has(id));
}
