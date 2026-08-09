import "server-only";

import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { addPersianWordWithClient } from "@/lib/tables/persianWord";
import { deleteWord, updateWord } from "@/lib/words/wordRepo";

type SourceWord = {
  id: number;
  englishId: number;
  meaningId: number | null;
  otherMeaningIds: Prisma.JsonValue | null;
  concept_explained_fa: string | null;
  sentenceIds: Prisma.JsonValue | null;
  conceptMergeReviewed: boolean;
  english: { base_form: string };
};

export type MergeOutputRow =
  | {
      id: number;
      word: string;
      meaning_fa: string;
      other_meanings_fa: string[];
      concept_explained_fa: string;
      sentenceIds: number[];
      delete: false;
      mergedRecordIds: number[];
      mergedIntoId: null;
    }
  | { id: number; delete: true; mergedIntoId: number };

const sourceSelect = {
  id: true,
  englishId: true,
  meaningId: true,
  otherMeaningIds: true,
  concept_explained_fa: true,
  sentenceIds: true,
  conceptMergeReviewed: true,
  english: { select: { base_form: true } },
} satisfies Prisma.WordSelect;

function positiveIds(value: Prisma.JsonValue | null): number[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter(
    (item): item is number =>
      typeof item === "number" && Number.isSafeInteger(item) && item > 0,
  ))];
}

function groupByEnglish(words: SourceWord[]) {
  const groups = new Map<number, SourceWord[]>();
  for (const word of words) {
    const group = groups.get(word.englishId) ?? [];
    group.push(word);
    groups.set(word.englishId, group);
  }
  return [...groups.values()];
}

function sentenceIdsFor(word: SourceWord) {
  return positiveIds(word.sentenceIds);
}

export async function prepareWordConceptMerge(limit: number) {
  return prisma.$transaction(async (tx) => {
    const words = await tx.word.findMany({
      orderBy: [{ englishId: "asc" }, { id: "asc" }],
      select: sourceSelect,
    });
    const allGroups = groupByEnglish(words);
    let reviewedSingleRecords = 0;

    for (const group of allGroups) {
      if (group.length !== 1 || group[0].conceptMergeReviewed) continue;
      const word = group[0];
      await updateWord(
        {
          where: { id: word.id },
          data: { conceptMergeReviewed: true },
          select: { id: true },
        },
        tx,
      );
      word.conceptMergeReviewed = true;
      reviewedSingleRecords += 1;
    }

    const eligible = allGroups.filter(
      (group) =>
        group.length >= 2 &&
        group.some((word) => !word.conceptMergeReviewed),
    );
    const selected = limit > 0 ? eligible.slice(0, limit) : eligible;
    const meaningIds = [...new Set(selected.flatMap((group) =>
      group.flatMap((word) => [
        ...(word.meaningId ? [word.meaningId] : []),
        ...positiveIds(word.otherMeaningIds),
      ]),
    ))];
    const meanings = meaningIds.length
      ? await tx.persianWord.findMany({
          where: { id: { in: meaningIds } },
          select: { id: true, canonical_text: true },
        })
      : [];
    const meaningById = new Map(meanings.map((meaning) => [meaning.id, meaning.canonical_text]));

    return {
      reviewedSingleRecords,
      totalEligibleGroups: eligible.length,
      sourceGroups: selected.map((group) => group.map((word) => word.id)),
      items: selected.map((group) =>
        group.map((word) => ({
          id: word.id,
          word: word.english.base_form,
          meaning_fa: word.meaningId ? meaningById.get(word.meaningId) ?? "" : "",
          other_meanings_fa: positiveIds(word.otherMeaningIds)
            .filter((id) => id !== word.meaningId)
            .flatMap((id) => {
              const meaning = meaningById.get(id);
              return meaning ? [meaning] : [];
            }),
          concept_explained_fa: word.concept_explained_fa ?? "",
          sentenceIds: positiveIds(word.sentenceIds),
        })),
      ),
    };
  }, { maxWait: 10_000, timeout: 120_000 });
}

