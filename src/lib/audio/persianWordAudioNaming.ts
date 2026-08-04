export const PERSIAN_WORD_AUDIO_FIELD = "canonical_text" as const;
export const PERSIAN_WORD_AUDIO_PUBLIC_DIR_RELATIVE = "audio/persian-words";
export const PERSIAN_WORD_AUDIO_PUBLIC_URL_PREFIX = "/audio/persian-words";
export const PERSIAN_WORD_AUDIO_FILENAME_SEPARATOR = "__";

export function buildPersianWordCanonicalTextAudioFilename({
  persianWordId,
  timestampMs = Date.now(),
}: {
  persianWordId: number;
  timestampMs?: number;
}): string {
  const id = Math.trunc(persianWordId);
  if (!Number.isFinite(id) || id <= 0) throw new Error("persianWordId must be a positive integer");

  const timestamp = Number.isFinite(timestampMs) ? Math.trunc(timestampMs) : Date.now();
  return `pw${PERSIAN_WORD_AUDIO_FILENAME_SEPARATOR}${id}${PERSIAN_WORD_AUDIO_FILENAME_SEPARATOR}${PERSIAN_WORD_AUDIO_FIELD}${PERSIAN_WORD_AUDIO_FILENAME_SEPARATOR}${timestamp}.mp3`;
}

export function getPersianWordAudioPublicPath(filename: string): string {
  return `${PERSIAN_WORD_AUDIO_PUBLIC_URL_PREFIX}/${encodeURIComponent(filename)}`;
}
