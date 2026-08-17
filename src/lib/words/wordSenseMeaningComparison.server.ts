import "server-only";

import { MeaningReviewStatus, type Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { selectPromptBatch } from "@/lib/words/promptBatch";
import { updateWordSense } from "@/lib/words/wordSenseRepo";

type ComparisonSourceWordSense = {
  id: number;
  meaningId: number | null;
  otherMeaningIds: Prisma.JsonValue | null;
  comparedMeaningWordIds: Prisma.JsonValue | null;
  synonymIds: Prisma.JsonValue | null;
  conceptMergeReviewed: boolean;
  inflectionMergeReviewed: boolean;
  pos: string | null;
  concept_explained_fa: string | null;
  meaningReviewStatus: MeaningReviewStatus;
  english: { base_form: string };
};

export type MeaningComparisonOutputGroup = {
  persianWordId: number;
  records: Array<{
    id: number;
    concept_explained_fa: string;
    synonymIds: number[];
  }>;
};

export type MeaningComparisonSourceGroup = {
  persianWordId: number;
  sourceWordIds: number[];
};

const comparisonSelect = {
  id: true,
  meaningId: true,
  otherMeaningIds: true,
  comparedMeaningWordIds: true,
  synonymIds: true,
  conceptMergeReviewed: true,
  inflectionMergeReviewed: true,
  pos: true,
  concept_explained_fa: true,
  meaningReviewStatus: true,
  english: { select: { base_form: true } },
} satisfies Prisma.WordSenseSelect;

export function positiveUniqueIds(value: Prisma.JsonValue | null): number[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter(
    (item): item is number =>
      typeof item === "number" && Number.isSafeInteger(item) && item > 0,
  ))];
}

function persianMeaningIds(word: Pick<ComparisonSourceWordSense, "meaningId" | "otherMeaningIds">) {
  return [...new Set([
    ...(word.meaningId ? [word.meaningId] : []),
    ...positiveUniqueIds(word.otherMeaningIds),
  ])];
}

function isFullyCompared(group: ComparisonSourceWordSense[]) {
  return group.every((word) => {
    const compared = new Set(positiveUniqueIds(word.comparedMeaningWordIds));
    return group.every((other) => other.id === word.id || compared.has(other.id));
  });
}

function buildGroups(words: ComparisonSourceWordSense[]) {
  const groups = new Map<number, ComparisonSourceWordSense[]>();
  for (const word of words) {
    for (const persianWordId of persianMeaningIds(word)) {
      const group = groups.get(persianWordId) ?? [];
      group.push(word);
      groups.set(persianWordId, group);
    }
  }
  return [...groups.entries()]
    .sort(([left], [right]) => left - right)
    .filter(([, group]) => group.length >= 2)
    .map(([persianWordId, group]) => ({
      persianWordId,
      words: group.sort((left, right) => left.id - right.id),
    }));
}

async function comparisonItemsForGroups(
  groups: Array<{ persianWordId: number; words: ComparisonSourceWordSense[] }>,
) {
  const meaningIds = [...new Set(groups.flatMap(({ words: group }) =>
    group.flatMap(persianMeaningIds),
  ))];
  const meanings = meaningIds.length
    ? await prisma.persianWord.findMany({
        where: { id: { in: meaningIds } },
        select: { id: true, canonical_text: true },
      })
    : [];
  const meaningById = new Map(meanings.map((meaning) => [meaning.id, meaning.canonical_text]));

  return groups.map(({ persianWordId, words: group }) => ({
    persianWordId,
    shared_persian_meaning: meaningById.get(persianWordId) ?? "",
    records: group.map((word) => ({
      id: word.id,
      word: word.english.base_form,
      pos: word.pos ?? "",
      meaning_fa: word.meaningId ? meaningById.get(word.meaningId) ?? "" : "",
      other_meanings_fa: positiveUniqueIds(word.otherMeaningIds)
        .filter((id) => id !== word.meaningId)
        .flatMap((id) => {
          const meaning = meaningById.get(id);
          return meaning ? [meaning] : [];
        }),
      concept_explained_fa: word.concept_explained_fa ?? "",
      synonymIds: positiveUniqueIds(word.synonymIds).filter(
        (id) => id !== word.id && group.some((candidate) => candidate.id === id),
      ),
    })),
  }));
}

export async function prepareWordSenseMeaningComparison(batchSize: number) {
  const words = await prisma.wordSense.findMany({
    where: { meaningReviewStatus: MeaningReviewStatus.CONFIRMED },
    orderBy: { id: "asc" },
    select: comparisonSelect,
  });
  const candidateGroups = buildGroups(words).filter(({ words: group }) => !isFullyCompared(group));
  const existingSharedMeanings = candidateGroups.length
    ? await prisma.persianWord.findMany({
        where: { id: { in: candidateGroups.map((group) => group.persianWordId) } },
        select: { id: true },
      })
    : [];
  const existingSharedMeaningIds = new Set(existingSharedMeanings.map((meaning) => meaning.id));
  const eligible = candidateGroups.filter((group) => existingSharedMeaningIds.has(group.persianWordId));
  const selected = selectPromptBatch(eligible, batchSize);

  // Ignore stale PersianWord ids in JSON when building prompt data; primary meaning ids
  // are protected by their foreign key. The existing otherMeaningIds field is not changed.
  return {
    totalEligibleGroups: eligible.length,
    items: await comparisonItemsForGroups(selected),
  };
}

