import "server-only";

import { MeaningReviewStatus, type Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { addPersianWordWithClient } from "@/lib/tables/persianWord";
import {
  conceptMergePersianResolutionKey,
  preferredConceptMergePersianWordIds,
} from "@/lib/words/conceptMergePersianIdentity";
import { selectPromptBatch } from "@/lib/words/promptBatch";
import { deleteWordSense, updateWordSense } from "@/lib/words/wordSenseRepo";
import { resolvePersianWordOccurrences } from "@/lib/words/persianWordResolution.server";
import type {
  PersianWordAmbiguity,
  PersianWordResolutionSelection,
} from "@/lib/words/persianWordResolution";

type SourceWordSense = {
  id: number;
  englishId: number;
  meaningId: number | null;
  otherMeaningIds: Prisma.JsonValue | null;
  pos: string | null;
  concept_explained_fa: string | null;
  sentenceIds: Prisma.JsonValue | null;
  meaningReviewStatus: MeaningReviewStatus;
  conceptMergeReviewed: boolean;
  inflectionMergeReviewed: boolean;
  english: { base_form: string };
};

type ConceptMergeReadClient = Pick<Prisma.TransactionClient, "persianWord" | "sentence">;

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
  pos: true,
  concept_explained_fa: true,
  sentenceIds: true,
  meaningReviewStatus: true,
  conceptMergeReviewed: true,
  inflectionMergeReviewed: true,
  english: { select: { base_form: true } },
} satisfies Prisma.WordSenseSelect;

export class ConceptMergePersianWordResolutionRequiredError extends Error {
  constructor(public readonly ambiguities: PersianWordAmbiguity[]) {
    super("One or more Persian meanings have multiple pronunciation records and require human selection.");
    this.name = "ConceptMergePersianWordResolutionRequiredError";
  }
}

function positiveIds(value: Prisma.JsonValue | null): number[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter(
    (item): item is number =>
      typeof item === "number" && Number.isSafeInteger(item) && item > 0,
  ))];
}

function groupByEnglish(words: SourceWordSense[]) {
  const groups = new Map<number, SourceWordSense[]>();
  for (const word of words) {
    const group = groups.get(word.englishId) ?? [];
    group.push(word);
    groups.set(word.englishId, group);
  }
  return [...groups.values()];
}

export async function getPendingWordSenseConceptMergeStats() {
  const words = await prisma.wordSense.findMany({
    where: { meaningReviewStatus: MeaningReviewStatus.CONFIRMED },
    orderBy: [{ englishId: "asc" }, { id: "asc" }],
    select: sourceSelect,
  });
  const groups = groupByEnglish(words).filter(
    (group) =>
      group.length >= 2 &&
      group.some((word) => !word.conceptMergeReviewed),
  );
  return {
    groupCount: groups.length,
    recordCount: new Set(groups.flatMap((group) => group.map((word) => word.id))).size,
  };
}

export async function getPendingWordSenseConceptMergeCount() {
  return (await getPendingWordSenseConceptMergeStats()).groupCount;
}

function sentenceIdsFor(word: SourceWordSense) {
  return positiveIds(word.sentenceIds);
}

async function conceptMergeItemsForGroups(
  groups: SourceWordSense[][],
  client: ConceptMergeReadClient,
) {
  const meaningIds = [...new Set(groups.flatMap((group) =>
    group.flatMap((word) => [
      ...(word.meaningId ? [word.meaningId] : []),
      ...positiveIds(word.otherMeaningIds),
    ]),
  ))];
  const sentenceIds = [...new Set(groups.flatMap((group) => group.flatMap(sentenceIdsFor)))];
  const sentences = sentenceIds.length
    ? await client.sentence.findMany({
        where: { id: { in: sentenceIds } },
        select: { id: true, sentence_en: true, sentence_en_meaning_fa: true },
      })
    : [];
  const sentenceById = new Map(sentences.map((sentence) => [sentence.id, sentence]));
  const meanings = meaningIds.length
    ? await client.persianWord.findMany({
        where: { id: { in: meaningIds } },
        select: { id: true, canonical_text: true },
      })
    : [];
  const meaningById = new Map(meanings.map((meaning) => [meaning.id, meaning.canonical_text]));

  return groups.map((group) =>
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
      pos: word.pos ?? "",
      sentenceIds: positiveIds(word.sentenceIds),
      sentences: positiveIds(word.sentenceIds).flatMap((id) => {
        const sentence = sentenceById.get(id);
        return sentence ? [{
          id: sentence.id,
          sentence_en: sentence.sentence_en,
          sentence_en_meaning_fa: sentence.sentence_en_meaning_fa,
        }] : [];
      }),
    })),
  );
}

