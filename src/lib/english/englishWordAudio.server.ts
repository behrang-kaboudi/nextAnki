import "server-only";

import { statSync } from "node:fs";
import { copyFile, mkdir, rm } from "node:fs/promises";
import path from "node:path";

import { buildEnglishWordAudioFilename } from "@/lib/audio/englishWordAudioNaming";
import { getEnglishWordAudioAbsoluteDir, getEnglishWordAudioAbsolutePath } from "@/lib/audio/englishWordAudioPaths.server";
import { prisma } from "@/lib/prisma";
import { generateSpeechFromMixedText } from "@/lib/tts/cloudTts";
import { touchWordsByEnglishId } from "@/lib/words/wordRepo";

function safeOwnedFilename(filename: string | null): string | null {
  return filename && path.basename(filename) === filename ? filename : null;
}

export function getEnglishWordAudioFileInfo(filename: string | null) {
  const safe = safeOwnedFilename(filename);
  if (!safe) return { filename: null, absPath: null, size: 0 };
  const absPath = getEnglishWordAudioAbsolutePath(safe);
  try {
    return { filename: safe, absPath, size: statSync(absPath).size };
  } catch {
    return { filename: safe, absPath, size: 0 };
  }
}

export function findEnglishWordAudioRecord(englishWordId: number) {
  return prisma.englishWord.findUnique({
    where: { id: englishWordId },
    select: { id: true, base_form: true, audio_file_name: true, audio_source_text: true },
  });
}

async function replaceEnglishWordAudioFilename(
  englishWordId: number,
  filename: string,
  sourceText: string,
  previous: string | null,
) {
  await prisma.englishWord.update({
    where: { id: englishWordId },
    data: { audio_file_name: filename, audio_source_text: sourceText },
  });
  await touchWordsByEnglishId(englishWordId);
  const safePrevious = safeOwnedFilename(previous);
  if (safePrevious && safePrevious !== filename) {
    await rm(getEnglishWordAudioAbsolutePath(safePrevious), { force: true });
  }
}

export async function generateEnglishWordAudio(englishWordId: number, textOverride?: string) {
  const row = await findEnglishWordAudioRecord(englishWordId);
  if (!row) throw new Error(`EnglishWord ${englishWordId} was not found`);
  const text = String(textOverride ?? row.base_form).trim();
  if (!text) throw new Error(`EnglishWord ${englishWordId} has no base_form`);

  const filename = buildEnglishWordAudioFilename({ englishWordId: row.id });
  await generateSpeechFromMixedText(text, path.join("english-words", filename), "azure");
  await replaceEnglishWordAudioFilename(row.id, filename, text, row.audio_file_name);
  return getEnglishWordAudioFileInfo(filename);
}

export async function saveEnglishWordAudioMp3(englishWordId: number, sourcePath: string) {
  const row = await findEnglishWordAudioRecord(englishWordId);
  if (!row) throw new Error(`EnglishWord ${englishWordId} was not found`);
  const sourceText = row.base_form.trim();
  if (!sourceText) throw new Error(`EnglishWord ${englishWordId} has no base_form`);
  const filename = buildEnglishWordAudioFilename({ englishWordId });
  await mkdir(getEnglishWordAudioAbsoluteDir(), { recursive: true });
  await copyFile(sourcePath, getEnglishWordAudioAbsolutePath(filename));
  await replaceEnglishWordAudioFilename(englishWordId, filename, sourceText, row.audio_file_name);
  return getEnglishWordAudioFileInfo(filename);
}

export async function deleteEnglishWordAudio(englishWordId: number) {
  const row = await findEnglishWordAudioRecord(englishWordId);
  if (!row) throw new Error(`EnglishWord ${englishWordId} was not found`);
  await prisma.englishWord.update({
    where: { id: englishWordId },
    data: { audio_file_name: null, audio_source_text: null },
  });
  await touchWordsByEnglishId(englishWordId);
  const safe = safeOwnedFilename(row.audio_file_name);
  const info = getEnglishWordAudioFileInfo(safe);
  if (safe) await rm(getEnglishWordAudioAbsolutePath(safe), { force: true });
  return { deleted: safe ? 1 : 0, failed: 0, deletedBytes: info.size };
}
