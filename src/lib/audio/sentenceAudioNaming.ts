export const SENTENCE_AUDIO_FIELDS = ["sentence_en", "sentence_en_meaning_fa"] as const;
export type SentenceAudioField = (typeof SENTENCE_AUDIO_FIELDS)[number];

export const SENTENCE_AUDIO_PUBLIC_DIR_RELATIVE = "audio/sentences";
export const SENTENCE_AUDIO_PUBLIC_URL_PREFIX = "/audio/sentences";
export const SENTENCE_AUDIO_FILENAME_SEPARATOR = "__";

export function isSentenceAudioField(value: unknown): value is SentenceAudioField {
  return typeof value === "string" && SENTENCE_AUDIO_FIELDS.includes(value as SentenceAudioField);
}

export function buildSentenceAudioFilename({
  sentenceId,
  field,
  timestampMs = Date.now(),
}: {
  sentenceId: number;
  field: SentenceAudioField;
  timestampMs?: number;
}): string {
  const id = Math.trunc(sentenceId);
  if (!Number.isFinite(id) || id <= 0) throw new Error("sentenceId must be a positive integer");
  const timestamp = Number.isFinite(timestampMs) ? Math.trunc(timestampMs) : Date.now();
  return `s${SENTENCE_AUDIO_FILENAME_SEPARATOR}${id}${SENTENCE_AUDIO_FILENAME_SEPARATOR}${field}${SENTENCE_AUDIO_FILENAME_SEPARATOR}${timestamp}.mp3`;
}

export function buildSentenceAudioFilenameTemplate(sentenceId: number, field: SentenceAudioField): string {
  return `s${SENTENCE_AUDIO_FILENAME_SEPARATOR}${Math.trunc(sentenceId)}${SENTENCE_AUDIO_FILENAME_SEPARATOR}${field}${SENTENCE_AUDIO_FILENAME_SEPARATOR}Date.now().mp3`;
}

export function getSentenceAudioPublicPath(filename: string): string {
  return `${SENTENCE_AUDIO_PUBLIC_URL_PREFIX}/${encodeURIComponent(filename)}`;
}
