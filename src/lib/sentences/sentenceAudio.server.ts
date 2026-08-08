import "server-only";

import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";

import {
  buildSentenceAudioFilename,
  type SentenceAudioField,
} from "@/lib/audio/sentenceAudioNaming";
import {
  getSentenceAudioAbsoluteDir,
  getSentenceAudioAbsolutePath,
} from "@/lib/audio/sentenceAudioPaths.server";
import { prisma } from "@/lib/prisma";
import { generateSpeechFromMixedText } from "@/lib/tts/cloudTts";
import { touchWordsLinkedToSentenceId } from "@/lib/words/wordRepo";

const select = {
  id: true,
  sentence_en: true,
  sentence_en_meaning_fa: true,
  sentence_en_audio_file_name: true,
  sentence_en_meaning_fa_audio_file_name: true,
} as const;

function textFor(row: Awaited<ReturnType<typeof findSentenceAudioRecord>>, field: SentenceAudioField) {
  if (!row) return null;
  return field === "sentence_en" ? row.sentence_en : row.sentence_en_meaning_fa;
}

export function filenameFor(
  row: NonNullable<Awaited<ReturnType<typeof findSentenceAudioRecord>>>,
  field: SentenceAudioField,
): string | null {
  return field === "sentence_en"
    ? row.sentence_en_audio_file_name
    : row.sentence_en_meaning_fa_audio_file_name;
}

function filenameData(field: SentenceAudioField, filename: string | null) {
  return field === "sentence_en"
    ? { sentence_en_audio_file_name: filename }
    : { sentence_en_meaning_fa_audio_file_name: filename };
}

function isSafeOwnedFilename(filename: string): boolean {
  return Boolean(filename) && path.basename(filename) === filename;
}

export async function findSentenceAudioRecord(sentenceId: number) {
  return prisma.sentence.findUnique({ where: { id: sentenceId }, select });
}

export function getSentenceAudioFileInfo(filename: string | null): { filename: string | null; absPath: string | null; size: number } {
  if (!filename || !isSafeOwnedFilename(filename)) return { filename: null, absPath: null, size: 0 };
  const absPath = getSentenceAudioAbsolutePath(filename);
  try {
    const stat = fs.statSync(absPath);
    return { filename, absPath, size: stat.isFile() ? stat.size : 0 };
  } catch {
    return { filename, absPath, size: 0 };
  }
}

async function replaceFilename(sentenceId: number, field: SentenceAudioField, previous: string | null, filename: string) {
  await prisma.sentence.update({ where: { id: sentenceId }, data: filenameData(field, filename) });
  await touchWordsLinkedToSentenceId(sentenceId);
  if (previous && previous !== filename && isSafeOwnedFilename(previous)) {
    await fsp.rm(getSentenceAudioAbsolutePath(previous), { force: true });
  }
}

export async function generateSentenceAudio(sentenceId: number, field: SentenceAudioField, textOverride?: string) {
  const row = await findSentenceAudioRecord(sentenceId);
  if (!row) throw new Error(`Sentence ${sentenceId} was not found`);
  const text = (textOverride ?? textFor(row, field))?.trim();
  if (!text) throw new Error(`Sentence ${sentenceId} has no ${field}`);

  const previous = filenameFor(row, field);
  const filename = buildSentenceAudioFilename({ sentenceId, field });
  await generateSpeechFromMixedText(text, path.join("sentences", filename), "azure");
  await replaceFilename(sentenceId, field, previous, filename);
  const info = getSentenceAudioFileInfo(filename);
  return { filename, absPath: info.absPath, size: info.size };
}

export async function saveSentenceAudioMp3(sentenceId: number, field: SentenceAudioField, sourcePath: string) {
  const row = await findSentenceAudioRecord(sentenceId);
  if (!row) throw new Error(`Sentence ${sentenceId} was not found`);
  const filename = buildSentenceAudioFilename({ sentenceId, field });
  await fsp.mkdir(getSentenceAudioAbsoluteDir(), { recursive: true });
  await fsp.copyFile(sourcePath, getSentenceAudioAbsolutePath(filename));
  await replaceFilename(sentenceId, field, filenameFor(row, field), filename);
  const info = getSentenceAudioFileInfo(filename);
  return { filename, absPath: info.absPath, size: info.size };
}

export async function deleteSentenceAudio(sentenceId: number, field: SentenceAudioField) {
  const row = await findSentenceAudioRecord(sentenceId);
  if (!row) throw new Error(`Sentence ${sentenceId} was not found`);
  const filename = filenameFor(row, field);
  await prisma.sentence.update({ where: { id: sentenceId }, data: filenameData(field, null) });
  await touchWordsLinkedToSentenceId(sentenceId);
  if (filename && isSafeOwnedFilename(filename)) {
    await fsp.rm(getSentenceAudioAbsolutePath(filename), { force: true });
  }
  return { deleted: filename ? 1 : 0, failed: 0 };
}
