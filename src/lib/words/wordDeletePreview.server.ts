import "server-only";

import type { Prisma } from "@prisma/client";

import { WORD_AUDIO_FIELDS } from "@/lib/audio/wordFieldAudioNaming";
import { prisma } from "@/lib/prisma";
import { listWordFieldAudioFiles } from "@/lib/words/wordFieldVoice";

function ids(value: Prisma.JsonValue | null) {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is number =>
      typeof item === "number" && Number.isSafeInteger(item) && item > 0,
  );
}

export async function getWordDeletePreview(id: number) {
  const word = await prisma.word.findUnique({
    where: { id },
    select: {
      id: true,
      anki_link_id: true,
      sentenceId: true,
      english: { select: { base_form: true } },
      sentence: {
        select: {
          id: true,
          sentence_en: true,
          _count: { select: { words: true } },
        },
      },
    },
  });
  if (!word) throw new Error("Word not found.");

  const otherWords = await prisma.word.findMany({
    where: { id: { not: id } },
    orderBy: { id: "asc" },
    select: {
      id: true,
      comparedMeaningWordIds: true,
      synonymIds: true,
      english: { select: { base_form: true } },
    },
  });
  const affectedWords = otherWords.flatMap((other) => {
    const compared = ids(other.comparedMeaningWordIds).includes(id);
    const synonym = ids(other.synonymIds).includes(id);
    return compared || synonym
      ? [{
          id: other.id,
          word: other.english.base_form,
          removeFrom: [
            ...(compared ? ["comparedMeaningWordIds"] : []),
            ...(synonym ? ["synonymIds"] : []),
          ],
        }]
      : [];
  });
  const audioFiles = WORD_AUDIO_FIELDS.map((field) => {
    const audioKey = field === "sentence_en" || field === "sentence_en_meaning_fa"
      ? word.sentenceId != null ? String(word.sentenceId) : word.anki_link_id
      : word.anki_link_id;
    const files = listWordFieldAudioFiles({ audioKey, ankiLinkId: audioKey, field });
    return {
      field,
      count: files.length,
      bytes: files.reduce((sum, file) => sum + file.size, 0),
    };
  }).filter((field) => field.count > 0);

  return {
    id: word.id,
    word: word.english.base_form,
    ankiLinkId: word.anki_link_id,
    audioFiles,
    totalAudioFiles: audioFiles.reduce((sum, field) => sum + field.count, 0),
    affectedWords,
    sentence: word.sentence
      ? {
          id: word.sentence.id,
          sentence_en: word.sentence.sentence_en,
          willBeDeleted: word.sentence._count.words <= 1,
          linkedWordCount: word.sentence._count.words,
        }
      : null,
  };
}
