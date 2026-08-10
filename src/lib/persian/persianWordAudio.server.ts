import "server-only";

import { statSync } from "node:fs";
import { copyFile, mkdir, rm } from "node:fs/promises";
import path from "node:path";

import { buildPersianWordCanonicalTextAudioFilename } from "@/lib/audio/persianWordAudioNaming";
import {
  getPersianWordAudioAbsoluteDir,
  getPersianWordAudioAbsolutePath,
} from "@/lib/audio/persianWordAudioPaths.server";
import { prisma } from "@/lib/prisma";
import { generateSpeechFromMixedText } from "@/lib/tts/cloudTts";
import { touchWordsReferencingPersianWord } from "@/lib/words/persianMeanings.server";

export function getPersianWordAudioFileInfo(filename: string | null) {
  const safe = filename && path.basename(filename) === filename ? filename : null;
  if (!safe) return { filename: null, absPath: null, size: 0 };
  const absPath = getPersianWordAudioAbsolutePath(safe);
  try {
    return { filename: safe, absPath, size: statSync(absPath).size };
  } catch {
    return { filename: safe, absPath, size: 0 };
  }
}

export function findPersianWordAudioRecord(persianWordId: number) {
  return prisma.persianWord.findUnique({
    where: { id: persianWordId },
    select: {
      id: true,
      canonical_text: true,
      audio_file_name: true,
      audio_source_text: true,
    },
  });
}

async function replacePersianWordAudio(
  persianWordId: number,
  filename: string,
  sourceText: string,
  previous: string | null,
) {
  await prisma.persianWord.update({
    where: { id: persianWordId },
    data: { audio_file_name: filename, audio_source_text: sourceText },
  });
  await touchWordsReferencingPersianWord(persianWordId);
  if (previous && previous !== filename && path.basename(previous) === previous) {
    await rm(getPersianWordAudioAbsolutePath(previous), { force: true });
  }
}

/**
 * Generates canonical-text speech using the PersianWord audio namespace and
 * makes `audio_file_name` point to the newly generated media file.
 */
export async function generatePersianWordCanonicalTextAudio(persianWordId: number) {
  const row = await findPersianWordAudioRecord(persianWordId);
  if (!row) throw new Error(`PersianWord ${persianWordId} was not found`);
  const sourceText = row.canonical_text.trim();
  if (!sourceText) throw new Error(`PersianWord ${persianWordId} has no canonical_text`);

  const filename = buildPersianWordCanonicalTextAudioFilename({ persianWordId: row.id });
  await generateSpeechFromMixedText(sourceText, path.join("persian-words", filename), "azure");

  await replacePersianWordAudio(row.id, filename, sourceText, row.audio_file_name);

  return { filename, absPath: getPersianWordAudioAbsolutePath(filename) };
}

export async function savePersianWordAudioMp3(persianWordId: number, sourcePath: string) {
  const row = await findPersianWordAudioRecord(persianWordId);
  if (!row) throw new Error(`PersianWord ${persianWordId} was not found`);
  const sourceText = row.canonical_text.trim();
  if (!sourceText) throw new Error(`PersianWord ${persianWordId} has no canonical_text`);
  const filename = buildPersianWordCanonicalTextAudioFilename({ persianWordId });
  await mkdir(getPersianWordAudioAbsoluteDir(), { recursive: true });
  await copyFile(sourcePath, getPersianWordAudioAbsolutePath(filename));
  await replacePersianWordAudio(persianWordId, filename, sourceText, row.audio_file_name);
  return getPersianWordAudioFileInfo(filename);
}

export async function deletePersianWordAudio(persianWordId: number) {
  const row = await findPersianWordAudioRecord(persianWordId);
  if (!row) throw new Error(`PersianWord ${persianWordId} was not found`);
  await prisma.persianWord.update({
    where: { id: persianWordId },
    data: { audio_file_name: null, audio_source_text: null },
  });
  await touchWordsReferencingPersianWord(persianWordId);
  const info = getPersianWordAudioFileInfo(row.audio_file_name);
  if (row.audio_file_name && path.basename(row.audio_file_name) === row.audio_file_name) {
    await rm(getPersianWordAudioAbsolutePath(row.audio_file_name), { force: true });
  }
  return { deleted: row.audio_file_name ? 1 : 0, failed: 0, deletedBytes: info.size };
}
