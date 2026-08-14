import "server-only";

import fsp from "node:fs/promises";
import path from "node:path";
import type { Prisma } from "@prisma/client";

import { getSentenceAudioAbsolutePath } from "@/lib/audio/sentenceAudioPaths.server";
import { prisma } from "@/lib/prisma";
import { touchWordSensesLinkedToSentenceId, updateWordSense } from "@/lib/words/wordSenseRepo";
import { primarySentenceId, wordSentenceIds } from "@/lib/words/sentenceIds";

type PrimarySentenceRecord = {
  id: number;
  sentence_en: string;
  sentence_en_meaning_fa: string | null;
  sentence_en_audio_file_name: string | null;
  sentence_en_meaning_fa_audio_file_name: string | null;
};

function isBlank(value: string | null | undefined) {
  return typeof value !== "string" || value.trim() === "";
}

const sentenceSelect = {
  id: true,
  sentence_en: true,
  sentence_en_meaning_fa: true,
  sentence_en_audio_file_name: true,
  sentence_en_meaning_fa_audio_file_name: true,
} as const;

async function primarySentenceForIds(
  client: Prisma.TransactionClient | typeof prisma,
  sentenceIds: Prisma.JsonValue | null,
) {
  const id = primarySentenceId(sentenceIds);
  return id ? client.sentence.findUnique({ where: { id }, select: sentenceSelect }) : null;
}

async function deleteSentenceIfUnreferenced(
  tx: Prisma.TransactionClient,
  sentence: PrimarySentenceRecord,
  filesToDelete: string[],
) {
  const words = await tx.wordSense.findMany({ select: { sentenceIds: true } });
  if (words.some((word) => wordSentenceIds(word.sentenceIds).includes(sentence.id))) return;
  const deleted = await tx.sentence.deleteMany({ where: { id: sentence.id } });
  if (deleted.count) {
    filesToDelete.push(
      sentence.sentence_en_audio_file_name ?? "",
      sentence.sentence_en_meaning_fa_audio_file_name ?? "",
    );
  }
}

export async function upsertPrimarySentenceByAnkiLinkId(args: {
  ankiLinkId: string;
  sentence_en: string;
  sentence_en_meaning_fa?: string | null;
}) {
  const { ankiLinkId, sentence_en, sentence_en_meaning_fa = null } = args;
  const nextSentenceEn = sentence_en.trim();

  if (!nextSentenceEn) {
    throw new Error("sentence_en must not be empty.");
  }

  const filesToDelete: string[] = [];
  const result = await prisma.$transaction(async (tx) => {
    const word = await tx.wordSense.findUnique({
      where: { anki_link_id: ankiLinkId },
      select: { id: true, sentenceIds: true },
    });
    if (!word) {
      throw new Error(`WordSense not found for anki_link_id=${ankiLinkId}`);
    }

    const currentIds = wordSentenceIds(word.sentenceIds);
    const existingSentence = await primarySentenceForIds(tx, word.sentenceIds);
    const matchedSentence = await tx.sentence.findUnique({
      where: { sentence_en: nextSentenceEn },
      select: sentenceSelect,
    });

    if (existingSentence?.sentence_en === nextSentenceEn) {
      const updated = await tx.sentence.update({
        where: { id: existingSentence.id },
        data: {
          sentence_en: nextSentenceEn,
          sentence_en_meaning_fa,
        },
        select: sentenceSelect,
      });
      await updateWordSense({ where: { id: word.id }, data: { sentenceIds: currentIds } }, tx);
      return updated;
    }

    if (matchedSentence) {
      const nextIds = [matchedSentence.id, ...currentIds.filter((id) => id !== matchedSentence.id && id !== existingSentence?.id)];
      await updateWordSense(
        { where: { id: word.id }, data: { sentenceIds: nextIds } },
        tx,
      );

      let nextMeaning = matchedSentence.sentence_en_meaning_fa;
      if (sentence_en_meaning_fa !== null && isBlank(nextMeaning)) {
        const updated = await tx.sentence.update({
          where: { id: matchedSentence.id },
          data: { sentence_en_meaning_fa },
          select: sentenceSelect,
        });
        nextMeaning = updated.sentence_en_meaning_fa;
      }

      if (existingSentence && existingSentence.id !== matchedSentence.id) {
        await deleteSentenceIfUnreferenced(tx, existingSentence, filesToDelete);
      }

      return {
        id: matchedSentence.id,
        sentence_en: matchedSentence.sentence_en,
        sentence_en_meaning_fa: nextMeaning,
        sentence_en_audio_file_name: matchedSentence.sentence_en_audio_file_name,
        sentence_en_meaning_fa_audio_file_name: matchedSentence.sentence_en_meaning_fa_audio_file_name,
      };
    }

    if (existingSentence) {
      const updated = await tx.sentence.update({
        where: { id: existingSentence.id },
        data: {
          sentence_en: nextSentenceEn,
          sentence_en_meaning_fa,
        },
        select: sentenceSelect,
      });
      await updateWordSense({ where: { id: word.id }, data: { sentenceIds: currentIds } }, tx);
      return updated;
    }

    const createdSentence = await tx.sentence.create({
      data: { sentence_en: nextSentenceEn, sentence_en_meaning_fa },
      select: sentenceSelect,
    });
    await updateWordSense(
      { where: { id: word.id }, data: { sentenceIds: [createdSentence.id, ...currentIds] } },
      tx,
    );
    return createdSentence;
  });
  await Promise.allSettled(
    filesToDelete
      .filter((filename) => filename && path.basename(filename) === filename)
      .map((filename) => fsp.rm(getSentenceAudioAbsolutePath(filename), { force: true })),
  );
  return result;
}

