import "server-only";

import { rm } from "node:fs/promises";
import path from "node:path";

import { buildPersianWordCanonicalTextAudioFilename } from "@/lib/audio/persianWordAudioNaming";
import { getPersianWordAudioAbsolutePath } from "@/lib/audio/persianWordAudioPaths.server";
import { prisma } from "@/lib/prisma";
import { generateSpeechFromMixedText } from "@/lib/tts/cloudTts";

/**
 * Generates canonical-text speech using the PersianWord audio namespace and
 * makes `audio_file_name` point to the newly generated media file.
 */
export async function generatePersianWordCanonicalTextAudio(persianWordId: number) {
  const row = await prisma.persianWord.findUnique({
    where: { id: persianWordId },
    select: { id: true, canonical_text: true, audio_file_name: true },
  });
  if (!row) throw new Error(`PersianWord ${persianWordId} was not found`);
  if (!row.canonical_text.trim()) throw new Error(`PersianWord ${persianWordId} has no canonical_text`);

  const filename = buildPersianWordCanonicalTextAudioFilename({ persianWordId: row.id });
  await generateSpeechFromMixedText(row.canonical_text, path.join("persian-words", filename), "azure");

  await prisma.persianWord.update({
    where: { id: row.id },
    data: { audio_file_name: filename },
  });

  if (row.audio_file_name && row.audio_file_name !== filename && path.basename(row.audio_file_name) === row.audio_file_name) {
    await rm(getPersianWordAudioAbsolutePath(row.audio_file_name), { force: true });
  }

  return { filename, absPath: getPersianWordAudioAbsolutePath(filename) };
}