export async function getPendingWordSenseMeaningComparisonStats() {
  const words = await prisma.wordSense.findMany({
    where: { meaningReviewStatus: MeaningReviewStatus.CONFIRMED },
    orderBy: { id: "asc" },
    select: comparisonSelect,
  });
  const candidateGroups = buildGroups(words).filter(
    ({ words: group }) => !isFullyCompared(group),
  );
  if (!candidateGroups.length) return { groupCount: 0, recordCount: 0 };
  const existingSharedMeanings = await prisma.persianWord.findMany({
    where: {
      id: { in: candidateGroups.map((group) => group.persianWordId) },
    },
    select: { id: true },
  });
  const existingSharedMeaningIds = new Set(existingSharedMeanings.map((meaning) => meaning.id));
  const groups = candidateGroups.filter((group) => existingSharedMeaningIds.has(group.persianWordId));
  return {
    groupCount: groups.length,
    recordCount: new Set(groups.flatMap((group) => group.words.map((word) => word.id))).size,
  };
}

export async function getPendingWordSenseMeaningComparisonCount() {
  return (await getPendingWordSenseMeaningComparisonStats()).groupCount;
}

function isPositiveId(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function hasOnlyKeys(item: Record<string, unknown>, allowed: readonly string[]) {
  return Object.keys(item).every((key) => allowed.includes(key));
}

export function parseMeaningComparisonOutput(value: unknown): MeaningComparisonOutputGroup[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error("Response must be a non-empty JSON array of groups.");
  }
  const seenGroups = new Set<number>();
  return value.map((rawGroup) => {
    if (!rawGroup || typeof rawGroup !== "object") throw new Error("Every response group must be an object.");
    const group = rawGroup as Record<string, unknown>;
    if (!isPositiveId(group.persianWordId) || seenGroups.has(group.persianWordId) ||
        !hasOnlyKeys(group, ["persianWordId", "records"]) || !Array.isArray(group.records) || group.records.length < 2) {
      throw new Error("Every group needs a unique persianWordId and at least two records.");
    }
    seenGroups.add(group.persianWordId);
    const seenRecords = new Set<number>();
    const records = group.records.map((rawRecord) => {
      if (!rawRecord || typeof rawRecord !== "object") throw new Error("Every response record must be an object.");
      const record = rawRecord as Record<string, unknown>;
      const concept = typeof record.concept_explained_fa === "string"
        ? record.concept_explained_fa.trim()
        : "";
      if (!isPositiveId(record.id) || seenRecords.has(record.id) || !concept || concept.split(/\s+/u).length > 50 ||
          !hasOnlyKeys(record, ["id", "concept_explained_fa", "synonymIds"]) || !Array.isArray(record.synonymIds) ||
          !record.synonymIds.every(isPositiveId) || new Set(record.synonymIds).size !== record.synonymIds.length ||
          record.synonymIds.includes(record.id)) {
        throw new Error(`Record ${String(record.id)} has an invalid id, concept, or synonymIds array.`);
      }
      seenRecords.add(record.id);
      return { id: record.id, concept_explained_fa: concept, synonymIds: record.synonymIds };
    });
    const ids = new Set(records.map((record) => record.id));
    for (const record of records) {
      if (record.synonymIds.some((id) => !ids.has(id))) {
        throw new Error(`Record ${record.id} references a synonym outside its candidate group.`);
      }
      for (const synonymId of record.synonymIds) {
        if (!records.find((candidate) => candidate.id === synonymId)?.synonymIds.includes(record.id)) {
          throw new Error(`The synonym relationship between ${record.id} and ${synonymId} is not bidirectional.`);
        }
      }
    }
    return { persianWordId: group.persianWordId, records };
  });
}

function sameOrderedIds(left: readonly number[], right: readonly number[]) {
  return left.length === right.length && left.every((id, index) => id === right[index]);
}

export async function loadWordSenseMeaningComparisonGroups(
  output: MeaningComparisonOutputGroup[],
) {
  const words = await prisma.wordSense.findMany({
    where: { meaningReviewStatus: MeaningReviewStatus.CONFIRMED },
    orderBy: { id: "asc" },
    select: comparisonSelect,
  });
  const currentByPersianWordId = new Map(
    buildGroups(words).map((group) => [group.persianWordId, group]),
  );
  const requestedGroups = output.map((outputGroup) => {
    const current = currentByPersianWordId.get(outputGroup.persianWordId);
    if (!current) {
      throw new Error(`PersianWord group ${outputGroup.persianWordId} no longer exists.`);
    }
    const outputIds = outputGroup.records.map((record) => record.id);
    const currentIds = current.words.map((word) => word.id);
    if (!sameOrderedIds(outputIds, currentIds)) {
      throw new Error(
        `Members of PersianWord group ${outputGroup.persianWordId} changed; current WordSense ids are [${currentIds.join(", ")}].`,
      );
    }
    return current;
  });
  return { items: await comparisonItemsForGroups(requestedGroups) };
}

