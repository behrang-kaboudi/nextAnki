import "server-only";

import path from "node:path";

import { WORD_AUDIO_PUBLIC_DIR_RELATIVE } from "@/lib/audio/wordFieldAudioNaming";

export function getWordFieldAudioAbsoluteDir(): string {
  return path.join(process.cwd(), "public", WORD_AUDIO_PUBLIC_DIR_RELATIVE);
}

export function getWordFieldAudioAbsolutePath(filename: string): string {
  return path.join(getWordFieldAudioAbsoluteDir(), filename);
}

