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
  concept_explained_fa: string | null;
  sentence_en: string;
  sentence_en_meaning_fa: string | null;
  learning_depth: number | null;
  other_meanings_fa: string | null;
  other_meanings_en: string | null;
  category: string | null;
  hint_to_select: string | null;
  json_hint: string | null;
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
      sentence: true,
    },
  });
  if (!word) return null;

  const withEnglish = flattenWordEnglishRelation(word);
  const primarySentence = withEnglish.sentence ?? null;
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
    concept_explained_fa: word.concept_explained_fa,
    sentenceRecordId: primarySentence?.id ?? null,
    sentence_en: primarySentence?.sentence_en ?? "",
    sentence_en_meaning_fa: primarySentence?.sentence_en_meaning_fa ?? null,
    learning_depth: word.learning_depth,
    other_meanings_fa: withMeanings.other_meanings_fa,
    other_meanings_en: word.other_meanings_en,
    category: word.category,
    hint_to_select: word.hint_to_select,
    json_hint: withEnglish.json_hint,
    imageability: word.imageability,
    productive_target: word.productive_target,
    createdAt: word.createdAt.toISOString(),
    updatedAt: word.updatedAt.toISOString(),
  };
}
