import "server-only";

import path from "node:path";

import { WORD_SENSE_CONCEPT_AUDIO_PUBLIC_DIR_RELATIVE } from "./wordSenseConceptAudioNaming";

export function getWordSenseConceptAudioAbsoluteDir(): string {
  return path.join(process.cwd(), "public", WORD_SENSE_CONCEPT_AUDIO_PUBLIC_DIR_RELATIVE);
}

export function getWordSenseConceptAudioAbsolutePath(filename: string): string {
  return path.join(getWordSenseConceptAudioAbsoluteDir(), filename);
}
