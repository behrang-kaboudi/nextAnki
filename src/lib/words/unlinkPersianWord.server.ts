import "server-only";

import { MeaningReviewStatus, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { removePersianWordIdFromJsonArray } from "@/lib/words/persianWordUnlink";
import { updateWordSense } from "@/lib/words/wordSenseRepo";

export class PersianWordNotFoundError extends Error {}
export class PersianWordLinksChangedError extends Error {}

function sortedIds(references: readonly { id: number }[]) {
  return references.map((reference) => reference.id).sort((left, right) => left - right);
}

function sameIds(left: readonly number[], right: readonly number[]) {
  return left.length === right.length && left.every((id, index) => id === right[index]);
}

export async function unlinkPersianWord(args: {
  persianWordId: number;
  expectedPrimaryWordSenseIds: number[];
  expectedSecondaryWordSenseIds: number[];
}) {
  const { persianWordId } = args;
  return prisma.$transaction(async (tx) => {
    const persianWord = await tx.persianWord.findUnique({
      where: { id: persianWordId },
      select: { id: true },
    });
    if (!persianWord) throw new PersianWordNotFoundError("PersianWord not found.");

    const [primaryReferences, secondaryReferences] = await Promise.all([
      tx.wordSense.findMany({
        where: { meaningId: persianWordId },
        select: { id: true, meaningId: true, otherMeaningIds: true },
      }),
      tx.wordSense.findMany({
        where: {
          OR: [
            { otherMeaningIds: { array_contains: persianWordId } },
            { otherMeaningIds: { array_contains: String(persianWordId) } },
          ],
        },
        select: { id: true, meaningId: true, otherMeaningIds: true },
      }),
    ]);

    const currentPrimaryIds = sortedIds(primaryReferences);
    const currentSecondaryIds = sortedIds(secondaryReferences);
    if (
      !sameIds(currentPrimaryIds, [...args.expectedPrimaryWordSenseIds].sort((left, right) => left - right)) ||
      !sameIds(currentSecondaryIds, [...args.expectedSecondaryWordSenseIds].sort((left, right) => left - right))
    ) {
      throw new PersianWordLinksChangedError("PersianWord links changed after preview. Reopen Unlink and review the current links.");
    }

    const references = new Map(
      [...primaryReferences, ...secondaryReferences].map((reference) => [reference.id, reference]),
    );
    let primaryLinksRemoved = 0;
    let secondaryLinksRemoved = 0;

    for (const reference of references.values()) {
      const removesPrimary = reference.meaningId === persianWordId;
      const nextOtherMeaningIds = removePersianWordIdFromJsonArray(reference.otherMeaningIds, persianWordId);
      const removesSecondary = nextOtherMeaningIds !== null && Array.isArray(reference.otherMeaningIds) &&
        nextOtherMeaningIds.length !== reference.otherMeaningIds.length;

      await updateWordSense({
        where: { id: reference.id },
        data: {
          ...(removesPrimary ? { meaningId: null } : {}),
          ...(removesSecondary ? { otherMeaningIds: nextOtherMeaningIds as Prisma.InputJsonValue } : {}),
          ...(removesPrimary ? { meaningReviewStatus: MeaningReviewStatus.NEEDS_ACTION_MISSING_PRIMARY } : {}),
          conceptMergeReviewed: false,
          inflectionMergeReviewed: false,
          comparedMeaningWordIds: Prisma.DbNull,
          synonymIds: Prisma.DbNull,
        },
        select: { id: true },
      }, tx);

      if (removesPrimary) primaryLinksRemoved += 1;
      if (removesSecondary) secondaryLinksRemoved += 1;
    }

    return {
      persianWordId,
      affectedWordSenseIds: [...references.keys()].sort((left, right) => left - right),
      primaryLinksRemoved,
      secondaryLinksRemoved,
    };
  }, { isolationLevel: "Serializable", maxWait: 10_000, timeout: 120_000 });
}
