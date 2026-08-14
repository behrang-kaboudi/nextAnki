import "server-only";

import type { Prisma } from "@prisma/client";

import type { WordAudioFieldKey } from "@/lib/audio/wordAudioFields";
import { prisma } from "@/lib/prisma";
import { getSentenceAudioFileInfo } from "@/lib/sentences/sentenceAudio.server";
import { getWordSenseConceptAudioFileInfo } from "@/lib/words/wordSenseConceptAudio.server";
import { primarySentenceId, wordSentenceIds } from "@/lib/words/sentenceIds";

function ids(value: Prisma.JsonValue | null) {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is number =>
      typeof item === "number" && Number.isSafeInteger(item) && item > 0,
  );
}

export async function getWordSenseDeletePreview(id: number) {
  const word = await prisma.wordSense.findUnique({
    where: { id },
    select: {
      id: true,
      anki_link_id: true,
      sentenceIds: true,
      concept_explained_fa_audio_file_name: true,
      english: { select: { base_form: true } },
    },
  });
  if (!word) throw new Error("WordSense not found.");

  const otherWords = await prisma.wordSense.findMany({
    where: { id: { not: id } },
    orderBy: { id: "asc" },
    select: {
      id: true,
      comparedMeaningWordIds: true,
      synonymIds: true,
      sentenceIds: true,
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
  const primaryId = primarySentenceId(word.sentenceIds);
  const sentence = primaryId
    ? await prisma.sentence.findUnique({
        where: { id: primaryId },
        select: {
          id: true,
          sentence_en: true,
          sentence_en_audio_file_name: true,
          sentence_en_meaning_fa_audio_file_name: true,
        },
      })
    : null;
  const linkedWordCount = primaryId
    ? 1 + otherWords.filter((other) => wordSentenceIds(other.sentenceIds).includes(primaryId)).length
    : 0;
  const conceptInfo = getWordSenseConceptAudioFileInfo(word.concept_explained_fa_audio_file_name);
  const audioFiles: Array<{ field: WordAudioFieldKey; count: number; bytes: number }> = [
    { field: "concept_explained_fa", count: conceptInfo.size > 0 ? 1 : 0, bytes: conceptInfo.size },
  ];
  if (sentence && linkedWordCount <= 1) {
    for (const field of ["sentence_en", "sentence_en_meaning_fa"] as const) {
      const filename = field === "sentence_en"
        ? sentence.sentence_en_audio_file_name
        : sentence.sentence_en_meaning_fa_audio_file_name;
      const info = getSentenceAudioFileInfo(filename);
      audioFiles.push({ field, count: info.size > 0 ? 1 : 0, bytes: info.size });
    }
  }
  const existingAudioFiles = audioFiles.filter((field) => field.count > 0);

  return {
    id: word.id,
    word: word.english.base_form,
    ankiLinkId: word.anki_link_id,
    audioFiles: existingAudioFiles,
    totalAudioFiles: existingAudioFiles.reduce((sum, field) => sum + field.count, 0),
    affectedWords,
    sentence: sentence
      ? {
          id: sentence.id,
          sentence_en: sentence.sentence_en,
          willBeDeleted: linkedWordCount <= 1,
          linkedWordCount,
        }
      : null,
  };
}
