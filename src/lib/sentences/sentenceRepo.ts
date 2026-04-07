import "server-only";

import { prisma } from "@/lib/prisma";

type PrimarySentenceRecord = {
  id: number;
  sentence_en: string;
  sentence_en_meaning_fa: string | null;
};

function isBlank(value: string | null | undefined) {
  return typeof value !== "string" || value.trim() === "";
}

async function getWordIdByAnkiLinkId(ankiLinkId: string) {
  const word = await prisma.word.findUnique({
    where: { anki_link_id: ankiLinkId },
    select: { id: true },
  });
  if (!word) {
    throw new Error(`Word not found for anki_link_id=${ankiLinkId}`);
  }
  return word.id;
}

export async function upsertPrimarySentenceByAnkiLinkId(args: {
  ankiLinkId: string;
  sentence_en: string;
  sentence_en_meaning_fa?: string | null;
}) {
  const { ankiLinkId, sentence_en, sentence_en_meaning_fa = null } = args;
  const wordId = await getWordIdByAnkiLinkId(ankiLinkId);
  const nextSentenceEn = sentence_en.trim();

  if (!nextSentenceEn) {
    throw new Error("sentence_en must not be empty.");
  }

  return prisma.$transaction(async (tx) => {
    const existingPrimary = await tx.sentenceWordLink.findFirst({
      where: { wordId, isPrimary: true },
      select: {
        sentenceId: true,
        sentence: {
          select: {
            id: true,
            sentence_en: true,
            sentence_en_meaning_fa: true,
          },
        },
      },
    });

    const matchedSentence = await tx.sentence.findUnique({
      where: { sentence_en: nextSentenceEn },
      select: {
        id: true,
        sentence_en: true,
        sentence_en_meaning_fa: true,
      },
    });

    if (existingPrimary?.sentence && existingPrimary.sentence.sentence_en === nextSentenceEn) {
      const nextMeaning =
        sentence_en_meaning_fa !== null && isBlank(existingPrimary.sentence.sentence_en_meaning_fa)
          ? sentence_en_meaning_fa
          : sentence_en_meaning_fa;
      await tx.sentence.update({
        where: { id: existingPrimary.sentence.id },
        data: { sentence_en: nextSentenceEn, sentence_en_meaning_fa: nextMeaning },
      });

      await tx.sentenceWordLink.updateMany({
        where: { wordId, sentenceId: { not: existingPrimary.sentence.id }, isPrimary: true },
        data: { isPrimary: false },
      });

      return {
        id: existingPrimary.sentence.id,
        sentence_en: nextSentenceEn,
        sentence_en_meaning_fa: nextMeaning,
      };
    }

    if (matchedSentence) {
      await tx.sentenceWordLink.updateMany({
        where: { wordId, isPrimary: true },
        data: { isPrimary: false },
      });

      await tx.sentenceWordLink.upsert({
        where: {
          sentenceId_wordId: {
            sentenceId: matchedSentence.id,
            wordId,
          },
        },
        update: { isPrimary: true },
        create: {
          sentenceId: matchedSentence.id,
          wordId,
          isPrimary: true,
        },
      });

      if (
        sentence_en_meaning_fa !== null &&
        isBlank(matchedSentence.sentence_en_meaning_fa)
      ) {
        await tx.sentence.update({
          where: { id: matchedSentence.id },
          data: { sentence_en_meaning_fa },
        });
      }

      if (existingPrimary?.sentence && existingPrimary.sentence.id !== matchedSentence.id) {
        await tx.sentence.deleteMany({
          where: {
            id: existingPrimary.sentence.id,
            wordLinks: { none: {} },
          },
        });
      }

      return {
        id: matchedSentence.id,
        sentence_en: matchedSentence.sentence_en,
        sentence_en_meaning_fa:
          !isBlank(matchedSentence.sentence_en_meaning_fa) || sentence_en_meaning_fa == null
            ? matchedSentence.sentence_en_meaning_fa
            : sentence_en_meaning_fa,
      };
    }

    if (existingPrimary?.sentence) {
      await tx.sentence.update({
        where: { id: existingPrimary.sentence.id },
        data: { sentence_en: nextSentenceEn, sentence_en_meaning_fa },
      });

      await tx.sentenceWordLink.updateMany({
        where: { wordId, sentenceId: { not: existingPrimary.sentence.id }, isPrimary: true },
        data: { isPrimary: false },
      });

      return {
        id: existingPrimary.sentence.id,
        sentence_en: nextSentenceEn,
        sentence_en_meaning_fa,
      };
    }

    const createdSentence = await tx.sentence.create({
      data: { sentence_en: nextSentenceEn, sentence_en_meaning_fa },
      select: {
        id: true,
        sentence_en: true,
        sentence_en_meaning_fa: true,
      },
    });

    await tx.sentenceWordLink.updateMany({
      where: { wordId, isPrimary: true },
      data: { isPrimary: false },
    });

    await tx.sentenceWordLink.create({
      data: {
        sentenceId: createdSentence.id,
        wordId,
        isPrimary: true,
      },
    });

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
  return prisma.sentenceWordLink.findFirst({
    where: {
      isPrimary: true,
      word: { anki_link_id: ankiLinkId },
    },
    select: {
      sentence: {
        select: {
          id: true,
          sentence_en: true,
          sentence_en_meaning_fa: true,
        },
      },
    },
  }).then((row) => row?.sentence ?? null);
}

export async function findPrimarySentenceByWordId(
  wordId: number,
): Promise<PrimarySentenceRecord | null> {
  return prisma.sentenceWordLink.findFirst({
    where: { wordId, isPrimary: true },
    select: {
      sentence: {
        select: {
          id: true,
          sentence_en: true,
          sentence_en_meaning_fa: true,
        },
      },
    },
  }).then((row) => row?.sentence ?? null);
}

export async function listPrimarySentencesByAnkiLinkIds(ankiLinkIds: string[]) {
  if (!ankiLinkIds.length) return new Map<string, PrimarySentenceRecord>();

  const rows = await prisma.sentenceWordLink.findMany({
    where: {
      isPrimary: true,
      word: {
        anki_link_id: { in: ankiLinkIds },
      },
    },
    select: {
      word: { select: { anki_link_id: true } },
      sentence: {
        select: {
          id: true,
          sentence_en: true,
          sentence_en_meaning_fa: true,
        },
      },
    },
  });

  return new Map(
    rows.map((row) => [
      row.word.anki_link_id,
      {
        id: row.sentence.id,
        sentence_en: row.sentence.sentence_en,
        sentence_en_meaning_fa: row.sentence.sentence_en_meaning_fa,
      },
    ]),
  );
}

export function getSentenceAudioKey(sentenceId: number | string | null | undefined): string | null {
  if (sentenceId == null) return null;
  const value = String(sentenceId).trim();
  return value.length ? value : null;
}
