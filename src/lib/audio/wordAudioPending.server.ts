import "server-only";

import { getEnglishWordAudioFileInfo } from "@/lib/english/englishWordAudio.server";
import { prisma } from "@/lib/prisma";
import { getPersianWordAudioFileInfo } from "@/lib/persian/persianWordAudio.server";
import { getSentenceAudioFileInfo } from "@/lib/sentences/sentenceAudio.server";
import { getWordSenseConceptAudioFileInfo } from "@/lib/words/wordSenseConceptAudio.server";
import { getWordSenseStoryAudioFileInfo } from "@/lib/words/wordSenseStoryAudio.server";

import { audioNeedsGeneration, getAudioGenerationReason } from "./audioSourceText";

export type PendingWordAudioTaskCounts = {
  total: number;
  missingFile: number;
  changedText: number;
};

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

export async function getPendingWordSenseConceptAudioIds(): Promise<number[]> {
  const rows = await prisma.wordSense.findMany({
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
    fileSize: getWordSenseConceptAudioFileInfo(row.concept_explained_fa_audio_file_name).size,
  })).map((row) => row.id);
}

export async function getPendingWordSenseStoryAudioIds(): Promise<number[]> {
  const rows = await prisma.wordSenseStory.findMany({
    where: { isActive: true, storyText: { notIn: [""] } },
    select: { id: true, storyText: true, audio_file_name: true, audio_source_text: true },
  });
  return rows.filter((row) => audioNeedsGeneration({
    text: row.storyText,
    sourceText: row.audio_source_text,
    fileSize: getWordSenseStoryAudioFileInfo(row.audio_file_name).size,
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

export async function getPendingWordAudioTaskCounts(): Promise<PendingWordAudioTaskCounts> {
  const [englishWords, persianWords, concepts, sentences, stories] = await Promise.all([
    prisma.englishWord.findMany({
      select: { base_form: true, audio_file_name: true, audio_source_text: true },
    }),
    prisma.persianWord.findMany({
      select: { canonical_text: true, audio_file_name: true, audio_source_text: true },
    }),
    prisma.wordSense.findMany({
      select: {
        concept_explained_fa: true,
        concept_explained_fa_audio_file_name: true,
        concept_explained_fa_audio_source_text: true,
      },
    }),
    prisma.sentence.findMany({
      select: {
        sentence_en: true,
        sentence_en_meaning_fa: true,
        sentence_en_audio_file_name: true,
        sentence_en_audio_source_text: true,
        sentence_en_meaning_fa_audio_file_name: true,
        sentence_en_meaning_fa_audio_source_text: true,
      },
    }),
    prisma.wordSenseStory.findMany({
      where: { isActive: true, storyText: { notIn: [""] } },
      select: { storyText: true, audio_file_name: true, audio_source_text: true },
    }),
  ]);
  const reasons = [
    ...englishWords.map((row) => getAudioGenerationReason({
      text: row.base_form,
      sourceText: row.audio_source_text,
      fileSize: getEnglishWordAudioFileInfo(row.audio_file_name).size,
    })),
    ...persianWords.map((row) => getAudioGenerationReason({
      text: row.canonical_text,
      sourceText: row.audio_source_text,
      fileSize: getPersianWordAudioFileInfo(row.audio_file_name).size,
    })),
    ...concepts.map((row) => getAudioGenerationReason({
      text: row.concept_explained_fa,
      sourceText: row.concept_explained_fa_audio_source_text,
      fileSize: getWordSenseConceptAudioFileInfo(row.concept_explained_fa_audio_file_name).size,
    })),
    ...sentences.flatMap((row) => [
      getAudioGenerationReason({
        text: row.sentence_en,
        sourceText: row.sentence_en_audio_source_text,
        fileSize: getSentenceAudioFileInfo(row.sentence_en_audio_file_name).size,
      }),
      getAudioGenerationReason({
        text: row.sentence_en_meaning_fa,
        sourceText: row.sentence_en_meaning_fa_audio_source_text,
        fileSize: getSentenceAudioFileInfo(row.sentence_en_meaning_fa_audio_file_name).size,
      }),
    ]),
    ...stories.map((row) => getAudioGenerationReason({
      text: row.storyText,
      sourceText: row.audio_source_text,
      fileSize: getWordSenseStoryAudioFileInfo(row.audio_file_name).size,
    })),
  ];
  const missingFile = reasons.filter((reason) => reason === "missing-file").length;
  const changedText = reasons.filter((reason) => reason === "changed-text").length;
  return { total: missingFile + changedText, missingFile, changedText };
}

export async function getPendingWordAudioTaskCount(): Promise<number> {
  return (await getPendingWordAudioTaskCounts()).total;
}
