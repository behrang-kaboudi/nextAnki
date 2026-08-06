import "server-only";

import { prisma } from "@/lib/prisma";
import { updateWord } from "@/lib/words/wordRepo";

type PrimarySentenceRecord = {
  id: number;
  sentence_en: string;
  sentence_en_meaning_fa: string | null;
};

function isBlank(value: string | null | undefined) {
  return typeof value !== "string" || value.trim() === "";
}

const sentenceSelect = {
  id: true,
  sentence_en: true,
  sentence_en_meaning_fa: true,
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

  return prisma.$transaction(async (tx) => {
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
      const updated = await tx.sentence.update({
        where: { id: existingSentence.id },
        data: { sentence_en: nextSentenceEn, sentence_en_meaning_fa },
        select: sentenceSelect,
      });
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
          data: { sentence_en_meaning_fa },
          select: sentenceSelect,
        });
        nextMeaning = updated.sentence_en_meaning_fa;
      }

      if (existingSentence && existingSentence.id !== matchedSentence.id) {
        await tx.sentence.deleteMany({
          where: { id: existingSentence.id, words: { none: {} } },
        });
      }

      return {
        id: matchedSentence.id,
        sentence_en: matchedSentence.sentence_en,
        sentence_en_meaning_fa: nextMeaning,
      };
    }

    if (existingSentence) {
      const updated = await tx.sentence.update({
        where: { id: existingSentence.id },
        data: { sentence_en: nextSentenceEn, sentence_en_meaning_fa },
        select: sentenceSelect,
      });
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
}

export async function updatePrimarySentenceByAnkiLinkId(
  ankiLinkId: string,
  data: { sentence_en?: string; sentence_en_meaning_fa?: string | null },
) {
  const current = await findPrimarySentenceByAnkiLinkId(ankiLinkId);
  if (!current) {
    throw new Error(`Primary sentence not found for anki_link_id=${ankiLinkId}`);
  }
  return prisma.sentence.update({ where: { id: current.id }, data });
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
