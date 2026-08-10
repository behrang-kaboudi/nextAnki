import { prisma } from "@/lib/prisma";

export type TableColumnEmptyCounts = Readonly<Record<string, number>>;

function isEmptyValue(value: unknown) {
  return (
    value === null ||
    value === undefined ||
    (typeof value === "string" && value.trim() === "") ||
    (Array.isArray(value) && value.length === 0)
  );
}

function countEmpty<T extends Record<string, unknown>>(
  rows: readonly T[],
  key: keyof T,
) {
  return rows.reduce(
    (count, row) => count + (isEmptyValue(row[key]) ? 1 : 0),
    0,
  );
}

export async function getWordColumnEmptyCounts(): Promise<TableColumnEmptyCounts> {
  const rows = await prisma.word.findMany({
    select: {
      anki_link_id: true,
      meaningId: true,
      sentenceIds: true,
      conceptMergeReviewed: true,
      otherMeaningIds: true,
      comparedMeaningWordIds: true,
      synonymIds: true,
      pos: true,
      concept_explained_fa: true,
      concept_explained_fa_audio_file_name: true,
      concept_explained_fa_audio_source_text: true,
      learning_depth: true,
      other_meanings_en: true,
      category: true,
      hint_to_select: true,
      imageability: true,
      productive_target: true,
    },
  });

  return {
    id: 0,
    englishId: 0,
    meaningId: countEmpty(rows, "meaningId"),
    sentenceIds: countEmpty(rows, "sentenceIds"),
    conceptMergeReviewed: 0,
    otherMeaningIds: countEmpty(rows, "otherMeaningIds"),
    comparedMeaningWordIds: countEmpty(rows, "comparedMeaningWordIds"),
    synonymIds: countEmpty(rows, "synonymIds"),
    meanings_confirmed: 0,
    pos: countEmpty(rows, "pos"),
    concept_explained_fa: countEmpty(rows, "concept_explained_fa"),
    concept_explained_fa_audio_file_name: countEmpty(rows, "concept_explained_fa_audio_file_name"),
    concept_explained_fa_audio_source_text: countEmpty(rows, "concept_explained_fa_audio_source_text"),
    learning_depth: countEmpty(rows, "learning_depth"),
    other_meanings_en: countEmpty(rows, "other_meanings_en"),
    category: countEmpty(rows, "category"),
    hint_to_select: countEmpty(rows, "hint_to_select"),
    imageability: countEmpty(rows, "imageability"),
    productive_target: countEmpty(rows, "productive_target"),
    anki_link_id: countEmpty(rows, "anki_link_id"),
    createdAt: 0,
    updatedAt: 0,
  };
}

export async function getEnglishWordColumnEmptyCounts(): Promise<TableColumnEmptyCounts> {
  const rows = await prisma.englishWord.findMany({
    select: {
      base_form: true,
      phonetic_us: true,
      phonetic_us_normalized: true,
      json_hint: true,
      audio_file_name: true,
      audio_source_text: true,
    },
  });

  return {
    id: 0,
    base_form: countEmpty(rows, "base_form"),
    phonetic_us: countEmpty(rows, "phonetic_us"),
    phonetic_us_normalized: countEmpty(rows, "phonetic_us_normalized"),
    json_hint: countEmpty(rows, "json_hint"),
    audio: countEmpty(rows, "audio_file_name"),
    audio_source_text: countEmpty(rows, "audio_source_text"),
    createdAt: 0,
    updatedAt: 0,
  };
}

export async function getPersianWordColumnEmptyCounts(): Promise<TableColumnEmptyCounts> {
  const rows = await prisma.persianWord.findMany({
    select: {
      canonical_text: true,
      normalized_text: true,
      not_normalized_texts: true,
      meaning_fa_IPA: true,
      meaning_fa_IPA_normalize: true,
      audio_file_name: true,
      audio_source_text: true,
    },
  });

  return {
    id: 0,
    canonical_text: countEmpty(rows, "canonical_text"),
    normalized_text: countEmpty(rows, "normalized_text"),
    not_normalized_texts: countEmpty(rows, "not_normalized_texts"),
    meaning_fa_IPA: countEmpty(rows, "meaning_fa_IPA"),
    meaning_fa_IPA_normalize: countEmpty(rows, "meaning_fa_IPA_normalize"),
    audio_file_name: countEmpty(rows, "audio_file_name"),
    audio_source_text: countEmpty(rows, "audio_source_text"),
    createdAt: 0,
    updatedAt: 0,
  };
}

export async function getSentenceColumnEmptyCounts(): Promise<TableColumnEmptyCounts> {
  const rows = await prisma.sentence.findMany({
    select: {
      sentence_en: true,
      sentence_en_meaning_fa: true,
      sentence_en_audio_file_name: true,
      sentence_en_audio_source_text: true,
      sentence_en_meaning_fa_audio_file_name: true,
      sentence_en_meaning_fa_audio_source_text: true,
    },
  });

  return {
    id: 0,
    sentence_en: countEmpty(rows, "sentence_en"),
    sentence_en_meaning_fa: countEmpty(rows, "sentence_en_meaning_fa"),
    sentence_en_audio_file_name: countEmpty(
      rows,
      "sentence_en_audio_file_name",
    ),
    sentence_en_audio_source_text: countEmpty(
      rows,
      "sentence_en_audio_source_text",
    ),
    sentence_en_meaning_fa_audio_file_name: countEmpty(
      rows,
      "sentence_en_meaning_fa_audio_file_name",
    ),
    sentence_en_meaning_fa_audio_source_text: countEmpty(
      rows,
      "sentence_en_meaning_fa_audio_source_text",
    ),
    createdAt: 0,
    updatedAt: 0,
  };
}