export async function updatePrimarySentenceByAnkiLinkId(
  ankiLinkId: string,
  data: { sentence_en?: string; sentence_en_meaning_fa?: string | null },
) {
  const current = await findPrimarySentenceByAnkiLinkId(ankiLinkId);
  if (!current) {
    throw new Error(`Primary sentence not found for anki_link_id=${ankiLinkId}`);
  }
  const updated = await prisma.sentence.update({
    where: { id: current.id },
    data: {
      ...data,
    },
  });
  await touchWordSensesLinkedToSentenceId(current.id);
  return updated;
}

export async function findPrimarySentenceByAnkiLinkId(
  ankiLinkId: string,
): Promise<PrimarySentenceRecord | null> {
  const word = await prisma.wordSense.findUnique({
    where: { anki_link_id: ankiLinkId },
    select: { sentenceIds: true },
  });
  return word ? primarySentenceForIds(prisma, word.sentenceIds) : null;
}

export async function findPrimarySentenceByWordId(
  wordId: number,
): Promise<PrimarySentenceRecord | null> {
  const word = await prisma.wordSense.findUnique({
    where: { id: wordId },
    select: { sentenceIds: true },
  });
  return word ? primarySentenceForIds(prisma, word.sentenceIds) : null;
}

export async function listPrimarySentencesByAnkiLinkIds(ankiLinkIds: string[]) {
  if (!ankiLinkIds.length) return new Map<string, PrimarySentenceRecord>();

  const rows = await prisma.wordSense.findMany({
    where: { anki_link_id: { in: ankiLinkIds } },
    select: {
      anki_link_id: true,
      sentenceIds: true,
    },
  });

  const primaryIds = [...new Set(rows.flatMap((row) => {
    const id = primarySentenceId(row.sentenceIds);
    return id ? [id] : [];
  }))];
  const sentences = primaryIds.length
    ? await prisma.sentence.findMany({ where: { id: { in: primaryIds } }, select: sentenceSelect })
    : [];
  const byId = new Map(sentences.map((sentence) => [sentence.id, sentence]));

  return new Map(
    rows.flatMap((row) =>
      primarySentenceId(row.sentenceIds) && byId.get(primarySentenceId(row.sentenceIds)!)
        ? [[row.anki_link_id, byId.get(primarySentenceId(row.sentenceIds)!)!] as const]
        : [],
    ),
  );
}

export function getSentenceAudioKey(
  sentenceId: number | string | null | undefined,
): string | null {
  if (sentenceId == null) return null;
  const value = String(sentenceId).trim();
  return value.length ? value : null;
}

export async function touchSentenceById(sentenceId: number) {
  return prisma.sentence.update({
    where: { id: sentenceId },
    data: { updatedAt: new Date() },
  });
}
