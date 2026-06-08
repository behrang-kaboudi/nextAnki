export const SentenceAnkiConstants = {
  noteFields: [
    "sentence_en",
    "sentence_en_sound",
    "sentence_en_meaning_fa",
    "sentence_en_meaning_fa_sound",
    "updatedAt",
  ],
  noteTemplates: {
    Sentence: {
      Front: `
<div>{{sentence_en}}</div>
<div>{{sentence_en_sound}}</div>
`.trim(),
      Back: `
{{FrontSide}}
<hr id=answer>
<div>{{sentence_en_meaning_fa}}</div>
<div>{{sentence_en_meaning_fa_sound}}</div>
<div>{{updatedAt}}</div>
`.trim(),
    },
  },
  cardTypes: {
    Sentence: "Sentence",
  },
  decks: {
    EnSentences: "enSenteses",
  },
} as const;
