export const WordAnkiConstants = {
  noteTypes: {
    META_LEX_VR9: "Meta-LEX-vR9",
  },
  noteFields: {
    META_LEX_VR9: [
      "anki_link_id",
      "base_form",
      "phonetic_us",
      "pos",
      "meaning_fa",
      "concept_explained_fa",
      "sentence_en",
      "sentence_en_meaning_fa",
      "best_translate",
      "mixed_sentence",
      "first_letter_fa_hint",
      "first_letter_en_hint",
      "hint_to_select_letters",
      "hint_sentence",
      "phonetic_us_normalized",
      "learning_depth",
    ],
  },
  noteTemplates: {
    META_LEX_VR9: {
      EnToFa: {
        Front: `<div style='display:none'>[sound:rec1765049893.mp3]</div>{{base_form}}{{phonetic_us}}
<div style='display:none'>[sound:rec1768097855.mp3]</div>
<br>
{{sentence_en}}
<div style='display:none'>[sound:6s_Stop.mp3]</div>`,
        Back: `<div style='display:none'>[sound:rec1765049893.mp3]</div>
<div style='font-family: "Arial"; font-size: 20px;'>{{phonetic_us}}</div>
<hr id='answer'>
<div style='display:none'>[sound:rec1765049893.mp3]</div>

<div style=";text-align:right">
{{meaning_fa}}
<div style='display:none'>[sound:rec1765049893.mp3]</div>{{sentence_en_meaning_fa}}<div style='font-family: "Arial"; font-size: 20px;direction:rtl'></div>
<div style='font-family: "Arial"; font-size: 20px;'>{{best_translate}}</div>
<hr>
<div style='display:none'>[sound:rec1765049893.mp3]</div>
<div style='font-family: "Arial"; font-size: 20px;'>
<div style='display:none'>[sound:rec1765049893.mp3]</div>
  </div>
</div>

<div style='font-family: "Arial"; font-size: 20px;'>{{hint_sentence}}</div>`,
      },
      FaToEn: {
        Front: `<div style=";text-align:right">
<div style='display:none'>[sound:rec1765049893.mp3]</div>

<div style='font-family: "Arial"; font-size: 20px;'>{{meaning_fa}}</div>

<div style='display:none'>[sound:rec1765487198.mp3]</div>

<div style='font-family: "Arial"; font-size: 20px;'>{{concept_explained_fa}}</div>
</div>

<div style='font-family: "Arial"; font-size: 20px;'>{{mixed_sentence}}</div>
<div style='display:none'>[sound:6s_Stop.mp3]</div>
<div style=";text-align:right">
<div style='font-family: "Arial"; font-size: 20px;'>{{hint_to_select_letters}}</div>
<div style='display:none'>[sound:6s_Stop.mp3]</div>
<div style='font-family: "Arial"; font-size: 20px;'>{{first_letter_en_hint}}</div>
</div>`,
        Back: `{{base_form}}{{phonetic_us}}
<br>
{{sentence_en}}
<hr>
<div style=";text-align:right">
<div style='display:none'>[sound:rec1765049893.mp3]</div>
<div style='font-family: "Arial"; font-size: 20px;'>{{first_letter_fa_hint}}</div>
<div style='display:none'>[sound:rec1765049893.mp3]</div>
<div style='font-family: "Arial"; font-size: 20px;'>{{first_letter_en_hint}}</div>
</div>`,
      },
      Emla: {
        Front: `<div style=";text-align:right">
<div style='display:none'>[sound:rec1765049893.mp3]</div>

<div style='font-family: "Arial"; font-size: 20px;'>{{meaning_fa}}</div>

<div style='display:none'>[sound:rec1765487198.mp3]</div>

<div style='font-family: "Arial"; font-size: 20px;'>{{concept_explained_fa}}</div>
</div>
<hr>
{{base_form}}{{phonetic_us}}

<div style=";text-align:right">
<div style='font-family: "Arial"; font-size: 20px;'>{{first_letter_fa_hint}}</div>
<div style='font-family: "Arial"; font-size: 20px;'>{{first_letter_en_hint}}</div>
</div>`,
        Back: `{{base_form}}{{phonetic_us}}
<br>
{{sentence_en}}
<hr>
<div style=";text-align:right">
<div style='display:none'>[sound:rec1765049893.mp3]</div>
<div style='font-family: "Arial"; font-size: 20px;'>{{first_letter_fa_hint}}</div>
<div style='display:none'>[sound:rec1765049893.mp3]</div>
<div style='font-family: "Arial"; font-size: 20px;'>{{first_letter_en_hint}}</div>
</div>`,
      },
      Rahnama: {
        Front: `<div style='display:none'>[sound:rec1765049893.mp3]</div>{{base_form}}{{phonetic_us}}
<div style='display:none'>[sound:6s_Stop.mp3]</div>
<div style=";text-align:right">
{{meaning_fa}}
<div style='display:none'>[sound:rec1765049893.mp3]</div></div>`,
        Back: `<div style='display:none'>[sound:rec1765049893.mp3]</div>
  </div>
</div>

<div style='font-family: "Arial"; font-size: 20px;'>{{hint_sentence}}</div>`,
      },
    },
  },
  cardTypes: {
    EnToFa: "EnToFa",
    FaToEn: "FaToEn",
    Emla: "Emla",
    Rahnama: "Rahnama",
  },
  decks: {
    tempRoot: "TempFor1WordsForNewStudy",
    root: "WordsForNewStudy",
    EnToFa: "WordsForNewStudy::EnToFa",
    FaToEn: "WordsForNewStudy::FaToEn",
    Emla: "WordsForNewStudy::Emla",
    Rahnama: "WordsForNewStudy::Rahnama",
  },
} as const;

