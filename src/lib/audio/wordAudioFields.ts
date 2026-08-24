export const WORD_AUDIO_FIELDS = [
  "base_form",
  "concept_explained_fa",
  "sentence_en",
  "sentence_en_meaning_fa",
] as const;

export type WordAudioFieldKey = (typeof WORD_AUDIO_FIELDS)[number];

export const WORD_AUDIO_BATCH_FIELDS = [
  "base_form",
  "canonical_text",
  "concept_explained_fa",
  "sentence_en",
  "sentence_en_meaning_fa",
  "story_text",
] as const;

export type WordAudioBatchFieldKey = (typeof WORD_AUDIO_BATCH_FIELDS)[number];

export function isWordAudioField(value: unknown): value is WordAudioFieldKey {
  return typeof value === "string" && WORD_AUDIO_FIELDS.includes(value as WordAudioFieldKey);
}
