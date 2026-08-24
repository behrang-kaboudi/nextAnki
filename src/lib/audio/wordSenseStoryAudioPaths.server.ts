import "server-only";

import path from "node:path";

import { WORD_SENSE_STORY_AUDIO_PUBLIC_DIR_RELATIVE } from "./wordSenseStoryAudioNaming";

export function getWordSenseStoryAudioAbsoluteDir() {
  return path.join(process.cwd(), "public", WORD_SENSE_STORY_AUDIO_PUBLIC_DIR_RELATIVE);
}

export function getWordSenseStoryAudioAbsolutePath(filename: string) {
  return path.join(getWordSenseStoryAudioAbsoluteDir(), filename);
}
