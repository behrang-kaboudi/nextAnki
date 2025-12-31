export const WordAnkiConstants = {
  noteTypes: {
    META_LEX_VR9: "Meta-LEX-vR9",
  },
  cardTypes: {
    EnToFa: "EnToFa",
    FaToEn: "FaToEn",
    Emla: "Emla",
  },
  decks: {
    root: "TempFor1WordsForNewStudy",
    EnToFa: "TempFor1WordsForNewStudy::EnToFa",
    FaToEn: "TempFor1WordsForNewStudy::FaToEn",
    Emla: "TempFor1WordsForNewStudy::Emla",
  },
} as const;

export type WordNoteType =
  (typeof WordAnkiConstants.noteTypes)[keyof typeof WordAnkiConstants.noteTypes];

export type WordCardType =
  (typeof WordAnkiConstants.cardTypes)[keyof typeof WordAnkiConstants.cardTypes];

export type WordDeckName =
  (typeof WordAnkiConstants.decks)[keyof typeof WordAnkiConstants.decks];

export const WordDeckByCardType = {
  EnToFa: WordAnkiConstants.decks.EnToFa,
  FaToEn: WordAnkiConstants.decks.FaToEn,
  Emla: WordAnkiConstants.decks.Emla,
} as const satisfies Record<WordCardType, WordDeckName>;

