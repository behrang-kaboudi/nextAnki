export const ENGLISH_WORD_AUDIO_PUBLIC_DIR_RELATIVE = "audio/english-words";
export const ENGLISH_WORD_AUDIO_PUBLIC_URL_PREFIX = "/audio/english-words";

export function buildEnglishWordAudioFilename({ englishWordId, timestampMs = Date.now() }: { englishWordId: number; timestampMs?: number }): string {
  const id = Math.trunc(englishWordId);
  if (!Number.isFinite(id) || id <= 0) throw new Error("englishWordId must be a positive integer");
  return `ew__${id}__base_form__${Math.trunc(timestampMs)}.mp3`;
}

export function buildEnglishWordAudioFilenameTemplate(englishWordId: number): string {
  return `ew__${Math.trunc(englishWordId)}__base_form__Date.now().mp3`;
}

export function getEnglishWordAudioPublicPath(filename: string): string {
  return `${ENGLISH_WORD_AUDIO_PUBLIC_URL_PREFIX}/${encodeURIComponent(filename)}`;
}
