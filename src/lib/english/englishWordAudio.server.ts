import "server-only";

import { rm } from "node:fs/promises";
import path from "node:path";

import { buildEnglishWordAudioFilename } from "@/lib/audio/englishWordAudioNaming";
import { getEnglishWordAudioAbsolutePath } from "@/lib/audio/englishWordAudioPaths.server";
import { prisma } from "@/lib/prisma";
import { generateSpeechFromMixedText } from "@/lib/tts/cloudTts";

export async function generateEnglishWordAudio(englishWordId: number) {
  const row = await prisma.englishWord.findUnique({
    where: { id: englishWordId },
    select: { id: true, base_form: true, audio_file_name: true },
  });
  if (!row) throw new Error(`EnglishWord ${englishWordId} was not found`);

  const filename = buildEnglishWordAudioFilename({ englishWordId: row.id });
  await generateSpeechFromMixedText(row.base_form, path.join("english-words", filename), "azure");
  await prisma.englishWord.update({ where: { id: row.id }, data: { audio_file_name: filename } });

  if (row.audio_file_name && row.audio_file_name !== filename && path.basename(row.audio_file_name) === row.audio_file_name) {
    await rm(getEnglishWordAudioAbsolutePath(row.audio_file_name), { force: true });
  }
  return { filename };
}
