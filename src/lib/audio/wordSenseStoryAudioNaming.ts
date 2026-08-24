export const WORD_SENSE_STORY_AUDIO_FIELD = "story_text" as const;
export const WORD_SENSE_STORY_AUDIO_PUBLIC_DIR_RELATIVE = "audio/word-stories";
export const WORD_SENSE_STORY_AUDIO_PUBLIC_URL_PREFIX = "/audio/word-stories";

export function getWordSenseStoryAudioPublicPath(filename: string) {
  return `${WORD_SENSE_STORY_AUDIO_PUBLIC_URL_PREFIX}/${encodeURIComponent(filename)}`;
}

export function buildWordSenseStoryAudioFilename({ storyId, timestampMs = Date.now() }: { storyId: number; timestampMs?: number }) {
  const id = Math.trunc(storyId);
  if (!Number.isFinite(id) || id <= 0) throw new Error("storyId must be a positive integer");
  const timestamp = Math.trunc(timestampMs);
  if (!Number.isFinite(timestamp) || timestamp <= 0) throw new Error("timestampMs must be a positive integer");
  return `wss__${id}__${WORD_SENSE_STORY_AUDIO_FIELD}__${timestamp}.mp3`;
}

export function isWordSenseStoryAudioField(field: string): field is typeof WORD_SENSE_STORY_AUDIO_FIELD {
  return field === WORD_SENSE_STORY_AUDIO_FIELD;
}
