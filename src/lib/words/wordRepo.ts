import "server-only";

import type { Prisma, PrismaClient } from "@prisma/client";

import { prisma } from "@/lib/prisma";

function stripManualUpdatedAt<T extends { data?: unknown }>(args: T): T {
  const data = (args as { data?: Record<string, unknown> }).data;
  if (data && typeof data === "object" && "updatedAt" in data) {
    delete (data as Record<string, unknown>).updatedAt;
  }
  return args;
}

type WordWriteClient = Pick<PrismaClient, "word"> | Pick<Prisma.TransactionClient, "word">;

export async function updateWord(
  args: Prisma.WordUpdateArgs,
  client: WordWriteClient = prisma,
) {
  stripManualUpdatedAt(args);
  return client.word.update(args);
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
    where: { sentenceId },
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

export async function deleteWord(
  args: Prisma.WordDeleteArgs,
  client?: WordWriteClient,
) {
  const deleteWithClient = async (writeClient: WordWriteClient) => {
    const target = await writeClient.word.findUnique({
      where: args.where,
      select: { id: true },
    });
    if (!target) return writeClient.word.delete(args);

    const words = await writeClient.word.findMany({
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
      await updateWord({
        where: { id: word.id },
        data: { comparedMeaningWordIds: nextCompared, synonymIds: nextSynonyms },
        select: { id: true },
      }, writeClient);
    }
    return writeClient.word.delete(args);
  };

  return client
    ? deleteWithClient(client)
    : prisma.$transaction((tx) => deleteWithClient(tx));
}
