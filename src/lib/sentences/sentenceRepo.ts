import "server-only";

import fsp from "node:fs/promises";
import path from "node:path";

import { getSentenceAudioAbsolutePath } from "@/lib/audio/sentenceAudioPaths.server";
import { prisma } from "@/lib/prisma";
import { updateWord } from "@/lib/words/wordRepo";

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
    const word = await tx.word.findUnique({
      where: { anki_link_id: ankiLinkId },
      select: { id: true, sentence: { select: sentenceSelect } },
    });
    if (!word) {
      throw new Error(`Word not found for anki_link_id=${ankiLinkId}`);
    }

    const existingSentence = word.sentence;
    const matchedSentence = await tx.sentence.findUnique({
      where: { sentence_en: nextSentenceEn },
      select: sentenceSelect,
    });

    if (existingSentence?.sentence_en === nextSentenceEn) {
      const meaningChanged = existingSentence.sentence_en_meaning_fa !== sentence_en_meaning_fa;
      const updated = await tx.sentence.update({
        where: { id: existingSentence.id },
        data: {
          sentence_en: nextSentenceEn,
          sentence_en_meaning_fa,
          ...(meaningChanged ? { sentence_en_meaning_fa_audio_file_name: null } : {}),
        },
        select: sentenceSelect,
      });
      if (meaningChanged && existingSentence.sentence_en_meaning_fa_audio_file_name) {
        filesToDelete.push(existingSentence.sentence_en_meaning_fa_audio_file_name);
      }
      await updateWord(
        { where: { id: word.id }, data: { sentenceId: existingSentence.id } },
        tx,
      );
      return updated;
    }

    if (matchedSentence) {
      await updateWord(
        { where: { id: word.id }, data: { sentenceId: matchedSentence.id } },
        tx,
      );

      let nextMeaning = matchedSentence.sentence_en_meaning_fa;
      if (sentence_en_meaning_fa !== null && isBlank(nextMeaning)) {
        const updated = await tx.sentence.update({
          where: { id: matchedSentence.id },
          data: { sentence_en_meaning_fa, sentence_en_meaning_fa_audio_file_name: null },
          select: sentenceSelect,
        });
        if (matchedSentence.sentence_en_meaning_fa_audio_file_name) {
          filesToDelete.push(matchedSentence.sentence_en_meaning_fa_audio_file_name);
        }
        nextMeaning = updated.sentence_en_meaning_fa;
      }

      if (existingSentence && existingSentence.id !== matchedSentence.id) {
        const deleted = await tx.sentence.deleteMany({
          where: { id: existingSentence.id, words: { none: {} } },
        });
        if (deleted.count) {
          filesToDelete.push(
            existingSentence.sentence_en_audio_file_name ?? "",
            existingSentence.sentence_en_meaning_fa_audio_file_name ?? "",
          );
        }
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
      const sentenceChanged = existingSentence.sentence_en !== nextSentenceEn;
      const meaningChanged = existingSentence.sentence_en_meaning_fa !== sentence_en_meaning_fa;
      const updated = await tx.sentence.update({
        where: { id: existingSentence.id },
        data: {
          sentence_en: nextSentenceEn,
          sentence_en_meaning_fa,
          ...(sentenceChanged ? { sentence_en_audio_file_name: null } : {}),
          ...(meaningChanged ? { sentence_en_meaning_fa_audio_file_name: null } : {}),
        },
        select: sentenceSelect,
      });
      if (sentenceChanged && existingSentence.sentence_en_audio_file_name) filesToDelete.push(existingSentence.sentence_en_audio_file_name);
      if (meaningChanged && existingSentence.sentence_en_meaning_fa_audio_file_name) filesToDelete.push(existingSentence.sentence_en_meaning_fa_audio_file_name);
      await updateWord(
        { where: { id: word.id }, data: { sentenceId: existingSentence.id } },
        tx,
      );
      return updated;
    }

    const createdSentence = await tx.sentence.create({
      data: { sentence_en: nextSentenceEn, sentence_en_meaning_fa },
      select: sentenceSelect,
    });
    await updateWord(
      { where: { id: word.id }, data: { sentenceId: createdSentence.id } },
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
  const sentenceChanged = data.sentence_en !== undefined && data.sentence_en.trim() !== current.sentence_en;
  const meaningChanged = data.sentence_en_meaning_fa !== undefined && data.sentence_en_meaning_fa !== current.sentence_en_meaning_fa;
  const updated = await prisma.sentence.update({
    where: { id: current.id },
    data: {
      ...data,
      ...(sentenceChanged ? { sentence_en_audio_file_name: null } : {}),
      ...(meaningChanged ? { sentence_en_meaning_fa_audio_file_name: null } : {}),
    },
  });
  const staleFiles = [
    sentenceChanged ? current.sentence_en_audio_file_name : null,
    meaningChanged ? current.sentence_en_meaning_fa_audio_file_name : null,
  ].filter((filename): filename is string => Boolean(filename) && path.basename(filename!) === filename);
  await Promise.allSettled(staleFiles.map((filename) => fsp.rm(getSentenceAudioAbsolutePath(filename), { force: true })));
  return updated;
}

export async function findPrimarySentenceByAnkiLinkId(
  ankiLinkId: string,
): Promise<PrimarySentenceRecord | null> {
  const word = await prisma.word.findUnique({
    where: { anki_link_id: ankiLinkId },
    select: { sentence: { select: sentenceSelect } },
  });
  return word?.sentence ?? null;
}

export async function findPrimarySentenceByWordId(
  wordId: number,
): Promise<PrimarySentenceRecord | null> {
  const word = await prisma.word.findUnique({
    where: { id: wordId },
    select: { sentence: { select: sentenceSelect } },
  });
  return word?.sentence ?? null;
}

export async function listPrimarySentencesByAnkiLinkIds(ankiLinkIds: string[]) {
  if (!ankiLinkIds.length) return new Map<string, PrimarySentenceRecord>();

  const rows = await prisma.word.findMany({
    where: { anki_link_id: { in: ankiLinkIds }, sentenceId: { not: null } },
    select: {
      anki_link_id: true,
      sentence: { select: sentenceSelect },
    },
  });

  return new Map(
    rows.flatMap((row) =>
      row.sentence ? [[row.anki_link_id, row.sentence] as const] : [],
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