export async function prepareWordSenseConceptMerge(batchSize: number) {
  return prisma.$transaction(async (tx) => {
    const words = await tx.wordSense.findMany({
      where: { meaningReviewStatus: MeaningReviewStatus.CONFIRMED },
      orderBy: [{ englishId: "asc" }, { id: "asc" }],
      select: sourceSelect,
    });
    const allGroups = groupByEnglish(words);
    let reviewedSingleRecords = 0;

    for (const group of allGroups) {
      if (group.length !== 1 || group[0].conceptMergeReviewed) continue;
      const word = group[0];
      await updateWordSense(
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
    const selected = selectPromptBatch(eligible, batchSize);
    return {
      reviewedSingleRecords,
      totalEligibleGroups: eligible.length,
      sourceGroups: selected.map((group) => group.map((word) => word.id)),
      items: await conceptMergeItemsForGroups(selected, tx),
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

export async function loadWordSenseConceptMergeGroups(output: MergeOutputRow[]) {
  const outputIds = output.map((row) => row.id);
  const referencedWords = await prisma.wordSense.findMany({
    where: {
      id: { in: outputIds },
      meaningReviewStatus: MeaningReviewStatus.CONFIRMED,
    },
    select: sourceSelect,
  });
  if (referencedWords.length !== outputIds.length) {
    throw new Error("One or more response ids no longer exist.");
  }
  const referencedById = new Map(referencedWords.map((word) => [word.id, word]));
  const englishIds: number[] = [];
  const seenEnglishIds = new Set<number>();
  for (const id of outputIds) {
    const englishId = referencedById.get(id)!.englishId;
    if (!seenEnglishIds.has(englishId)) {
      seenEnglishIds.add(englishId);
      englishIds.push(englishId);
    }
  }
  const currentWords = await prisma.wordSense.findMany({
    where: {
      englishId: { in: englishIds },
      meaningReviewStatus: MeaningReviewStatus.CONFIRMED,
    },
    orderBy: [{ englishId: "asc" }, { id: "asc" }],
    select: sourceSelect,
  });
  const currentGroupsByEnglishId = new Map(
    groupByEnglish(currentWords).map((group) => [group[0].englishId, group]),
  );
  const groups = englishIds.map((englishId) => {
    const group = currentGroupsByEnglishId.get(englishId) ?? [];
    const responseGroupIds = outputIds.filter((id) => referencedById.get(id)?.englishId === englishId);
    const currentIds = group.map((word) => word.id);
    if (group.length < 2 || !sameIds(responseGroupIds, currentIds)) {
      throw new Error(`Response ids do not contain the complete current group for englishId ${englishId}.`);
    }
    if (!group.some((word) => !word.conceptMergeReviewed)) {
      throw new Error(`The group for englishId ${englishId} was already reviewed.`);
    }
    return group;
  });
  return {
    sourceGroups: groups.map((group) => group.map((word) => word.id)),
    items: await conceptMergeItemsForGroups(groups, prisma),
  };
}

function sameIds(left: readonly number[], right: readonly number[]) {
  return left.length === right.length && left.every((id) => right.includes(id));
}

function sameOrderedIds(left: readonly number[], right: readonly number[]) {
  return left.length === right.length && left.every((id, index) => id === right[index]);
}

export async function applyWordSenseConceptMerge(
  sourceGroups: number[][],
  output: MergeOutputRow[],
  selections: PersianWordResolutionSelection[] = [],
  reviewOnlySourceGroups: number[][] = [],
  reviewOnlyRecordIds: number[] = [],
  deferredRecordIds: number[] = [],
) {
  return prisma.$transaction(async (tx) => {
    const sourceIds = sourceGroups.flat();
    if (!sourceGroups.length || sourceGroups.some((group) => group.length < 2) ||
        !uniquePositiveIds(sourceIds) || sourceIds.length !== new Set(sourceIds).size) {
      throw new Error("The source groups are invalid.");
    }
    if (!sameIds(sourceIds, output.map((row) => row.id))) {
      throw new Error("The output must contain every input id exactly once and no other ids.");
    }
    const sourceGroupKeys = new Set(sourceGroups.map((group) => group.join(":")));
    const reviewOnlyGroupKeys = new Set(reviewOnlySourceGroups.map((group) => group.join(":")));
    const sourceIdSet = new Set(sourceIds);
    if (
      reviewOnlySourceGroups.some((group) => group.length < 2 || !uniquePositiveIds(group)) ||
      reviewOnlyGroupKeys.size !== reviewOnlySourceGroups.length ||
      [...reviewOnlyGroupKeys].some((key) => !sourceGroupKeys.has(key))
    ) {
      throw new Error("The review-only source groups are invalid.");
    }
    if (
      !uniquePositiveIds(reviewOnlyRecordIds) ||
      reviewOnlyRecordIds.some((id) => !sourceIdSet.has(id))
    ) {
      throw new Error("The review-only record ids are invalid.");
    }
    const reviewOnlyIds = new Set([...reviewOnlySourceGroups.flat(), ...reviewOnlyRecordIds]);
    if (
      !uniquePositiveIds(deferredRecordIds) ||
      deferredRecordIds.some((id) => !sourceIdSet.has(id) || reviewOnlyIds.has(id))
    ) {
      throw new Error("The deferred record ids are invalid.");
    }
    const deferredIds = new Set(deferredRecordIds);
    const activeSourceGroups = sourceGroups.filter((group) =>
      group.some((id) => !reviewOnlyIds.has(id) && !deferredIds.has(id)),
    );
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
    const words = await tx.wordSense.findMany({ where: { id: { in: sourceIds } }, select: sourceSelect });
    if (words.length !== sourceIds.length) throw new Error("One or more source records no longer exist.");
    if (words.some((word) => word.meaningReviewStatus !== MeaningReviewStatus.CONFIRMED)) {
      throw new Error("One or more source records are no longer confirmed. Create the data again.");
    }
    const byId = new Map(words.map((word) => [word.id, word]));

    for (const groupIds of sourceGroups) {
      const group = groupIds.map((id) => byId.get(id)!);
      const englishId = group[0].englishId;
      if (group.some((word) => word.englishId !== englishId)) throw new Error("A source group contains different English words.");
      if (!group.some((word) => !word.conceptMergeReviewed)) {
        throw new Error(`The group for englishId ${englishId} is no longer eligible for concept merging.`);
      }
      const currentIds = (await tx.wordSense.findMany({
        where: { englishId, meaningReviewStatus: MeaningReviewStatus.CONFIRMED },
        select: { id: true },
      })).map((word) => word.id);
      if (!sameIds(groupIds, currentIds)) throw new Error(`The records for englishId ${englishId} changed. Create the data again.`);
    }

    const activeOutput = output.filter((row) => !reviewOnlyIds.has(row.id) && !deferredIds.has(row.id));
    const retained = activeOutput.filter((row): row is Extract<MergeOutputRow, { delete: false }> => !row.delete);
    const removed = activeOutput.filter((row): row is Extract<MergeOutputRow, { delete: true }> => row.delete);
    if (activeSourceGroups.length && !retained.length) {
      throw new Error("At least one record must remain in each source group.");
    }

    for (const row of retained) {
      const source = byId.get(row.id)!;
      if (row.word !== source.english.base_form) throw new Error(`WordSense text for record ${row.id} does not match the database.`);
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
    for (const groupIds of activeSourceGroups) {
      if (!retained.some((row) => groupIds.includes(row.id))) throw new Error("Every source group must retain at least one record.");
    }

    const referencedMeaningIds = [...new Set(words.flatMap((word) => [
      ...(word.meaningId ? [word.meaningId] : []),
      ...positiveIds(word.otherMeaningIds),
    ]))];
    const referencedMeanings = referencedMeaningIds.length
      ? await tx.persianWord.findMany({
          where: { id: { in: referencedMeaningIds } },
          select: { id: true, canonical_text: true },
        })
      : [];
    const canonicalTextById = new Map(
      referencedMeanings.map((meaning) => [meaning.id, meaning.canonical_text]),
    );
    const stableIds = new Map<string, number>();
    const occurrences: Array<{
      key: string;
      text: string;
      field: "meaning_fa" | "other_meanings_fa";
      context: {
        base_form: string;
        pos: string | null;
        concept_explained_fa: string;
      };
      preferredIds: number[];
    }> = [];
    for (const row of retained) {
      const source = byId.get(row.id)!;
      const clusterIds = [row.id, ...row.mergedRecordIds];
      const clusterMeaningIds = [...new Set(clusterIds.flatMap((id) => {
        const word = byId.get(id)!;
        return [
          ...(word.meaningId ? [word.meaningId] : []),
          ...positiveIds(word.otherMeaningIds),
        ];
      }))];
      const sourceMeaningIds = [
        ...(source.meaningId ? [source.meaningId] : []),
        ...positiveIds(source.otherMeaningIds),
      ];
      const context = {
        base_form: source.english.base_form,
        pos: source.pos,
        concept_explained_fa: row.concept_explained_fa,
      };
      const addOccurrence = (
        text: string,
        field: "meaning_fa" | "other_meanings_fa",
        index: number,
      ) => {
        const key = conceptMergePersianResolutionKey(row.id, field, index);
        const preferredIds = preferredConceptMergePersianWordIds({
          text,
          field,
          sourcePrimaryId: source.meaningId,
          sourceMeaningIds,
          clusterMeaningIds,
          canonicalTextById,
        });
        if (preferredIds.length === 1) stableIds.set(key, preferredIds[0]);
        else occurrences.push({ key, text, field, context, preferredIds });
      };
      if (row.meaning_fa) addOccurrence(row.meaning_fa, "meaning_fa", 0);
      row.other_meanings_fa.forEach((meaning, index) => {
        if (meaning !== row.meaning_fa) addOccurrence(meaning, "other_meanings_fa", index);
      });
    }
    const resolution = await resolvePersianWordOccurrences(occurrences, selections, tx);
    if (resolution.ambiguities.length) {
      throw new ConceptMergePersianWordResolutionRequiredError(resolution.ambiguities);
    }

    for (const row of retained) {
      const source = byId.get(row.id)!;
      const primaryKey = conceptMergePersianResolutionKey(row.id, "meaning_fa");
      const resolvedPrimaryId = stableIds.get(primaryKey) ?? resolution.resolvedIds.get(primaryKey) ?? null;
      const primaryId = row.meaning_fa
        ? resolvedPrimaryId ?? (await addPersianWordWithClient(row.meaning_fa, {}, tx)).item.id
        : null;
      const otherIds = await Promise.all(row.other_meanings_fa
        .filter((meaning) => meaning !== row.meaning_fa)
        .map(async (meaning, index) => {
          const key = conceptMergePersianResolutionKey(row.id, "other_meanings_fa", index);
          return stableIds.get(key) ?? resolution.resolvedIds.get(key) ??
            (await addPersianWordWithClient(meaning, {}, tx)).item.id;
        }));
      const nextOtherMeaningIds = [...new Set(otherIds.filter((id) => id !== primaryId))];
      const nextConcept = row.concept_explained_fa || null;
      const semanticContentChanged = source.meaningId !== primaryId ||
        !sameOrderedIds(positiveIds(source.otherMeaningIds), nextOtherMeaningIds) ||
        source.concept_explained_fa !== nextConcept ||
        !sameOrderedIds(sentenceIdsFor(source), row.sentenceIds);
      await updateWordSense({
        where: { id: row.id },
        data: {
          meaningId: primaryId,
          otherMeaningIds: nextOtherMeaningIds,
          concept_explained_fa: nextConcept,
          sentenceIds: row.sentenceIds,
          meaningReviewStatus: MeaningReviewStatus.CONFIRMED,
          conceptMergeReviewed: true,
          inflectionMergeReviewed: semanticContentChanged ? false : source.inflectionMergeReviewed,
        },
        select: { id: true },
      }, tx);
    }
    let reviewedOnly = 0;
    for (const id of reviewOnlyIds) {
      const source = byId.get(id)!;
      if (source.conceptMergeReviewed) continue;
      await updateWordSense({
        where: { id },
        data: { conceptMergeReviewed: true },
        select: { id: true },
      }, tx);
      reviewedOnly += 1;
    }
    let deferred = 0;
    for (const id of deferredIds) {
      const source = byId.get(id)!;
      if (!source.conceptMergeReviewed) {
        deferred += 1;
        continue;
      }
      await updateWordSense({
        where: { id },
        data: { conceptMergeReviewed: false },
        select: { id: true },
      }, tx);
      deferred += 1;
    }
    for (const row of removed) await deleteWordSense({ where: { id: row.id } }, tx);
    return { updated: retained.length, deleted: removed.length, reviewedOnly, deferred };
  }, { maxWait: 10_000, timeout: 120_000 });
}
