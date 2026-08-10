import "server-only";

import { statSync } from "node:fs";
import { copyFile, mkdir, rm } from "node:fs/promises";
import path from "node:path";

import { buildWordConceptAudioFilename } from "@/lib/audio/wordConceptAudioNaming";
import { getWordConceptAudioAbsoluteDir, getWordConceptAudioAbsolutePath } from "@/lib/audio/wordConceptAudioPaths.server";
import { prisma } from "@/lib/prisma";
import { generateSpeechFromMixedText } from "@/lib/tts/cloudTts";
import { updateWord } from "@/lib/words/wordRepo";

function safeOwnedFilename(filename: string | null): string | null {
  return filename && path.basename(filename) === filename ? filename : null;
}

export function getWordConceptAudioFileInfo(filename: string | null): {
  filename: string | null;
  absPath: string | null;
  size: number;
} {
  const safe = safeOwnedFilename(filename);
  if (!safe) return { filename: null, absPath: null, size: 0 };
  const absPath = getWordConceptAudioAbsolutePath(safe);
  try {
    const size = statSync(absPath).size;
    return { filename: safe, absPath, size };
  } catch {
    return { filename: safe, absPath, size: 0 };
  }
}

export async function findWordConceptAudioRecord(wordId: number) {
  return prisma.word.findUnique({
    where: { id: wordId },
    select: {
      id: true,
      concept_explained_fa: true,
      concept_explained_fa_audio_file_name: true,
      concept_explained_fa_audio_source_text: true,
    },
  });
}

async function replaceWordConceptAudioFilename(
  wordId: number,
  filename: string,
  sourceText: string,
  previous: string | null,
) {
  await updateWord({
    where: { id: wordId },
    data: {
      concept_explained_fa_audio_file_name: filename,
      concept_explained_fa_audio_source_text: sourceText,
    },
  });
  const safePrevious = safeOwnedFilename(previous);
  if (safePrevious && safePrevious !== filename) {
    await rm(getWordConceptAudioAbsolutePath(safePrevious), { force: true });
  }
}

export async function generateWordConceptAudio(wordId: number, textOverride?: string) {
  const row = await findWordConceptAudioRecord(wordId);
  if (!row) throw new Error(`Word ${wordId} was not found`);
  const text = String(textOverride ?? row.concept_explained_fa ?? "").trim();
  if (!text) throw new Error(`Word ${wordId} has no concept_explained_fa`);
  const filename = buildWordConceptAudioFilename({ wordId });
  await generateSpeechFromMixedText(text, path.join("word-concepts", filename), "azure");
  await replaceWordConceptAudioFilename(wordId, filename, text, row.concept_explained_fa_audio_file_name);
  return getWordConceptAudioFileInfo(filename);
}

export async function saveWordConceptAudioMp3(wordId: number, sourcePath: string) {
  const row = await findWordConceptAudioRecord(wordId);
  if (!row) throw new Error(`Word ${wordId} was not found`);
  const sourceText = row.concept_explained_fa?.trim() ?? "";
  if (!sourceText) throw new Error(`Word ${wordId} has no concept_explained_fa`);
  const filename = buildWordConceptAudioFilename({ wordId });
  await mkdir(getWordConceptAudioAbsoluteDir(), { recursive: true });
  await copyFile(sourcePath, getWordConceptAudioAbsolutePath(filename));
  await replaceWordConceptAudioFilename(wordId, filename, sourceText, row.concept_explained_fa_audio_file_name);
  return getWordConceptAudioFileInfo(filename);
}

export async function deleteWordConceptAudio(wordId: number) {
  const row = await findWordConceptAudioRecord(wordId);
  if (!row) throw new Error(`Word ${wordId} was not found`);
  await updateWord({
    where: { id: wordId },
    data: {
      concept_explained_fa_audio_file_name: null,
      concept_explained_fa_audio_source_text: null,
    },
  });
  const safe = safeOwnedFilename(row.concept_explained_fa_audio_file_name);
  const info = getWordConceptAudioFileInfo(safe);
  if (safe) await rm(getWordConceptAudioAbsolutePath(safe), { force: true });
  return { deleted: safe ? 1 : 0, failed: 0, deletedBytes: info.size };
}
