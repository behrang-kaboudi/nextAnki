export const WordAnkiConstants = {
  cardTypes: {
    EnToFa: "EnToFa",
    EnToFaKnowingFilter: "1EnToFaKnowingFilter",
    EnToFaRev: "EnToFaRev",
    FaToEn: "FaToEn",
    FaToEnKnowingFilter: "1FaToEnKnowingFilter",
    FaToEnRev: "FaToEnRev",
    Rahnama: "Rahnama",
    Rahnama2: "Rahnama2",
  },
  decks: {
    default: "Default",
    tempRoot: "TempFor1WordsForNewStudy",
    root: "WordsForNewStudy",
    EnToFa: "WordsForNewStudy::EnToFa",
    EnToFaKnowingFilter: "WordsForNewStudy::1EnToFaKnowingFilter",
    EnToFaRev: "WordsForNewStudy::EnToFaRev",
    FaToEn: "WordsForNewStudy::FaToEn",
    FaToEnKnowingFilter: "WordsForNewStudy::1FaToEnKnowingFilter",
    FaToEnRev: "WordsForNewStudy::FaToEnRev",
    Rahnama: "WordsForNewStudy::Rahnama",
    Rahnama2: "WordsForNewStudy::Rahnama2",
  },
} as const;

export const requiredFields = [
  "word_en",
  "phonetic",
  "pos",
  "meaning_fa",
] as const;

export * from "./notes";

export const WordDeckConfigs = {
  WordsForNewStudyEnToFa: {
    newCardsPerDay: 2000,
    maximumReviewsPerDay: 9999,
    learningSteps: "5d 10m 30m",
    RelearningSteps: "5d 10m 30m",
    StartingEase: "3.50",
    EasyBonus: "1.8",
  },
  WordsForNewStudy1EnToFaKnowingFilter: {
    newCardsPerDay: 20,
    maximumReviewsPerDay: 200,
    learningSteps: "1m 10m",
    RelearningSteps: "10m",
    StartingEase: "2.50",
    EasyBonus: "1.3",
    graduatingInterval: "1",
    easyInterval: "4",
  },
  WordsForNewStudyEnToFaRev: {
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
  WordsForNewStudy1FaToEnKnowingFilter: {
    newCardsPerDay: 20,
    maximumReviewsPerDay: 200,
    learningSteps: "1m 10m",
    RelearningSteps: "10m",
    StartingEase: "2.50",
    EasyBonus: "1.3",
    graduatingInterval: "1",
    easyInterval: "4",
  },
  WordsForNewStudyFaToEnRev: {
    newCardsPerDay: 2000,
    maximumReviewsPerDay: 9999,
    learningSteps: "5d 10m 30m 50m",
    StartingEase: "3.50",
  },
  WordsForNewStudyRahnama: {
    newCardsPerDay: 2000,
    maximumReviewsPerDay: 9999,
    learningSteps: "1m 5m 10m 5d",
    graduatingInterval: "5",
    easyInterval: "6",
  },
  WordsForNewStudyRahnama2: {
    newCardsPerDay: 2000,
    maximumReviewsPerDay: 9999,
    learningSteps: "1m 5m 10m 5d",
    graduatingInterval: "5",
    easyInterval: "6",
  },
} as const;

export type WordDeckConfigName = keyof typeof WordDeckConfigs;

export type WordDeckConfig = (typeof WordDeckConfigs)[WordDeckConfigName];

export const WordDeckByCardType = {
  EnToFa: WordAnkiConstants.decks.EnToFa,
  "1EnToFaKnowingFilter": WordAnkiConstants.decks.EnToFaKnowingFilter,
  EnToFaRev: WordAnkiConstants.decks.EnToFaRev,
  FaToEn: WordAnkiConstants.decks.FaToEn,
  "1FaToEnKnowingFilter": WordAnkiConstants.decks.FaToEnKnowingFilter,
  FaToEnRev: WordAnkiConstants.decks.FaToEnRev,
  Rahnama: WordAnkiConstants.decks.Rahnama,
  Rahnama2: WordAnkiConstants.decks.Rahnama2,
} as const;