function isPositiveId(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function uniquePositiveIds(value: unknown): value is number[] {
  return Array.isArray(value) && value.every(isPositiveId) && new Set(value).size === value.length;
}

export function parseMergeOutput(value: unknown): MergeOutputRow[] {
  if (!Array.isArray(value) || value.length === 0) throw new Error("Response must be a non-empty JSON array.");
  const rows: MergeOutputRow[] = [];
  const seen = new Set<number>();
  for (const raw of value) {
    if (!raw || typeof raw !== "object") throw new Error("Every response item must be an object.");
    const item = raw as Record<string, unknown>;
    if (!isPositiveId(item.id) || seen.has(item.id)) throw new Error("Every id must be a unique positive integer.");
    seen.add(item.id);
    if (item.delete === true) {
      if (!isPositiveId(item.mergedIntoId) || Object.keys(item).some((key) => !["id", "delete", "mergedIntoId"].includes(key))) {
        throw new Error(`Deleted record ${item.id} has an invalid shape.`);
      }
      rows.push({ id: item.id, delete: true, mergedIntoId: item.mergedIntoId });
      continue;
    }
    const retainedKeys = [
      "id", "word", "meaning_fa", "other_meanings_fa",
      "concept_explained_fa", "sentenceIds", "delete",
      "mergedRecordIds", "mergedIntoId",
    ];
    const primaryMeaning = typeof item.meaning_fa === "string" ? item.meaning_fa.trim() : "";
    const otherMeanings = Array.isArray(item.other_meanings_fa)
      ? item.other_meanings_fa.map((meaning) => typeof meaning === "string" ? meaning.trim() : meaning)
      : [];
    if (
      item.delete !== false || typeof item.word !== "string" ||
      typeof item.meaning_fa !== "string" ||
      !Array.isArray(item.other_meanings_fa) ||
      item.other_meanings_fa.some((meaning) => typeof meaning !== "string" || !meaning.trim()) ||
      new Set(otherMeanings).size !== otherMeanings.length ||
      otherMeanings.includes(primaryMeaning) ||
      (!primaryMeaning && otherMeanings.length > 0) ||
      typeof item.concept_explained_fa !== "string" ||
      !uniquePositiveIds(item.sentenceIds) || !uniquePositiveIds(item.mergedRecordIds) ||
      item.mergedIntoId !== null || Object.keys(item).some((key) => !retainedKeys.includes(key))
    ) throw new Error(`Retained record ${item.id} has an invalid shape.`);
    rows.push({
      id: item.id,
      word: item.word,
      meaning_fa: primaryMeaning,
      other_meanings_fa: otherMeanings as string[],
      concept_explained_fa: item.concept_explained_fa.trim(),
      sentenceIds: item.sentenceIds,
      delete: false,
      mergedRecordIds: item.mergedRecordIds,
      mergedIntoId: null,
    });
  }
  return rows;
}

function sameIds(left: readonly number[], right: readonly number[]) {
  return left.length === right.length && left.every((id) => right.includes(id));
}

export async function applyWordConceptMerge(sourceGroups: number[][], output: MergeOutputRow[]) {
  return prisma.$transaction(async (tx) => {
    const sourceIds = sourceGroups.flat();
    if (!sourceGroups.length || sourceGroups.some((group) => group.length < 2) ||
        !uniquePositiveIds(sourceIds) || sourceIds.length !== new Set(sourceIds).size) {
      throw new Error("The source groups are invalid.");
    }
    if (!sameIds(sourceIds, output.map((row) => row.id))) {
      throw new Error("The output must contain every input id exactly once and no other ids.");
    }
    const groupIndexById = new Map(sourceGroups.flatMap((group, index) => group.map((id) => [id, index] as const)));
    let priorGroupIndex = -1;
    const deleteSeenByGroup = new Set<number>();
    for (const row of output) {
      const groupIndex = groupIndexById.get(row.id)!;
      if (groupIndex < priorGroupIndex) throw new Error("Output group order must match the input group order.");
      if (row.delete) deleteSeenByGroup.add(groupIndex);
      else if (deleteSeenByGroup.has(groupIndex)) throw new Error("Retained records must appear before deleted records inside each group.");
      priorGroupIndex = groupIndex;
    }
    const words = await tx.word.findMany({ where: { id: { in: sourceIds } }, select: sourceSelect });
    if (words.length !== sourceIds.length) throw new Error("One or more source records no longer exist.");
    const byId = new Map(words.map((word) => [word.id, word]));

    for (const groupIds of sourceGroups) {
      const group = groupIds.map((id) => byId.get(id)!);
      const englishId = group[0].englishId;
      if (group.some((word) => word.englishId !== englishId)) throw new Error("A source group contains different English words.");
      if (!group.some((word) => !word.conceptMergeReviewed)) {
        throw new Error(`The group for englishId ${englishId} is no longer eligible for concept merging.`);
      }
      const currentIds = (await tx.word.findMany({ where: { englishId }, select: { id: true } })).map((word) => word.id);
      if (!sameIds(groupIds, currentIds)) throw new Error(`The records for englishId ${englishId} changed. Create the data again.`);
    }

    const retained = output.filter((row): row is Extract<MergeOutputRow, { delete: false }> => !row.delete);
    const removed = output.filter((row): row is Extract<MergeOutputRow, { delete: true }> => row.delete);
    if (!retained.length) throw new Error("At least one record must remain in each source group.");

    for (const row of retained) {
      const source = byId.get(row.id)!;
      if (row.word !== source.english.base_form) throw new Error(`Word text for record ${row.id} does not match the database.`);
      const deletedIntoRow = removed.filter((item) => item.mergedIntoId === row.id).map((item) => item.id);
      if (!sameIds(row.mergedRecordIds, deletedIntoRow)) throw new Error(`Merge references for record ${row.id} are inconsistent.`);
      const clusterIds = [row.id, ...row.mergedRecordIds];
      if (Math.min(...clusterIds) !== row.id) throw new Error(`Record ${row.id} is not the oldest record in its merge cluster.`);
      if (clusterIds.some((id) => byId.get(id)?.englishId !== source.englishId)) throw new Error(`Record ${row.id} merges records for another word.`);
      const requiredSentences = [...new Set(clusterIds.flatMap((id) => sentenceIdsFor(byId.get(id)!)))];
      if (!sameIds(row.sentenceIds, requiredSentences)) throw new Error(`Sentence ids for record ${row.id} do not exactly preserve its merge cluster.`);
    }
    for (const row of removed) {
      if (!retained.some((keeper) => keeper.id === row.mergedIntoId)) throw new Error(`Deleted record ${row.id} has no valid retained target.`);
    }
    for (const groupIds of sourceGroups) {
      if (!retained.some((row) => groupIds.includes(row.id))) throw new Error("Every source group must retain at least one record.");
    }

    for (const row of retained) {
      const primary = row.meaning_fa
        ? await addPersianWordWithClient(row.meaning_fa, {}, tx)
        : null;
      const otherIds = await Promise.all(row.other_meanings_fa
        .filter((meaning) => meaning !== row.meaning_fa)
        .map(async (meaning) => (await addPersianWordWithClient(meaning, {}, tx)).item.id));
      await updateWord({
        where: { id: row.id },
        data: {
          meaningId: primary?.item.id ?? null,
          otherMeaningIds: [...new Set(otherIds.filter((id) => id !== primary?.item.id))],
          concept_explained_fa: row.concept_explained_fa || null,
          sentenceIds: row.sentenceIds,
          conceptMergeReviewed: true,
        },
        select: { id: true },
      }, tx);
    }
    for (const row of removed) await deleteWord({ where: { id: row.id } }, tx);
    return { updated: retained.length, deleted: removed.length };
  }, { maxWait: 10_000, timeout: 120_000 });
}