export const WordDeckConfigs = {
  WordsForNewStudyEnToFa: {
    newCardsPerDay: 2000,
    maximumReviewsPerDay: 9999,
    learningSteps: "5d 10m 30m",
    RelearningSteps: "5d 10m 30m",
    StartingEase: "3.50",
    EasyBonus: "1.8",
  },
  WordsForNewStudyFaToEn: {
    newCardsPerDay: 2000,
    maximumReviewsPerDay: 9999,
    learningSteps: "5d 10m 30m 50m",
    StartingEase: "3.50",
  },
  WordsForNewStudyEmla: {
    newCardsPerDay: 2000,
    maximumReviewsPerDay: 9999,
    learningSteps: "10m 50m",
    StartingEase: "3.50",
  },
  WordsForNewStudyRahnama: {
    newCardsPerDay: 2000,
    maximumReviewsPerDay: 9999,
    learningSteps: "1m 5m 10m 5d",
    graduatingInterval: "5",
    easyInterval: "6",
  },
} as const;

export type WordDeckConfigName = keyof typeof WordDeckConfigs;

export type WordDeckConfig = (typeof WordDeckConfigs)[WordDeckConfigName];

export type WordNoteType =
  (typeof WordAnkiConstants.noteTypes)[keyof typeof WordAnkiConstants.noteTypes];

export type WordNoteFieldName =
  (typeof WordAnkiConstants.noteFields)[keyof typeof WordAnkiConstants.noteFields][number];

export type WordMetaLexVr9TemplateName =
  keyof (typeof WordAnkiConstants.noteTemplates)["META_LEX_VR9"];

export type WordCardType =
  (typeof WordAnkiConstants.cardTypes)[keyof typeof WordAnkiConstants.cardTypes];

export type WordDeckName =
  (typeof WordAnkiConstants.decks)[keyof typeof WordAnkiConstants.decks];

export const WordDeckByCardType = {
  EnToFa: WordAnkiConstants.decks.EnToFa,
  FaToEn: WordAnkiConstants.decks.FaToEn,
  Emla: WordAnkiConstants.decks.Emla,
  Rahnama: WordAnkiConstants.decks.Rahnama,
} as const satisfies Record<WordCardType, WordDeckName>;
