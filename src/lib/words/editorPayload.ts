import "server-only";

import { prisma } from "@/lib/prisma";
import { meaningIds } from "@/lib/words/persianMeanings.server";

export type WordEditorInitial = {
  id: number;
  anki_link_id: string;
  englishId: number;
  sentenceId: number | null;
  sentenceIds: number[];
  meaningId: number | null;
  otherMeaningIds: number[];
  comparedMeaningWordIds: number[];
  synonymIds: number[];
  meanings_confirmed: boolean;
  english: {
    id: number;
    base_form: string;
    phonetic_us: string | null;
    phonetic_us_confirmed: boolean;
    phonetic_us_normalized: string | null;
    json_hint: string | null;
    audio_file_name: string | null;
  };
  meaningLabel: string | null;
  sentence: {
    id: number;
    sentence_en: string;
    sentence_en_meaning_fa: string | null;
    sentence_en_audio_file_name: string | null;
    sentence_en_meaning_fa_audio_file_name: string | null;
    createdAt: string;
    updatedAt: string;
  } | null;
  pos: string | null;
  concept_explained_fa: string | null;
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
  const word = await prisma.word.findUnique({
    where: { id },
    include: {
      english: true,
      meaning: { select: { canonical_text: true } },
      sentence: true,
    },
  });
  if (!word) return null;

  return {
    id: word.id,
    anki_link_id: word.anki_link_id,
    englishId: word.englishId,
    meaningId: word.meaningId,
    otherMeaningIds: meaningIds(word.otherMeaningIds),
    pos: word.pos,
    concept_explained_fa: word.concept_explained_fa,
    sentenceId: word.sentenceId,
    sentenceIds: meaningIds(word.sentenceIds),
    comparedMeaningWordIds: meaningIds(word.comparedMeaningWordIds),
    synonymIds: meaningIds(word.synonymIds),
    meanings_confirmed: word.meanings_confirmed,
    english: {
      id: word.english.id,
      base_form: word.english.base_form,
      phonetic_us: word.english.phonetic_us,
      phonetic_us_confirmed: word.english.phonetic_us_confirmed,
      phonetic_us_normalized: word.english.phonetic_us_normalized,
      json_hint: word.english.json_hint,
      audio_file_name: word.english.audio_file_name,
    },
    meaningLabel: word.meaning?.canonical_text ?? null,
    sentence: word.sentence
      ? {
          id: word.sentence.id,
          sentence_en: word.sentence.sentence_en,
          sentence_en_meaning_fa: word.sentence.sentence_en_meaning_fa,
          sentence_en_audio_file_name: word.sentence.sentence_en_audio_file_name,
          sentence_en_meaning_fa_audio_file_name:
            word.sentence.sentence_en_meaning_fa_audio_file_name,
          createdAt: word.sentence.createdAt.toISOString(),
          updatedAt: word.sentence.updatedAt.toISOString(),
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
