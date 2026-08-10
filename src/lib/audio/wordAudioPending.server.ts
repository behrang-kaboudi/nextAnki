import "server-only";

import { getEnglishWordAudioFileInfo } from "@/lib/english/englishWordAudio.server";
import { prisma } from "@/lib/prisma";
import { getPersianWordAudioFileInfo } from "@/lib/persian/persianWordAudio.server";
import { getSentenceAudioFileInfo } from "@/lib/sentences/sentenceAudio.server";
import { getWordConceptAudioFileInfo } from "@/lib/words/wordConceptAudio.server";

import { audioNeedsGeneration } from "./audioSourceText";

export async function getPendingEnglishWordAudioIds(): Promise<number[]> {
  const rows = await prisma.englishWord.findMany({
    select: { id: true, base_form: true, audio_file_name: true, audio_source_text: true },
  });
  return rows.filter((row) => audioNeedsGeneration({
    text: row.base_form,
    sourceText: row.audio_source_text,
    fileSize: getEnglishWordAudioFileInfo(row.audio_file_name).size,
  })).map((row) => row.id);
}

export async function getPendingPersianWordAudioIds(): Promise<number[]> {
  const rows = await prisma.persianWord.findMany({
    select: { id: true, canonical_text: true, audio_file_name: true, audio_source_text: true },
  });
  return rows.filter((row) => audioNeedsGeneration({
    text: row.canonical_text,
    sourceText: row.audio_source_text,
    fileSize: getPersianWordAudioFileInfo(row.audio_file_name).size,
  })).map((row) => row.id);
}

export async function getPendingWordConceptAudioIds(): Promise<number[]> {
  const rows = await prisma.word.findMany({
    select: {
      id: true,
      concept_explained_fa: true,
      concept_explained_fa_audio_file_name: true,
      concept_explained_fa_audio_source_text: true,
    },
  });
  return rows.filter((row) => audioNeedsGeneration({
    text: row.concept_explained_fa,
    sourceText: row.concept_explained_fa_audio_source_text,
    fileSize: getWordConceptAudioFileInfo(row.concept_explained_fa_audio_file_name).size,
  })).map((row) => row.id);
}

export async function getPendingSentenceAudioIds(
  field: "sentence_en" | "sentence_en_meaning_fa",
): Promise<number[]> {
  const rows = await prisma.sentence.findMany({
    select: {
      id: true,
      sentence_en: true,
      sentence_en_meaning_fa: true,
      sentence_en_audio_file_name: true,
      sentence_en_audio_source_text: true,
      sentence_en_meaning_fa_audio_file_name: true,
      sentence_en_meaning_fa_audio_source_text: true,
    },
  });
  return rows.filter((row) => audioNeedsGeneration({
    text: field === "sentence_en" ? row.sentence_en : row.sentence_en_meaning_fa,
    sourceText: field === "sentence_en"
      ? row.sentence_en_audio_source_text
      : row.sentence_en_meaning_fa_audio_source_text,
    fileSize: getSentenceAudioFileInfo(
      field === "sentence_en"
        ? row.sentence_en_audio_file_name
        : row.sentence_en_meaning_fa_audio_file_name,
    ).size,
  })).map((row) => row.id);
}

export async function getPendingWordAudioTaskCount(): Promise<number> {
  const pendingByField = await Promise.all([
    getPendingEnglishWordAudioIds(),
    getPendingPersianWordAudioIds(),
    getPendingWordConceptAudioIds(),
    getPendingSentenceAudioIds("sentence_en"),
    getPendingSentenceAudioIds("sentence_en_meaning_fa"),
  ]);
  return pendingByField.reduce((total, ids) => total + ids.length, 0);
}
