import "server-only";

import { MeaningReviewStatus, type Prisma, type PrismaClient } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  isMeaningReviewNeedsAction,
  meaningReviewStatusAfterSemanticChange,
  NEEDS_ACTION_MEANING_REVIEW_STATUSES,
} from "@/lib/words/meaningReviewStatus";
import { wordSentenceIds } from "@/lib/words/sentenceIds";

function stripManualUpdatedAt<T extends { data?: unknown }>(args: T): T {
  const data = (args as { data?: Record<string, unknown> }).data;
  if (data && typeof data === "object" && "updatedAt" in data) {
    delete (data as Record<string, unknown>).updatedAt;
  }
  return args;
}

const conceptMergeInputs = new Set([
  "englishId",
  "english",
  "meaningId",
  "meaning",
  "otherMeaningIds",
  "concept_explained_fa",
]);

const inflectionMergeInputs = new Set([
  "englishId",
  "english",
  "meaningId",
  "meaning",
  "otherMeaningIds",
  "sentenceIds",
  "pos",
  "concept_explained_fa",
]);

function resetConceptMergeReview(data: unknown) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return;
  const record = data as Record<string, unknown>;
  if (record.conceptMergeReviewed !== undefined) return;
  if (Object.keys(record).some((key) => conceptMergeInputs.has(key))) {
    record.conceptMergeReviewed = false;
  }
}

const meaningReviewInputs = new Set([
  "englishId",
  "english",
  "meaningId",
  "meaning",
  "otherMeaningIds",
  "sentenceIds",
  "pos",
  "concept_explained_fa",
]);

function needsMeaningReviewReset(data: unknown) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return;
  const record = data as Record<string, unknown>;
  return record.meaningReviewStatus === undefined &&
    Object.keys(record).some((key) => meaningReviewInputs.has(key));
}

function nextMeaningId(data: Record<string, unknown>, currentMeaningId: number | null) {
  if (data.meaningId === null || typeof data.meaningId === "number") return data.meaningId;
  if (data.meaning && typeof data.meaning === "object" && !Array.isArray(data.meaning)) {
    const relation = data.meaning as Record<string, unknown>;
    if (relation.disconnect === true || relation.delete === true) return null;
    if (relation.connect && typeof relation.connect === "object" && !Array.isArray(relation.connect)) {
      const id = (relation.connect as Record<string, unknown>).id;
      if (typeof id === "number") return id;
    }
  }
  return currentMeaningId;
}

function resetInflectionMergeReview(data: unknown) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return;
  const record = data as Record<string, unknown>;
  if (record.inflectionMergeReviewed !== undefined) return;
  if (Object.keys(record).some((key) => inflectionMergeInputs.has(key))) {
    record.inflectionMergeReviewed = false;
  }
}

type WordSenseWriteClient = Pick<PrismaClient, "wordSense"> | Pick<Prisma.TransactionClient, "wordSense">;

export async function updateWordSense(
  args: Prisma.WordSenseUpdateArgs,
  client: WordSenseWriteClient = prisma,
) {
  stripManualUpdatedAt(args);
  resetConceptMergeReview(args.data);
  if (needsMeaningReviewReset(args.data)) {
    const current = await client.wordSense.findUnique({
      where: args.where,
      select: { meaningId: true, meaningReviewStatus: true },
    });
    if (current) {
      const data = args.data as Record<string, unknown>;
      data.meaningReviewStatus = isMeaningReviewNeedsAction(current.meaningReviewStatus)
        ? current.meaningReviewStatus
        : meaningReviewStatusAfterSemanticChange(nextMeaningId(data, current.meaningId));
    }
  }
  resetInflectionMergeReview(args.data);
  return client.wordSense.update(args);
}

export async function updateManyWordSenses(
  args: Prisma.WordSenseUpdateManyArgs,
  client: WordSenseWriteClient = prisma,
) {
  stripManualUpdatedAt(args);
  resetConceptMergeReview(args.data);
  if (needsMeaningReviewReset(args.data)) {
    throw new Error("Semantic WordSense updateMany writes must set meaningReviewStatus explicitly.");
  }
  resetInflectionMergeReview(args.data);
  return client.wordSense.updateMany(args);
}

export async function touchWordSenseByAnkiLinkId(ankiLinkId: string) {
  return prisma.wordSense.update({
    where: { anki_link_id: ankiLinkId },
    data: { anki_link_id: ankiLinkId },
  });
}

export async function touchWordSensesLinkedToSentenceId(
  sentenceId: number,
  options?: { resetMeaningReviewStatus?: boolean },
  client: WordSenseWriteClient = prisma,
) {
  const words = await client.wordSense.findMany({
    select: { id: true, sentenceIds: true, meaningId: true, meaningReviewStatus: true },
  });
  const linkedWords = words
    .filter((word) => wordSentenceIds(word.sentenceIds).includes(sentenceId));
  if (!linkedWords.length) return { count: 0 };
  if (options?.resetMeaningReviewStatus) {
    const eligibleWords = linkedWords.filter(
      (word) => !NEEDS_ACTION_MEANING_REVIEW_STATUSES.includes(
        word.meaningReviewStatus as (typeof NEEDS_ACTION_MEANING_REVIEW_STATUSES)[number],
      ),
    );
    const withMeaningIds = eligibleWords.filter((word) => word.meaningId !== null).map((word) => word.id);
    const missingMeaningIds = eligibleWords.filter((word) => word.meaningId === null).map((word) => word.id);
    const pending = withMeaningIds.length
      ? await client.wordSense.updateMany({
          where: { id: { in: withMeaningIds } },
          data: { meaningReviewStatus: MeaningReviewStatus.PENDING, updatedAt: new Date() },
        })
      : { count: 0 };
    const missing = missingMeaningIds.length
      ? await client.wordSense.updateMany({
          where: { id: { in: missingMeaningIds } },
          data: {
            meaningReviewStatus: MeaningReviewStatus.NEEDS_ACTION_MISSING_PRIMARY,
            updatedAt: new Date(),
          },
        })
      : { count: 0 };
    return { count: pending.count + missing.count };
  }
  return client.wordSense.updateMany({
    where: { id: { in: linkedWords.map((word) => word.id) } },
    // Audio and Sentence edits are real sync-relevant changes even when no WordSense column changes.
    data: { updatedAt: new Date() },
  });
}

