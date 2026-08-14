export const WORD_SENSE_CONCEPT_AUDIO_FIELD = "concept_explained_fa" as const;
export const WORD_SENSE_CONCEPT_AUDIO_PUBLIC_DIR_RELATIVE = "audio/word-concepts";
export const WORD_SENSE_CONCEPT_AUDIO_PUBLIC_URL_PREFIX = "/audio/word-concepts";

export function buildWordSenseConceptAudioFilename({
  wordSenseId,
  timestampMs = Date.now(),
}: {
  wordSenseId: number;
  timestampMs?: number;
}): string {
  const id = Math.trunc(wordSenseId);
  if (!Number.isFinite(id) || id <= 0) throw new Error("wordSenseId must be a positive integer");
  const timestamp = Math.trunc(timestampMs);
  if (!Number.isFinite(timestamp) || timestamp <= 0) throw new Error("timestampMs must be a positive integer");
  return `w__${id}__${WORD_SENSE_CONCEPT_AUDIO_FIELD}__${timestamp}.mp3`;
}

export function buildWordSenseConceptAudioFilenameTemplate(wordSenseId: number): string {
  return `w__${Math.trunc(wordSenseId)}__${WORD_SENSE_CONCEPT_AUDIO_FIELD}__Date.now().mp3`;
}

export function getWordSenseConceptAudioPublicPath(filename: string): string {
  return `${WORD_SENSE_CONCEPT_AUDIO_PUBLIC_URL_PREFIX}/${encodeURIComponent(filename)}`;
}

export function isWordSenseConceptAudioField(field: string): field is typeof WORD_SENSE_CONCEPT_AUDIO_FIELD {
  return field === WORD_SENSE_CONCEPT_AUDIO_FIELD;
}
