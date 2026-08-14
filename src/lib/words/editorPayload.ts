import "server-only";

import { prisma } from "@/lib/prisma";
import { meaningIds } from "@/lib/words/persianMeanings.server";
import { primarySentenceId } from "@/lib/words/sentenceIds";

export type WordEditorInitial = {
  id: number;
  anki_link_id: string;
  englishId: number;
  sentenceIds: number[];
  conceptMergeReviewed: boolean;
  meaningId: number | null;
  otherMeaningIds: number[];
  comparedMeaningWordIds: number[];
  synonymIds: number[];
  meanings_confirmed: boolean;
  english: {
    id: number;
    base_form: string;
    phonetic_us: string | null;
    phonetic_us_normalized: string | null;
    json_hint: string | null;
    audio_file_name: string | null;
    audio_source_text: string | null;
  };
  meaningLabel: string | null;
  sentence: {
    id: number;
    sentence_en: string;
    sentence_en_meaning_fa: string | null;
    sentence_en_audio_file_name: string | null;
    sentence_en_audio_source_text: string | null;
    sentence_en_meaning_fa_audio_file_name: string | null;
    sentence_en_meaning_fa_audio_source_text: string | null;
    createdAt: string;
    updatedAt: string;
  } | null;
  pos: string | null;
  concept_explained_fa: string | null;
  concept_explained_fa_audio_file_name: string | null;
  concept_explained_fa_audio_source_text: string | null;
  learning_depth: number | null;
  other_meanings_en: string | null;
  category: string | null;
  hint_to_select: string | null;
  imageability: number | null;
  productive_target: number | null;

  createdAt: string;
  updatedAt: string;
};

export async function getWordEditorInitial(id: number): Promise<WordEditorInitial | null> {
  const word = await prisma.wordSense.findUnique({
    where: { id },
    include: {
      english: true,
      meaning: { select: { canonical_text: true } },
    },
  });
  if (!word) return null;
  const sentenceId = primarySentenceId(word.sentenceIds);
  const sentence = sentenceId
    ? await prisma.sentence.findUnique({ where: { id: sentenceId } })
    : null;

  return {
    id: word.id,
    anki_link_id: word.anki_link_id,
    englishId: word.englishId,
    meaningId: word.meaningId,
    otherMeaningIds: meaningIds(word.otherMeaningIds),
    pos: word.pos,
    concept_explained_fa: word.concept_explained_fa,
    concept_explained_fa_audio_file_name: word.concept_explained_fa_audio_file_name,
    concept_explained_fa_audio_source_text: word.concept_explained_fa_audio_source_text,
    sentenceIds: meaningIds(word.sentenceIds),
    conceptMergeReviewed: word.conceptMergeReviewed,
    comparedMeaningWordIds: meaningIds(word.comparedMeaningWordIds),
    synonymIds: meaningIds(word.synonymIds),
    meanings_confirmed: word.meanings_confirmed,
    english: {
      id: word.english.id,
      base_form: word.english.base_form,
      phonetic_us: word.english.phonetic_us,
      phonetic_us_normalized: word.english.phonetic_us_normalized,
      json_hint: word.english.json_hint,
      audio_file_name: word.english.audio_file_name,
      audio_source_text: word.english.audio_source_text,
    },
    meaningLabel: word.meaning?.canonical_text ?? null,
    sentence: sentence
      ? {
          id: sentence.id,
          sentence_en: sentence.sentence_en,
          sentence_en_meaning_fa: sentence.sentence_en_meaning_fa,
          sentence_en_audio_file_name: sentence.sentence_en_audio_file_name,
          sentence_en_audio_source_text: sentence.sentence_en_audio_source_text,
          sentence_en_meaning_fa_audio_file_name:
            sentence.sentence_en_meaning_fa_audio_file_name,
          sentence_en_meaning_fa_audio_source_text:
            sentence.sentence_en_meaning_fa_audio_source_text,
          createdAt: sentence.createdAt.toISOString(),
          updatedAt: sentence.updatedAt.toISOString(),
        }
      : null,
    learning_depth: word.learning_depth,
    other_meanings_en: word.other_meanings_en,
    category: word.category,
    hint_to_select: word.hint_to_select,
    imageability: word.imageability,
    productive_target: word.productive_target,
    createdAt: word.createdAt.toISOString(),
    updatedAt: word.updatedAt.toISOString(),
  };
}