export async function applyWordSenseMeaningComparison(
  persianWordId: number,
  sourceWordIds: number[],
  output: MeaningComparisonOutputGroup,
) {
  const result = await applyWordSenseMeaningComparisonBatch(
    [{ persianWordId, sourceWordIds }],
    [output],
  );
  return { updated: result.updated };
}

export async function applyWordSenseMeaningComparisonBatch(
  sourceGroups: MeaningComparisonSourceGroup[],
  output: MeaningComparisonOutputGroup[],
) {
  return prisma.$transaction(async (tx) => {
    if (!sourceGroups.length || sourceGroups.length !== output.length) {
      throw new Error("Every output group needs one matching source candidate group.");
    }
    const allWords = await tx.wordSense.findMany({
      where: { meaningReviewStatus: MeaningReviewStatus.CONFIRMED },
      orderBy: { id: "asc" },
      select: comparisonSelect,
    });
    const currentGroupByPersianWordId = new Map(
      buildGroups(allWords).map((group) => [group.persianWordId, group]),
    );
    const validWordIds = new Set(allWords.map((word) => word.id));
    const nextById = new Map(allWords.map((word) => [word.id, { ...word }]));
    const affectedIds = new Set<number>();
    let updated = 0;

    // Validate and calculate every final value before the first database write.
    // A WordSense can belong to multiple groups, so this mutable snapshot preserves
    // the current submitted-group ordering while accumulating every relationship.
    for (let groupIndex = 0; groupIndex < output.length; groupIndex += 1) {
      const source = sourceGroups[groupIndex];
      const outputGroup = output[groupIndex];
      if (!isPositiveId(source?.persianWordId) || outputGroup.persianWordId !== source.persianWordId ||
          !Array.isArray(source.sourceWordIds) || source.sourceWordIds.length < 2 ||
          source.sourceWordIds.some((id) => !isPositiveId(id)) ||
          new Set(source.sourceWordIds).size !== source.sourceWordIds.length) {
        throw new Error(`Source candidate group ${groupIndex + 1} is invalid.`);
      }
      const currentGroup = currentGroupByPersianWordId.get(source.persianWordId);
      if (!currentGroup) {
        throw new Error(`PersianWord group ${source.persianWordId} no longer exists.`);
      }
      const currentIds = currentGroup?.words.map((word) => word.id) ?? [];
      if (!sameOrderedIds(source.sourceWordIds, currentIds)) {
        throw new Error(
          `PersianWord group ${source.persianWordId} changed. Create the data again before confirming it.`,
        );
      }
      if (!sameOrderedIds(source.sourceWordIds, outputGroup.records.map((record) => record.id))) {
        throw new Error(
          `Output for PersianWord group ${source.persianWordId} must contain every source WordSense id exactly once and in source order.`,
        );
      }

      for (const record of outputGroup.records) {
        const current = nextById.get(record.id)!;
        const existingSynonyms = positiveUniqueIds(current.synonymIds)
          .filter((id) => id !== record.id && validWordIds.has(id));
        const nextSynonyms = [...new Set([...existingSynonyms, ...record.synonymIds])].sort((a, b) => a - b);
        const existingCompared = positiveUniqueIds(current.comparedMeaningWordIds)
          .filter((id) => id !== record.id && validWordIds.has(id));
        const nextCompared = [...new Set([
          ...existingCompared,
          ...source.sourceWordIds.filter((id) => id !== record.id),
          ...nextSynonyms,
        ])].sort((a, b) => a - b);
        nextById.set(record.id, {
          ...current,
          concept_explained_fa: record.concept_explained_fa,
          comparedMeaningWordIds: nextCompared,
          synonymIds: nextSynonyms,
        });
        affectedIds.add(record.id);
        updated += 1;
      }
    }

    for (const id of affectedIds) {
      const next = nextById.get(id)!;
      await updateWordSense({
        where: { id },
        data: {
          concept_explained_fa: next.concept_explained_fa,
          comparedMeaningWordIds: positiveUniqueIds(next.comparedMeaningWordIds),
          synonymIds: positiveUniqueIds(next.synonymIds),
          conceptMergeReviewed: next.conceptMergeReviewed,
          inflectionMergeReviewed: next.inflectionMergeReviewed,
          meaningReviewStatus: MeaningReviewStatus.CONFIRMED,
        },
        select: { id: true },
      }, tx);
    }
    return { confirmed: output.length, updated, uniqueUpdated: affectedIds.size };
  }, { maxWait: 10_000, timeout: 120_000 });
}
