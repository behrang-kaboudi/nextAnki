import "server-only";

import path from "node:path";

import { SENTENCE_AUDIO_PUBLIC_DIR_RELATIVE } from "@/lib/audio/sentenceAudioNaming";

export function getSentenceAudioAbsoluteDir(): string {
  return path.join(process.cwd(), "public", SENTENCE_AUDIO_PUBLIC_DIR_RELATIVE);
}

export function getSentenceAudioAbsolutePath(filename: string): string {
  return path.join(getSentenceAudioAbsoluteDir(), filename);
}