/** Touch dependent WordSenses when their relation-owned Persian meaning changes. */
export async function touchWordSensesByIds(
  ids: readonly number[],
  options?: {
    resetConceptMergeReviewed?: boolean;
    resetMeaningReviewStatus?: boolean;
  },
  client: WordSenseWriteClient = prisma,
) {
  const uniqueIds = [...new Set(ids.filter((id) => Number.isSafeInteger(id) && id > 0))];
  if (!uniqueIds.length) return { count: 0 };
  const touched = await client.wordSense.updateMany({
    where: { id: { in: uniqueIds } },
    data: {
      updatedAt: new Date(),
      ...(options?.resetConceptMergeReviewed ? { conceptMergeReviewed: false } : {}),
    },
  });
  if (options?.resetMeaningReviewStatus) {
    await client.wordSense.updateMany({
      where: {
        id: { in: uniqueIds },
        meaningId: { not: null },
        meaningReviewStatus: { notIn: [...NEEDS_ACTION_MEANING_REVIEW_STATUSES] },
      },
      data: { meaningReviewStatus: MeaningReviewStatus.PENDING },
    });
    await client.wordSense.updateMany({
      where: {
        id: { in: uniqueIds },
        meaningId: null,
        meaningReviewStatus: { notIn: [...NEEDS_ACTION_MEANING_REVIEW_STATUSES] },
      },
      data: { meaningReviewStatus: MeaningReviewStatus.NEEDS_ACTION_MISSING_PRIMARY },
    });
  }
  return touched;
}

/** Touch dependent WordSenses when their relation-owned English fields change. */
export async function touchWordSensesByEnglishId(
  englishId: number,
  options?: {
    resetConceptMergeReviewed?: boolean;
    resetMeaningReviewStatus?: boolean;
  },
) {
  const touched = await prisma.wordSense.updateMany({
    where: { englishId },
    data: {
      updatedAt: new Date(),
      ...(options?.resetConceptMergeReviewed ? { conceptMergeReviewed: false } : {}),
    },
  });
  if (options?.resetMeaningReviewStatus) {
    await prisma.wordSense.updateMany({
      where: {
        englishId,
        meaningId: { not: null },
        meaningReviewStatus: { notIn: [...NEEDS_ACTION_MEANING_REVIEW_STATUSES] },
      },
      data: { meaningReviewStatus: MeaningReviewStatus.PENDING },
    });
    await prisma.wordSense.updateMany({
      where: {
        englishId,
        meaningId: null,
        meaningReviewStatus: { notIn: [...NEEDS_ACTION_MEANING_REVIEW_STATUSES] },
      },
      data: { meaningReviewStatus: MeaningReviewStatus.NEEDS_ACTION_MISSING_PRIMARY },
    });
  }
  return touched;
}

export async function touchWordSensesByEnglishIds(
  englishIds: readonly number[],
  client: WordSenseWriteClient = prisma,
) {
  const uniqueIds = [...new Set(englishIds.filter((id) => Number.isSafeInteger(id) && id > 0))];
  if (!uniqueIds.length) return { count: 0 };
  return client.wordSense.updateMany({ where: { englishId: { in: uniqueIds } }, data: { updatedAt: new Date() } });
}

export async function deleteWordSense(
  args: Prisma.WordSenseDeleteArgs,
  client?: WordSenseWriteClient,
) {
  const deleteWithClient = async (writeClient: WordSenseWriteClient) => {
    const target = await writeClient.wordSense.findUnique({
      where: args.where,
      select: { id: true },
    });
    if (!target) return writeClient.wordSense.delete(args);

    const words = await writeClient.wordSense.findMany({
      where: { id: { not: target.id } },
      select: { id: true, comparedMeaningWordIds: true, synonymIds: true },
    });
    for (const word of words) {
      const asIds = (value: Prisma.JsonValue | null) => Array.isArray(value)
        ? [...new Set(value.filter((item): item is number =>
            typeof item === "number" && Number.isSafeInteger(item) && item > 0 && item !== word.id,
          ))]
        : [];
      const compared = asIds(word.comparedMeaningWordIds);
      const synonyms = asIds(word.synonymIds);
      if (!compared.includes(target.id) && !synonyms.includes(target.id)) continue;
      const nextSynonyms = synonyms.filter((id) => id !== target.id);
      const nextCompared = [...new Set([
        ...compared.filter((id) => id !== target.id),
        ...nextSynonyms,
      ])];
      await updateWordSense({
        where: { id: word.id },
        data: { comparedMeaningWordIds: nextCompared, synonymIds: nextSynonyms },
        select: { id: true },
      }, writeClient);
    }
    return writeClient.wordSense.delete(args);
  };

  return client
    ? deleteWithClient(client)
    : prisma.$transaction((tx) => deleteWithClient(tx));
}
