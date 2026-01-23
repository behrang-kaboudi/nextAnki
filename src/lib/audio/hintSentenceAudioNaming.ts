export type HintSentenceAudioFilenameOptions = {
  id: number;
  timestampMs?: number;
  ext?: "mp3";
};

// Note: keep this in sync with server-side voice generation logic.
export function buildHintSentenceAudioFilename({
  id,
  timestampMs = Date.now(),
  ext = "mp3",
}: HintSentenceAudioFilenameOptions): string {
  const ts = Number.isFinite(timestampMs) ? Math.trunc(timestampMs) : Date.now();
  return `${id}_hint_${ts}.${ext}`;
}
