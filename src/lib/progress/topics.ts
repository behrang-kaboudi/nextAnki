export const JOB_PROGRESS_TOPICS = {
  ankiJsonHint: "anki.sync.json-hint",
  ankiMedia: "anki.sync.media",
  ankiFull: "anki.sync.full",
  ankiLinkIdDedup: "anki.sync.anki-link-id-dedup",
  ankiOtherMeaningsFa: "anki.sync.other-meanings-fa",
  ankiConceptExplainedFa: "anki.sync.concept-explained-fa",
  ankiMeaningFa: "anki.sync.meaning-fa",
  ankiSentenceEn: "anki.sync.sentence-en",
  ankiSentenceEnMeaningFa: "anki.sync.sentence-en-meaning-fa",
  sentenceDeck: "anki.sync.sentence-deck",
  persianWordAudio: "words.persian-word-audio",
  englishWordAudio: "words.english-word-audio",
  englishWordJsonHint: "words.english-word-json-hint",
} as const;

export function wordFieldVoiceProgressTopic(field: string) {
  return `words.field-voice.${field}`;
}
