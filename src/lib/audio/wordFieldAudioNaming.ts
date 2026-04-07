export type WordAudioFieldKey =
  | "base_form"
  | "meaning_fa"
  | "other_meanings_fa"
  | "concept_explained_fa"
  | "sentence_en"
  | "sentence_en_meaning_fa";

export const WORD_AUDIO_FIELDS = [
  "base_form",
  "meaning_fa",
  "other_meanings_fa",
  "concept_explained_fa",
  "sentence_en",
  "sentence_en_meaning_fa",
] as const satisfies readonly WordAudioFieldKey[];

export const WORD_AUDIO_PUBLIC_DIR_RELATIVE = "audio/words";
export const WORD_AUDIO_PUBLIC_URL_PREFIX = "/audio/words";

// Prefer a separator that's less likely to appear inside ids.
// We still support reading legacy "_" separated filenames.
export const WORD_AUDIO_FILENAME_SEPARATOR = "__";

export type WordFieldAudioFilenameOptions = {
  audioKey?: string;
  ankiLinkId?: string;
  field: WordAudioFieldKey;
  timestampMs?: number;
  ext?: "mp3";
};

function getAudioKeyValue({ audioKey, ankiLinkId }: { audioKey?: string; ankiLinkId?: string }): string {
  return String(audioKey ?? ankiLinkId ?? "").trim();
}

export function sanitizeWordAudioFilenamePart(value: string): string {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return "unknown";

  // Keep filesystem-safe ASCII; collapse everything else to "_".
  const cleaned = trimmed
    .replace(/[^\w.-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");

  return cleaned.length ? cleaned.slice(0, 120) : "unknown";
}

export function buildWordFieldAudioFilename({
  audioKey,
  ankiLinkId,
  field,
  timestampMs = Date.now(),
  ext = "mp3",
}: WordFieldAudioFilenameOptions): string {
  const ts = Number.isFinite(timestampMs) ? Math.trunc(timestampMs) : Date.now();
  const id = sanitizeWordAudioFilenamePart(getAudioKeyValue({ audioKey, ankiLinkId }));
  return `${id}${WORD_AUDIO_FILENAME_SEPARATOR}${field}${WORD_AUDIO_FILENAME_SEPARATOR}${ts}.${ext}`;
}

export function buildWordFieldAudioFilenameTemplate({
  audioKey,
  ankiLinkId,
  field,
  ext = "mp3",
}: Omit<WordFieldAudioFilenameOptions, "timestampMs">): string {
  const id = sanitizeWordAudioFilenamePart(getAudioKeyValue({ audioKey, ankiLinkId }));
  return `${id}${WORD_AUDIO_FILENAME_SEPARATOR}${field}${WORD_AUDIO_FILENAME_SEPARATOR}Date.now().${ext}`;
}

export function getWordFieldAudioPublicPath(filename: string): string {
  return `${WORD_AUDIO_PUBLIC_URL_PREFIX}/${encodeURIComponent(filename)}`;
}
