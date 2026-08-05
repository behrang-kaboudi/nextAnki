import "server-only";

import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

function stripManualUpdatedAt<T extends { data?: unknown }>(args: T): T {
  const data = (args as { data?: Record<string, unknown> }).data;
  if (data && typeof data === "object" && "updatedAt" in data) {
    delete (data as Record<string, unknown>).updatedAt;
  }
  return args;
}

export async function updateWord(args: Prisma.WordUpdateArgs) {
  stripManualUpdatedAt(args);
  return prisma.word.update(args);
}

export async function updateManyWords(args: Prisma.WordUpdateManyArgs) {
  stripManualUpdatedAt(args);
  return prisma.word.updateMany(args);
}

export async function touchWordByAnkiLinkId(ankiLinkId: string) {
  return prisma.word.update({
    where: { anki_link_id: ankiLinkId },
    data: { anki_link_id: ankiLinkId },
  });
}

export async function touchWordsLinkedToSentenceId(sentenceId: number) {
  return prisma.word.updateMany({
    where: {
      sentenceLinks: {
        some: { sentenceId },
      },
    },
    // Audio and Sentence edits are real sync-relevant changes even when no Word column changes.
    data: { updatedAt: new Date() },
  });
}

/** Touch dependent Words when their relation-owned Persian meaning changes. */
export async function touchWordsByIds(ids: readonly number[]) {
  const uniqueIds = [...new Set(ids.filter((id) => Number.isSafeInteger(id) && id > 0))];
  if (!uniqueIds.length) return { count: 0 };
  return prisma.word.updateMany({ where: { id: { in: uniqueIds } }, data: { updatedAt: new Date() } });
}

/** Touch dependent Words when their relation-owned English fields change. */
export async function touchWordsByEnglishId(englishId: number) {
  return prisma.word.updateMany({ where: { englishId }, data: { updatedAt: new Date() } });
}

export async function touchWordsByEnglishIds(englishIds: readonly number[]) {
  const uniqueIds = [...new Set(englishIds.filter((id) => Number.isSafeInteger(id) && id > 0))];
  if (!uniqueIds.length) return { count: 0 };
  return prisma.word.updateMany({ where: { englishId: { in: uniqueIds } }, data: { updatedAt: new Date() } });
}

export async function deleteWord(args: Prisma.WordDeleteArgs) {
  return prisma.word.delete(args);
}
