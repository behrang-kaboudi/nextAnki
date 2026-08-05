import "server-only";

import { prisma } from "@/lib/prisma";
import { flattenWordEnglishRelation, WORD_ENGLISH_FIELDS_SELECT } from "@/lib/english/wordEnglishFields.server";
import { hydrateWordWithPersianMeanings, meaningIds, type PersianWordMeaning } from "@/lib/words/persianMeanings.server";

export type WordEditorInitial = {
  id: number;
  anki_link_id: string;
  sentenceRecordId: number | null;
  meaningId: number | null;
  otherMeaningIds: number[];
  primaryMeaning: PersianWordMeaning | null;
  otherMeanings: PersianWordMeaning[];

  base_form: string;
  phonetic_us: string | null;
  phonetic_us_normalized: string | null;
  meaning_fa: string;
  meaning_fa_IPA: string;
  meaning_fa_IPA_normalized: string;
  pos: string | null;
  concept_explained: string | null;
  concept_explained_fa: string | null;
  word_hint_story: string | null;
  sentence_en: string;
  sentence_en_meaning_fa: string | null;
  explanation_for_sentence_meaning: string | null;
  learning_depth: number | null;
  mixed_sentence: string | null;
  other_meanings_fa: string | null;
  other_meanings_en: string | null;
  category: string | null;
  typeOfWordInDb: string;
  hint_sentence: string | null;
  first_letter_en_hint: string | null;
  first_letter_fa_hint: string | null;
  hint_to_select: string | null;
  json_hint: string | null;
  word_note: string | null;
  common_error: string | null;
  imageability: number | null;
  productive_target: number | null;

  createdAt: string;
  updatedAt: string;
};

export async function getWordEditorInitial(id: number): Promise<WordEditorInitial | null> {
  const word = await prisma.word.findUnique({
    where: { id },
    include: {
      english: { select: WORD_ENGLISH_FIELDS_SELECT },
      sentenceLinks: {
        where: { isPrimary: true },
        take: 1,
        include: { sentence: true },
      },
    },
  });
  if (!word) return null;

  const withEnglish = flattenWordEnglishRelation(word);
  const primarySentence = withEnglish.sentenceLinks[0]?.sentence ?? null;
  const withMeanings = await hydrateWordWithPersianMeanings(withEnglish);

  return {
    id: word.id,
    anki_link_id: word.anki_link_id,
    base_form: withEnglish.base_form,
    phonetic_us: withEnglish.phonetic_us,
    phonetic_us_normalized: withEnglish.phonetic_us_normalized,
    meaningId: word.meaningId,
    otherMeaningIds: meaningIds(word.otherMeaningIds),
    primaryMeaning: withMeanings.primaryPersianWord,
    otherMeanings: withMeanings.otherPersianWords,
    meaning_fa: withMeanings.meaning_fa,
    meaning_fa_IPA: withMeanings.meaning_fa_IPA,
    meaning_fa_IPA_normalized: withMeanings.meaning_fa_IPA_normalized,
    pos: word.pos,
    concept_explained: word.concept_explained,
    concept_explained_fa: word.concept_explained_fa,
    word_hint_story: word.word_hint_story,
    sentenceRecordId: primarySentence?.id ?? null,
    sentence_en: primarySentence?.sentence_en ?? "",
    sentence_en_meaning_fa: primarySentence?.sentence_en_meaning_fa ?? null,
    explanation_for_sentence_meaning: word.explanation_for_sentence_meaning,
    learning_depth: word.learning_depth,
    mixed_sentence: word.mixed_sentence,
    other_meanings_fa: withMeanings.other_meanings_fa,
    other_meanings_en: word.other_meanings_en,
    category: word.category,
    typeOfWordInDb: word.typeOfWordInDb,
    hint_sentence: word.hint_sentence,
    first_letter_en_hint: word.first_letter_en_hint,
    first_letter_fa_hint: word.first_letter_fa_hint,
    hint_to_select: word.hint_to_select,
    json_hint: withEnglish.json_hint,
    word_note: word.word_note,
    common_error: word.common_error,
    imageability: word.imageability,
    productive_target: word.productive_target,
    createdAt: word.createdAt.toISOString(),
    updatedAt: word.updatedAt.toISOString(),
  };
}
