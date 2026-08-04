import "server-only";

import path from "node:path";

import { PERSIAN_WORD_AUDIO_PUBLIC_DIR_RELATIVE } from "@/lib/audio/persianWordAudioNaming";

export function getPersianWordAudioAbsoluteDir(): string {
  return path.join(process.cwd(), "public", PERSIAN_WORD_AUDIO_PUBLIC_DIR_RELATIVE);
}

export function getPersianWordAudioAbsolutePath(filename: string): string {
  return path.join(getPersianWordAudioAbsoluteDir(), filename);
}
