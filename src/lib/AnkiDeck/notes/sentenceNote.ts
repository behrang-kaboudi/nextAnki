export const SentenceAnkiConstants = {
  noteFields: {
    EN_SENTENCES: [
      "sentence_en",
      "sentence_en_sound",
      "sentence_en_meaning_fa",
      "sentence_en_meaning_fa_sound",
      "updatedAt",
    ],
  },
  noteTemplates: {
    EN_SENTENCES: {
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
  },
  cardTypes: {
    Sentence: "Sentence",
  },
  decks: {
    EnSentences: "enSenteses",
  },
} as const;
