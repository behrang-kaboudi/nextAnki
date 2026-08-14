import "server-only";

import { statSync } from "node:fs";
import { copyFile, mkdir, rm } from "node:fs/promises";
import path from "node:path";

import { buildWordSenseConceptAudioFilename } from "@/lib/audio/wordSenseConceptAudioNaming";
import { getWordSenseConceptAudioAbsoluteDir, getWordSenseConceptAudioAbsolutePath } from "@/lib/audio/wordSenseConceptAudioPaths.server";
import { prisma } from "@/lib/prisma";
import { generateSpeechFromMixedText } from "@/lib/tts/cloudTts";
import { updateWordSense } from "@/lib/words/wordSenseRepo";

function safeOwnedFilename(filename: string | null): string | null {
  return filename && path.basename(filename) === filename ? filename : null;
}

export function getWordSenseConceptAudioFileInfo(filename: string | null): {
  filename: string | null;
  absPath: string | null;
  size: number;
} {
  const safe = safeOwnedFilename(filename);
  if (!safe) return { filename: null, absPath: null, size: 0 };
  const absPath = getWordSenseConceptAudioAbsolutePath(safe);
  try {
    const size = statSync(absPath).size;
    return { filename: safe, absPath, size };
  } catch {
    return { filename: safe, absPath, size: 0 };
  }
}

export async function findWordSenseConceptAudioRecord(wordId: number) {
  return prisma.wordSense.findUnique({
    where: { id: wordId },
    select: {
      id: true,
      concept_explained_fa: true,
      concept_explained_fa_audio_file_name: true,
      concept_explained_fa_audio_source_text: true,
    },
  });
}

async function replaceWordSenseConceptAudioFilename(
  wordId: number,
  filename: string,
  sourceText: string,
  previous: string | null,
) {
  await updateWordSense({
    where: { id: wordId },
    data: {
      concept_explained_fa_audio_file_name: filename,
      concept_explained_fa_audio_source_text: sourceText,
    },
  });
  const safePrevious = safeOwnedFilename(previous);
  if (safePrevious && safePrevious !== filename) {
    await rm(getWordSenseConceptAudioAbsolutePath(safePrevious), { force: true });
  }
}

export async function generateWordSenseConceptAudio(wordId: number, textOverride?: string) {
  const row = await findWordSenseConceptAudioRecord(wordId);
  if (!row) throw new Error(`WordSense ${wordId} was not found`);
  const text = String(textOverride ?? row.concept_explained_fa ?? "").trim();
  if (!text) throw new Error(`WordSense ${wordId} has no concept_explained_fa`);
  const filename = buildWordSenseConceptAudioFilename({ wordSenseId: wordId });
  await generateSpeechFromMixedText(text, path.join("word-concepts", filename), "azure");
  await replaceWordSenseConceptAudioFilename(wordId, filename, text, row.concept_explained_fa_audio_file_name);
  return getWordSenseConceptAudioFileInfo(filename);
}

export async function saveWordSenseConceptAudioMp3(wordId: number, sourcePath: string) {
  const row = await findWordSenseConceptAudioRecord(wordId);
  if (!row) throw new Error(`WordSense ${wordId} was not found`);
  const sourceText = row.concept_explained_fa?.trim() ?? "";
  if (!sourceText) throw new Error(`WordSense ${wordId} has no concept_explained_fa`);
  const filename = buildWordSenseConceptAudioFilename({ wordSenseId: wordId });
  await mkdir(getWordSenseConceptAudioAbsoluteDir(), { recursive: true });
  await copyFile(sourcePath, getWordSenseConceptAudioAbsolutePath(filename));
  await replaceWordSenseConceptAudioFilename(wordId, filename, sourceText, row.concept_explained_fa_audio_file_name);
  return getWordSenseConceptAudioFileInfo(filename);
}

export async function deleteWordSenseConceptAudio(wordId: number) {
  const row = await findWordSenseConceptAudioRecord(wordId);
  if (!row) throw new Error(`WordSense ${wordId} was not found`);
  await updateWordSense({
    where: { id: wordId },
    data: {
      concept_explained_fa_audio_file_name: null,
      concept_explained_fa_audio_source_text: null,
    },
  });
  const safe = safeOwnedFilename(row.concept_explained_fa_audio_file_name);
  const info = getWordSenseConceptAudioFileInfo(safe);
  if (safe) await rm(getWordSenseConceptAudioAbsolutePath(safe), { force: true });
  return { deleted: safe ? 1 : 0, failed: 0, deletedBytes: info.size };
}
