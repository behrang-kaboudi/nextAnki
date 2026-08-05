import "server-only";

import path from "node:path";

import { ENGLISH_WORD_AUDIO_PUBLIC_DIR_RELATIVE } from "./englishWordAudioNaming";

export function getEnglishWordAudioAbsoluteDir(): string {
  return path.join(process.cwd(), "public", ENGLISH_WORD_AUDIO_PUBLIC_DIR_RELATIVE);
}

export function getEnglishWordAudioAbsolutePath(filename: string): string {
  return path.join(getEnglishWordAudioAbsoluteDir(), filename);
}
