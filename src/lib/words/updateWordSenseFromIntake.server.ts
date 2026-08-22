import "server-only";

import { Prisma } from "@prisma/client";

import { normalizePersianFull } from "@/lib/persian/normalize";
import { prisma } from "@/lib/prisma";
import { addPersianWordWithClient } from "@/lib/tables/persianWord";
import { updateWordSense } from "@/lib/words/wordSenseRepo";
import type { WordSenseIntakeUpdateInput } from "@/lib/words/wordSenseIntakeUpdate";

export class WordSenseIntakeUpdateNotFoundError extends Error {}
export class WordSenseIntakeUpdateConflictError extends Error {}

function referencedMeaningId(value: unknown) {
  if (typeof value === "number" && Number.isSafeInteger(value) && value > 0) return value;
  if (typeof value === "string" && /^\d+$/.test(value)) {
    const id = Number(value);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
  }
  return null;
}

export async function updateWordSenseFromIntake(input: WordSenseIntakeUpdateInput) {
  return prisma.$transaction(async (tx) => {
    const current = await tx.wordSense.findUnique({
      where: { id: input.id },
      select: {
        id: true,
        updatedAt: true,
        meaningId: true,
        otherMeaningIds: true,
        english: { select: { base_form: true } },
      },
    });
    if (!current) throw new WordSenseIntakeUpdateNotFoundError(`WordSense ${input.id} was not found.`);
    if (current.updatedAt.toISOString() !== input.expected_updated_at) {
      throw new WordSenseIntakeUpdateConflictError(
        `WordSense ${input.id} changed after the update proposal was prepared. Search again before updating it.`,
      );
    }

    const currentEntries = Array.isArray(current.otherMeaningIds) ? [...current.otherMeaningIds] : [];
    const currentIds = currentEntries.flatMap((value) => {
      const id = referencedMeaningId(value);
      return id === null ? [] : [id];
    });
    const referencedIds = [...new Set([...(current.meaningId === null ? [] : [current.meaningId]), ...currentIds])];
    const referencedMeanings = referencedIds.length
      ? await tx.persianWord.findMany({
          where: { id: { in: referencedIds } },
          select: { id: true, canonical_text: true, normalized_text: true },
        })
      : [];
    const meaningById = new Map(referencedMeanings.map((meaning) => [meaning.id, meaning]));
    const primary = current.meaningId === null ? null : meaningById.get(current.meaningId) ?? null;
    const operations = input.changes.other_meanings_fa;
    const removeSet = new Set(operations.remove.map(normalizePersianFull));
    const missingRemovals = [...removeSet].filter(
      (normalized) => !currentIds.some((id) => meaningById.get(id)?.normalized_text === normalized),
    );
    if (missingRemovals.length) {
      throw new WordSenseIntakeUpdateConflictError(
        "One or more proposed removals are no longer present. Search again before updating this WordSense.",
      );
    }
    const nextEntries = currentEntries.filter((value) => {
      const id = referencedMeaningId(value);
      const meaning = id === null ? null : meaningById.get(id);
      return !meaning || !removeSet.has(meaning.normalized_text);
    });
    const nextNormalized = new Set(
      nextEntries.flatMap((value) => {
        const id = referencedMeaningId(value);
        if (id === null) return [];
        const meaning = meaningById.get(id);
        return meaning ? [meaning.normalized_text] : [];
      }),
    );
    if (primary && operations.add.some((meaning) => normalizePersianFull(meaning) === primary.normalized_text)) {
      throw new Error("other_meanings_fa cannot repeat the primary Persian meaning.");
    }
    for (const meaning of operations.add) {
      const normalized = normalizePersianFull(meaning);
      if (nextNormalized.has(normalized)) continue;
      const added = await addPersianWordWithClient(meaning, {}, tx);
      if (added.item.id !== current.meaningId) nextEntries.push(added.item.id);
      nextNormalized.add(normalized);
    }

    const changed = nextEntries.length !== currentEntries.length ||
      nextEntries.some((value, index) => value !== currentEntries[index]);
    if (!changed) {
      return {
        action: "unchanged" as const,
        item: {
          id: current.id,
          base_form: current.english.base_form,
          updated_at: current.updatedAt.toISOString(),
          other_meanings_fa: currentIds.flatMap((id) => {
            const meaning = meaningById.get(id);
            return meaning ? [meaning.canonical_text] : [];
          }),
        },
      };
    }

    try {
      const updated = await updateWordSense({
        where: { id: current.id, updatedAt: current.updatedAt },
        data: { otherMeaningIds: nextEntries as Prisma.InputJsonValue },
        select: { id: true, updatedAt: true },
      }, tx);
      const nextIds = nextEntries.flatMap((value) => {
        const id = referencedMeaningId(value);
        return id === null ? [] : [id];
      });
      const storedMeanings = nextIds.length
        ? await tx.persianWord.findMany({
            where: { id: { in: nextIds } },
            select: { id: true, canonical_text: true },
          })
        : [];
      const storedById = new Map(storedMeanings.map((meaning) => [meaning.id, meaning.canonical_text]));
      return {
        action: "updated" as const,
        item: {
          id: updated.id,
          base_form: current.english.base_form,
          updated_at: updated.updatedAt.toISOString(),
          other_meanings_fa: nextIds.flatMap((id) => {
            const meaning = storedById.get(id);
            return meaning ? [meaning] : [];
          }),
        },
      };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
        throw new WordSenseIntakeUpdateConflictError(
          `WordSense ${input.id} changed while the update was being applied. Search again before retrying.`,
        );
      }
      throw error;
    }
  });
}
