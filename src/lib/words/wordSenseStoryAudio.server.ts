import "server-only";

import { statSync } from "node:fs";
import { copyFile, mkdir, rm } from "node:fs/promises";
import path from "node:path";

import { buildWordSenseStoryAudioFilename } from "@/lib/audio/wordSenseStoryAudioNaming";
import { getWordSenseStoryAudioAbsoluteDir, getWordSenseStoryAudioAbsolutePath } from "@/lib/audio/wordSenseStoryAudioPaths.server";
import { prisma } from "@/lib/prisma";
import { generateSpeechFromMixedText } from "@/lib/tts/cloudTts";

function safeOwnedFilename(filename: string | null) {
  return filename && path.basename(filename) === filename ? filename : null;
}

export function getWordSenseStoryAudioFileInfo(filename: string | null) {
  const safe = safeOwnedFilename(filename);
  if (!safe) return { filename: null, absPath: null, size: 0 };
  const absPath = getWordSenseStoryAudioAbsolutePath(safe);
  try {
    return { filename: safe, absPath, size: statSync(absPath).size };
  } catch {
    return { filename: safe, absPath, size: 0 };
  }
}

export async function findWordSenseStoryAudioRecord(storyId: number) {
  return prisma.wordSenseStory.findUnique({
    where: { id: storyId },
    select: { id: true, storyText: true, audio_file_name: true, audio_source_text: true },
  });
}

export async function generateWordSenseStoryAudio(storyId: number) {
  const row = await findWordSenseStoryAudioRecord(storyId);
  if (!row) throw new Error(`WordSenseStory ${storyId} was not found`);
  const text = row.storyText.trim();
  if (!text) throw new Error(`WordSenseStory ${storyId} has no storyText`);
  const filename = buildWordSenseStoryAudioFilename({ storyId });
  await mkdir(getWordSenseStoryAudioAbsoluteDir(), { recursive: true });
  await generateSpeechFromMixedText(text, path.join("word-stories", filename), "azure");
  await prisma.wordSenseStory.update({
    where: { id: storyId },
    data: { audio_file_name: filename, audio_source_text: text },
  });
  const previous = safeOwnedFilename(row.audio_file_name);
  if (previous && previous !== filename) await rm(getWordSenseStoryAudioAbsolutePath(previous), { force: true });
  return getWordSenseStoryAudioFileInfo(filename);
}

export async function saveWordSenseStoryAudioMp3(storyId: number, sourceMp3Path: string) {
  const row = await findWordSenseStoryAudioRecord(storyId);
  if (!row) throw new Error(`WordSenseStory ${storyId} was not found`);
  const filename = buildWordSenseStoryAudioFilename({ storyId });
  await mkdir(getWordSenseStoryAudioAbsoluteDir(), { recursive: true });
  await copyFile(sourceMp3Path, getWordSenseStoryAudioAbsolutePath(filename));
  await prisma.wordSenseStory.update({
    where: { id: storyId },
    data: { audio_file_name: filename, audio_source_text: row.storyText.trim() },
  });
  const previous = safeOwnedFilename(row.audio_file_name);
  if (previous && previous !== filename) await rm(getWordSenseStoryAudioAbsolutePath(previous), { force: true });
  return getWordSenseStoryAudioFileInfo(filename);
}

export async function deleteWordSenseStoryAudio(storyId: number) {
  const row = await findWordSenseStoryAudioRecord(storyId);
  if (!row) throw new Error(`WordSenseStory ${storyId} was not found`);
  await prisma.wordSenseStory.update({
    where: { id: storyId },
    data: { audio_file_name: null, audio_source_text: null },
  });
  const safe = safeOwnedFilename(row.audio_file_name);
  const info = getWordSenseStoryAudioFileInfo(safe);
  if (safe) await rm(getWordSenseStoryAudioAbsolutePath(safe), { force: true });
  return { deleted: safe ? 1 : 0, failed: 0, deletedBytes: info.size };
}
