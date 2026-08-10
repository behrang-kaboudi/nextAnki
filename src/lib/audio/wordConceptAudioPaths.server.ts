import "server-only";

import path from "node:path";

import { WORD_CONCEPT_AUDIO_PUBLIC_DIR_RELATIVE } from "./wordConceptAudioNaming";

export function getWordConceptAudioAbsoluteDir(): string {
  return path.join(process.cwd(), "public", WORD_CONCEPT_AUDIO_PUBLIC_DIR_RELATIVE);
}

export function getWordConceptAudioAbsolutePath(filename: string): string {
  return path.join(getWordConceptAudioAbsoluteDir(), filename);
}
