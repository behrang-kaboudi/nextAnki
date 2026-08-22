import "server-only";

import { normalizeEnglishWordText } from "@/lib/english/normalize";
import {
  flattenWordSenseEnglishRelation,
  WORD_SENSE_ENGLISH_FIELDS_SELECT,
} from "@/lib/english/wordSenseEnglishFields.server";
import { prisma } from "@/lib/prisma";
import { hydrateWordSensesWithPersianMeanings } from "@/lib/words/persianMeanings.server";
import { hydrateWordsWithPrimarySentence } from "@/lib/words/primarySentences.server";

export type WordSenseSearchItem = {
  id: number;
  anki_link_id: string;
  base_form: string;
  pos: string;
  meaning_fa: string;
  other_meanings_fa: string[];
  concept_explained_fa: string;
  sentence_en: string;
  sentence_en_meaning_fa: string;
};

export async function searchWordSensesByExactBaseForm(input: string) {
  const baseForm = normalizeEnglishWordText(input);
  if (!baseForm) {
    throw new Error("base_form must contain an English word.");
  }

  const rows = await prisma.wordSense.findMany({
    where: {
      english: { is: { base_form: baseForm } },
    },
    select: {
      id: true,
      anki_link_id: true,
      englishId: true,
      english: { select: WORD_SENSE_ENGLISH_FIELDS_SELECT },
      meaningId: true,
      otherMeaningIds: true,
      pos: true,
      concept_explained_fa: true,
      sentenceIds: true,
    },
    orderBy: { id: "asc" },
  });

  const hydrated = await hydrateWordSensesWithPersianMeanings(
    await hydrateWordsWithPrimarySentence(
      rows.map(flattenWordSenseEnglishRelation),
    ),
  );

  const items: WordSenseSearchItem[] = hydrated.map((row) => ({
    id: row.id,
    anki_link_id: row.anki_link_id,
    base_form: row.base_form,
    pos: row.pos ?? "",
    meaning_fa: row.meaning_fa,
    other_meanings_fa: row.otherPersianWords.map(
      (meaning) => meaning.canonical_text,
    ),
    concept_explained_fa: row.concept_explained_fa ?? "",
    sentence_en: row.sentence?.sentence_en ?? "",
    sentence_en_meaning_fa: row.sentence?.sentence_en_meaning_fa ?? "",
  }));

  return {
    base_form: baseForm,
    exists: items.length > 0,
    count: items.length,
    items,
  };
}
