"use client";

import { useRef, useState } from "react";

import { PageHeader } from "@/components/page-header";
import {
  ankiOperations,
  chunkArray,
  getLastRevlogByCardIds,
  type AnkiNotesInfo,
  WordAnkiConstants,
} from "@/lib/anki";

import AnkiWordSyncQuickActions from "./AnkiWordSyncQuickActions";

const BATCH_SIZE = 200;
const TEN_YEARS_IN_DAYS = 3650;
const ORANGE_FLAG = 2;
const REVIEW_CARD_TEMPLATE = "WordsForNewStudy-Review";
const REVIEW_DECK = "WordsForNewStudy::Review";
const PRONUNCIATION_CARD_TEMPLATE = "WordsForNewStudy-Pronunciation";
const PRONUNCIATION_DECK = "WordsForNewStudy::Pronunciation";
const REVIEW_PRONUNCIATION_CARD_TEMPLATE = "WordsForNewStudy-ReviewPronunciation";
const REVIEW_PRONUNCIATION_DECK = "WordsForNewStudy::ReviewPronunciation";
const FA_TO_EN_WITH_HELP_CARD_TEMPLATE = "WordsForNewStudy-FaToEnWithHelp";
const FA_TO_EN_WITH_HELP_DECK = "WordsForNewStudy::FaToEnWithHelp";
// This Anki profile uses flag 7 for Purple (flag 4 is Blue).
const PURPLE_FLAG = 7;

const SOURCE_CARDS = [
  {
    deck: WordAnkiConstants.decks.FaToEn,
    cardTemplate: WordAnkiConstants.cardTypes.FaToEn,
  },
  {
    deck: WordAnkiConstants.decks.EnToFa,
    cardTemplate: WordAnkiConstants.cardTypes.EnToFa,
  },
  {
    deck: FA_TO_EN_WITH_HELP_DECK,
    cardTemplate: FA_TO_EN_WITH_HELP_CARD_TEMPLATE,
  },
] as const;

type Candidate = {
  sourceDeck: string;
  sourceCardId: number;
  noteId: number;
  baseForm: string;
  meaningFa: string;
  interval: number;
  reviewCardId: number;
};

type ScanResult = {
  candidates: Candidate[];
  sourceCardsChecked: number;
  longIntervalCards: number;
  unknownCards: number;
};

type ReviewResetCandidate = {
  reviewCardId: number;
  reviewInterval: number;
  sourceDeck: string;
  sourceCardId: number;
  noteId: number;
  baseForm: string;
  meaningFa: string;
};

type ReviewResetScanResult = {
  orangeSourceCards: number;
  reviewCardsOverTenYears: number;
  matchingSourceCards: ReviewResetCandidate[];
};

type LastHardCardCandidate = {
  sourceDeck: string;
  sourceCardId: number;
  noteId: number;
  baseForm: string;
  meaningFa: string;
};

type LastHardCardScanResult = {
  candidates: LastHardCardCandidate[];
};

type PronunciationLastHardCardCandidate = {
  pronunciationCardId: number;
  noteId: number;
  baseForm: string;
  meaningFa: string;
};

type PronunciationLastHardCardScanResult = {
  cardsChecked: number;
  candidates: PronunciationLastHardCardCandidate[];
};

type PronunciationResetCandidate = {
  sourceCardId: number;
  pronunciationCardId: number;
  noteId: number;
  baseForm: string;
  meaningFa: string;
  sourceDeck: string;
};

type PronunciationResetScanResult = {
  sourceCardsChecked: number;
  purpleSourceCards: number;
  matchingPronunciationCards: PronunciationResetCandidate[];
};

type PronunciationSourceCandidate = {
  sourceCardId: number;
  reviewCardId: number;
  reviewInterval?: number;
  noteId: number;
  baseForm: string;
  meaningFa: string;
  sourceInterval?: number;
};

type PronunciationSourceScanResult = {
  sourceCardsChecked: number;
  matchingCards: PronunciationSourceCandidate[];
};

type BackgroundSyncStatus = {
  running: boolean;
  done: boolean;
  stoppedEarly: boolean;
  error: string | null;
  total: number;
  processed: number;
  created?: number;
  updated: number;
  failed: number;
  mediaUploaded: number;
};

type MasterStageStatus = "pending" | "running" | "completed" | "error";

type MasterStage = {
  label: string;
  status: MasterStageStatus;
  detail: string;
  processed: number;
  total: number;
};

const MASTER_STAGE_LABELS = [
  "Copy all media",
  "Delete Anki notes missing in DB",
  "Full database sync",
  "Run 4 steps",
  "Run 3 steps",
] as const;

function createMasterStages(): MasterStage[] {
  return MASTER_STAGE_LABELS.map((label) => ({
    label,
    status: "pending",
    detail: "Waiting to run",
    processed: 0,
    total: 0,
  }));
}

function wait(milliseconds: number) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

function escapeAnkiQueryValue(value: string) {
  return value.replaceAll('"', '\\"');
}

export default function CardTransferManagementClient() {
  const masterAnkiSnapshotIdRef = useRef<string | null>(null);
  const [running, setRunning] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [reviewResetCandidates, setReviewResetCandidates] = useState<ReviewResetCandidate[]>([]);
  const [reviewResetStatus, setReviewResetStatus] = useState<string | null>(null);
  const [reviewResetError, setReviewResetError] = useState<string | null>(null);
  const [lastHardCardCandidates, setLastHardCardCandidates] = useState<LastHardCardCandidate[]>([]);
  const [lastHardCardStatus, setLastHardCardStatus] = useState<string | null>(null);
  const [lastHardCardError, setLastHardCardError] = useState<string | null>(null);
  const [pronunciationLastHardCardCandidates, setPronunciationLastHardCardCandidates] = useState<PronunciationLastHardCardCandidate[]>([]);
  const [pronunciationLastHardCardStatus, setPronunciationLastHardCardStatus] = useState<string | null>(null);
  const [pronunciationLastHardCardError, setPronunciationLastHardCardError] = useState<string | null>(null);
  const [pronunciationResetCandidates, setPronunciationResetCandidates] = useState<PronunciationResetCandidate[]>([]);
  const [pronunciationResetStatus, setPronunciationResetStatus] = useState<string | null>(null);
  const [pronunciationResetError, setPronunciationResetError] = useState<string | null>(null);
  const [pronunciationSourceCandidates, setPronunciationSourceCandidates] = useState<PronunciationSourceCandidate[]>([]);
  const [pronunciationSourceStatus, setPronunciationSourceStatus] = useState<string | null>(null);
  const [pronunciationSourceError, setPronunciationSourceError] = useState<string | null>(null);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isPronunciationHelpOpen, setIsPronunciationHelpOpen] = useState(false);
  const [mainRunAllStatus, setMainRunAllStatus] = useState<string | null>(null);
  const [mainRunAllError, setMainRunAllError] = useState<string | null>(null);
  const [pronunciationRunAllStatus, setPronunciationRunAllStatus] = useState<string | null>(null);
  const [pronunciationRunAllError, setPronunciationRunAllError] = useState<string | null>(null);
  const [masterModalOpen, setMasterModalOpen] = useState(false);
  const [masterRunning, setMasterRunning] = useState(false);
  const [masterStages, setMasterStages] = useState<MasterStage[]>(createMasterStages);
  const [masterFailedIndex, setMasterFailedIndex] = useState<number | null>(null);

  async function scanCandidates(): Promise<ScanResult> {
    const allCandidates: Candidate[] = [];
    let sourceCardsChecked = 0;
    let longIntervalCards = 0;
    let unknownCards = 0;

    for (const source of SOURCE_CARDS) {
      const cardsResponse = await ankiOperations.findCards({
        query: `deck:"${escapeAnkiQueryValue(source.deck)}" card:"${escapeAnkiQueryValue(source.cardTemplate)}" flag:0`,
      });
      if (!cardsResponse.ok) throw new Error(cardsResponse.error);

      const sourceCardIds = cardsResponse.result ?? [];
      sourceCardsChecked += sourceCardIds.length;
      const sourceCards: Array<{
        cardId: number;
        note: number;
        interval?: number;
      }> = [];

      for (const batch of chunkArray(sourceCardIds, BATCH_SIZE)) {
        const infoResponse = await ankiOperations.cardsInfo({ cards: batch });
        if (!infoResponse.ok) throw new Error(infoResponse.error);

        sourceCards.push(...(infoResponse.result ?? []));
      }

      if (!sourceCards.length) continue;

      const lastReviewsResponse = await getLastRevlogByCardIds(
        sourceCards.map((card) => card.cardId),
        BATCH_SIZE,
      );
      if (!lastReviewsResponse.ok) throw new Error(lastReviewsResponse.error);

      longIntervalCards += sourceCards.filter(
        (card) => Number(lastReviewsResponse.value.get(card.cardId)?.ivl) > TEN_YEARS_IN_DAYS,
      ).length;

      const unknownSourceCards = sourceCards.filter(
        (card) => {
          const lastReview = lastReviewsResponse.value.get(card.cardId);
          return lastReview?.ease === 1 && Number(lastReview.ivl) > TEN_YEARS_IN_DAYS;
        },
      );
      unknownCards += unknownSourceCards.length;
      if (!unknownSourceCards.length) continue;

      const noteIds = [...new Set(unknownSourceCards.map((card) => card.note))];
      const notesResponse = await ankiOperations.notesInfo({ notes: noteIds });
      if (!notesResponse.ok) throw new Error(notesResponse.error);

      const notesById = new Map(
        (notesResponse.result ?? []).map((note) => [note.noteId, note]),
      );
      const sourceCardsByNoteId = new Map<number, typeof unknownSourceCards>();
      for (const sourceCard of unknownSourceCards) {
        sourceCardsByNoteId.set(sourceCard.note, [
          ...(sourceCardsByNoteId.get(sourceCard.note) ?? []),
          sourceCard,
        ]);
      }

      for (const noteBatch of chunkArray(noteIds, BATCH_SIZE)) {
        const noteQuery = noteBatch.map((noteId) => `nid:${noteId}`).join(" OR ");
        const reviewCardsResponse = await ankiOperations.findCards({
          query: `deck:"${escapeAnkiQueryValue(REVIEW_DECK)}" card:"${escapeAnkiQueryValue(REVIEW_CARD_TEMPLATE)}" (${noteQuery})`,
        });
        if (!reviewCardsResponse.ok) throw new Error(reviewCardsResponse.error);

        const reviewCardIds = reviewCardsResponse.result ?? [];
        for (const cardBatch of chunkArray(reviewCardIds, BATCH_SIZE)) {
          const reviewInfoResponse = await ankiOperations.cardsInfo({ cards: cardBatch });
          if (!reviewInfoResponse.ok) throw new Error(reviewInfoResponse.error);

          for (const reviewCard of reviewInfoResponse.result ?? []) {
            const note = notesById.get(reviewCard.note);
            if (!note) continue;
            for (const sourceCard of sourceCardsByNoteId.get(reviewCard.note) ?? []) {
              allCandidates.push({
                sourceDeck: source.deck,
                sourceCardId: sourceCard.cardId,
                noteId: reviewCard.note,
                baseForm: note.fields.base_form?.value ?? "",
                meaningFa: note.fields.meaning_fa?.value ?? "",
                interval: Number(lastReviewsResponse.value.get(sourceCard.cardId)?.ivl ?? 0),
                reviewCardId: reviewCard.cardId,
              });
            }
          }
        }
      }
    }

    return {
      candidates: allCandidates,
      sourceCardsChecked,
      longIntervalCards,
      unknownCards,
    };
  }

  function formatScanStatus(result: ScanResult, resetCount?: number) {
    const resetText = resetCount == null ? "" : ` | Reset: ${resetCount}`;
    return `Cards checked: ${result.sourceCardsChecked} | Interval over 10 years: ${result.longIntervalCards} | Latest action Again: ${result.unknownCards} | Matching cards found: ${result.candidates.length}${resetText}`;
  }

  async function scanReviewResetCandidates(): Promise<ReviewResetScanResult> {
    const orangeSources: Array<{ cardId: number; note: number; sourceDeck: string }> = [];
    for (const source of SOURCE_CARDS) {
      const response = await ankiOperations.findCards({
        query: `deck:"${escapeAnkiQueryValue(source.deck)}" card:"${escapeAnkiQueryValue(source.cardTemplate)}" flag:${ORANGE_FLAG}`,
      });
      if (!response.ok) throw new Error(response.error);
      for (const batch of chunkArray(response.result ?? [], BATCH_SIZE)) {
        const infoResponse = await ankiOperations.cardsInfo({ cards: batch });
        if (!infoResponse.ok) throw new Error(infoResponse.error);
        orangeSources.push(...(infoResponse.result ?? []).map((card) => ({ cardId: card.cardId, note: card.note, sourceDeck: source.deck })));
      }
    }

    const noteIds = [...new Set(orangeSources.map((card) => card.note))];
    if (!noteIds.length) return { orangeSourceCards: 0, reviewCardsOverTenYears: 0, matchingSourceCards: [] };

    const notesResponse = await ankiOperations.notesInfo({ notes: noteIds });
    if (!notesResponse.ok) throw new Error(notesResponse.error);
    const notesById = new Map((notesResponse.result ?? []).map((note) => [note.noteId, note]));
    const sourcesByNoteId = new Map<number, typeof orangeSources>();
    for (const source of orangeSources) {
      sourcesByNoteId.set(source.note, [...(sourcesByNoteId.get(source.note) ?? []), source]);
    }

    const reviewCards: Array<{ cardId: number; note: number }> = [];
    for (const noteBatch of chunkArray(noteIds, BATCH_SIZE)) {
      const noteQuery = noteBatch.map((noteId) => `nid:${noteId}`).join(" OR ");
      const response = await ankiOperations.findCards({
        query: `deck:"${escapeAnkiQueryValue(REVIEW_DECK)}" card:"${escapeAnkiQueryValue(REVIEW_CARD_TEMPLATE)}" (${noteQuery})`,
      });
      if (!response.ok) throw new Error(response.error);
      for (const batch of chunkArray(response.result ?? [], BATCH_SIZE)) {
        const infoResponse = await ankiOperations.cardsInfo({ cards: batch });
        if (!infoResponse.ok) throw new Error(infoResponse.error);
        reviewCards.push(...(infoResponse.result ?? []));
      }
    }
    const lastReviews = await getLastRevlogByCardIds(reviewCards.map((card) => card.cardId), BATCH_SIZE);
    if (!lastReviews.ok) throw new Error(lastReviews.error);
    const eligibleReviewCards = reviewCards.filter((card) => Number(lastReviews.value.get(card.cardId)?.ivl) > TEN_YEARS_IN_DAYS);
    const matchingSourceCards = eligibleReviewCards.flatMap((reviewCard) =>
      (sourcesByNoteId.get(reviewCard.note) ?? []).flatMap((sourceCard) => {
        const note = notesById.get(sourceCard.note);
        return note ? [{
          reviewCardId: reviewCard.cardId,
          reviewInterval: Number(lastReviews.value.get(reviewCard.cardId)?.ivl ?? 0),
          sourceDeck: sourceCard.sourceDeck,
          sourceCardId: sourceCard.cardId,
          noteId: sourceCard.note,
          baseForm: note.fields.base_form?.value ?? "",
          meaningFa: note.fields.meaning_fa?.value ?? "",
        }] : [];
      }),
    );
    return { orangeSourceCards: orangeSources.length, reviewCardsOverTenYears: eligibleReviewCards.length, matchingSourceCards };
  }

  function formatReviewResetStatus(result: ReviewResetScanResult, resetCount?: number) {
    const resetText = resetCount == null ? "" : ` | Reset: ${resetCount}`;
    return `Source cards with the Orange flag: ${result.orangeSourceCards} | Review cards with an interval over 10 years: ${result.reviewCardsOverTenYears} | Eligible source cards: ${result.matchingSourceCards.length}${resetText}`;
  }

  async function scanLastHardCards(): Promise<LastHardCardScanResult> {
    const candidates: LastHardCardCandidate[] = [];

    for (const source of SOURCE_CARDS) {
      const response = await ankiOperations.findCards({
        query: `deck:"${escapeAnkiQueryValue(source.deck)}" card:"${escapeAnkiQueryValue(source.cardTemplate)}" -is:new`,
      });
      if (!response.ok) throw new Error(response.error);

      const cards: Array<{ cardId: number; note: number }> = [];
      for (const batch of chunkArray(response.result ?? [], BATCH_SIZE)) {
        const infoResponse = await ankiOperations.cardsInfo({ cards: batch });
        if (!infoResponse.ok) throw new Error(infoResponse.error);
        cards.push(...(infoResponse.result ?? []));
      }

      const lastAnswerButtonByCardId = new Map<number, number>();
      for (const batch of chunkArray(cards.map((card) => card.cardId), BATCH_SIZE)) {
        const reviewsResponse = await ankiOperations.getReviewsOfCards({ cards: batch });
        if (!reviewsResponse.ok) throw new Error(reviewsResponse.error);

        for (const cardId of batch) {
          let lastAnswerButton: { id: number; ease: number } | null = null;
          for (const review of reviewsResponse.result?.[String(cardId)] ?? []) {
            if (review.ease < 1 || review.ease > 4) continue;
            if (lastAnswerButton === null || review.id > lastAnswerButton.id) {
              lastAnswerButton = review;
            }
          }
          if (lastAnswerButton !== null) {
            lastAnswerButtonByCardId.set(cardId, lastAnswerButton.ease);
          }
        }
      }

      const eligibleCards = cards.filter(
        (card) => lastAnswerButtonByCardId.get(card.cardId) === 2,
      );
      const noteIds = [...new Set(eligibleCards.map((card) => card.note))];
      if (!noteIds.length) continue;
      const notesById = new Map<number, AnkiNotesInfo[number]>();
      for (const batch of chunkArray(noteIds, BATCH_SIZE)) {
        const notesResponse = await ankiOperations.notesInfo({ notes: batch });
        if (!notesResponse.ok) throw new Error(notesResponse.error);
        for (const note of notesResponse.result ?? []) notesById.set(note.noteId, note);
      }

      for (const card of eligibleCards) {
        const note = notesById.get(card.note);
        candidates.push({
          sourceDeck: source.deck,
          sourceCardId: card.cardId,
          noteId: card.note,
          baseForm: note?.fields.base_form?.value ?? "",
          meaningFa: note?.fields.meaning_fa?.value ?? "",
        });
      }
    }

    return { candidates };
  }

  function formatLastHardCardStatus(result: LastHardCardScanResult, resetCount?: number) {
    const resetText = resetCount == null ? "" : ` | Reset: ${resetCount}`;
    return `EnToFa, FaToEn, and FaToEnWithHelp cards whose latest answer was Hard (ease=2): ${result.candidates.length}${resetText}`;
  }

  async function scanPronunciationLastHardCards(): Promise<PronunciationLastHardCardScanResult> {
    const response = await ankiOperations.findCards({
      query: `deck:"${escapeAnkiQueryValue(PRONUNCIATION_DECK)}" card:"${escapeAnkiQueryValue(PRONUNCIATION_CARD_TEMPLATE)}" -is:new`,
    });
    if (!response.ok) throw new Error(response.error);

    const cards: Array<{ cardId: number; note: number }> = [];
    for (const batch of chunkArray(response.result ?? [], BATCH_SIZE)) {
      const infoResponse = await ankiOperations.cardsInfo({ cards: batch });
      if (!infoResponse.ok) throw new Error(infoResponse.error);
      for (const card of infoResponse.result ?? []) {
        if (card.deckName !== PRONUNCIATION_DECK) continue;
        cards.push({ cardId: card.cardId, note: card.note });
      }
    }

    const lastAnswerButtonByCardId = new Map<number, number>();
    for (const batch of chunkArray(cards.map((card) => card.cardId), BATCH_SIZE)) {
      const reviewsResponse = await ankiOperations.getReviewsOfCards({ cards: batch });
      if (!reviewsResponse.ok) throw new Error(reviewsResponse.error);

      for (const cardId of batch) {
        let lastAnswerButton: { id: number; ease: number } | null = null;
        for (const review of reviewsResponse.result?.[String(cardId)] ?? []) {
          if (review.ease < 1 || review.ease > 4) continue;
          if (lastAnswerButton === null || review.id > lastAnswerButton.id) {
            lastAnswerButton = review;
          }
        }
        if (lastAnswerButton !== null) {
          lastAnswerButtonByCardId.set(cardId, lastAnswerButton.ease);
        }
      }
    }

    const eligibleCards = cards.filter(
      (card) => lastAnswerButtonByCardId.get(card.cardId) === 2,
    );
    const noteIds = [...new Set(eligibleCards.map((card) => card.note))];
    const notesById = new Map<number, AnkiNotesInfo[number]>();
    for (const batch of chunkArray(noteIds, BATCH_SIZE)) {
      const notesResponse = await ankiOperations.notesInfo({ notes: batch });
      if (!notesResponse.ok) throw new Error(notesResponse.error);
      for (const note of notesResponse.result ?? []) notesById.set(note.noteId, note);
    }

    return {
      cardsChecked: cards.length,
      candidates: eligibleCards.map((card) => {
        const note = notesById.get(card.note);
        return {
          pronunciationCardId: card.cardId,
          noteId: card.note,
          baseForm: note?.fields.base_form?.value ?? "",
          meaningFa: note?.fields.meaning_fa?.value ?? "",
        };
      }),
    };
  }

  function formatPronunciationLastHardCardStatus(
    result: PronunciationLastHardCardScanResult,
    resetCount?: number,
  ) {
    const resetText = resetCount == null ? "" : ` | Reset: ${resetCount}`;
    return `Pronunciation cards checked: ${result.cardsChecked} | Latest answer Hard (ease=2): ${result.candidates.length}${resetText}`;
  }

  async function scanPronunciationSourceCandidates(
    mode: "orange" | "again",
  ): Promise<PronunciationSourceScanResult> {
    const sourceResponse = await ankiOperations.findCards({
      query: `deck:"${escapeAnkiQueryValue(PRONUNCIATION_DECK)}" card:"${escapeAnkiQueryValue(PRONUNCIATION_CARD_TEMPLATE)}" ${mode === "orange" ? `flag:${ORANGE_FLAG}` : "flag:0"}`,
    });
    if (!sourceResponse.ok) throw new Error(sourceResponse.error);

    const sourceCards: Array<{ cardId: number; note: number }> = [];
    for (const batch of chunkArray(sourceResponse.result ?? [], BATCH_SIZE)) {
      const infoResponse = await ankiOperations.cardsInfo({ cards: batch });
      if (!infoResponse.ok) throw new Error(infoResponse.error);
      sourceCards.push(...(infoResponse.result ?? []));
    }

    let eligibleSourceCards = sourceCards;
    const lastSourceIntervals = new Map<number, number>();
    if (mode === "again") {
      const reviewsResponse = await getLastRevlogByCardIds(
        sourceCards.map((card) => card.cardId),
        BATCH_SIZE,
      );
      if (!reviewsResponse.ok) throw new Error(reviewsResponse.error);
      for (const [cardId, review] of reviewsResponse.value) {
        lastSourceIntervals.set(cardId, Number(review?.ivl ?? 0));
      }
      eligibleSourceCards = sourceCards.filter((card) => {
        const lastReview = reviewsResponse.value.get(card.cardId);
        return lastReview?.ease === 1 && Number(lastReview.ivl) > TEN_YEARS_IN_DAYS;
      });
    }

    const noteIds = [...new Set(eligibleSourceCards.map((card) => card.note))];
    if (!noteIds.length) return { sourceCardsChecked: sourceCards.length, matchingCards: [] };
    const notesResponse = await ankiOperations.notesInfo({ notes: noteIds });
    if (!notesResponse.ok) throw new Error(notesResponse.error);
    const notesById = new Map((notesResponse.result ?? []).map((note) => [note.noteId, note]));
    const sourcesByNoteId = new Map<number, typeof eligibleSourceCards>();
    for (const sourceCard of eligibleSourceCards) {
      sourcesByNoteId.set(sourceCard.note, [
        ...(sourcesByNoteId.get(sourceCard.note) ?? []),
        sourceCard,
      ]);
    }

    const reviewCards: Array<{ cardId: number; note: number }> = [];
    for (const noteBatch of chunkArray(noteIds, BATCH_SIZE)) {
      const noteQuery = noteBatch.map((noteId) => `nid:${noteId}`).join(" OR ");
      const reviewResponse = await ankiOperations.findCards({
        query: `deck:"${escapeAnkiQueryValue(REVIEW_PRONUNCIATION_DECK)}" card:"${escapeAnkiQueryValue(REVIEW_PRONUNCIATION_CARD_TEMPLATE)}" (${noteQuery})`,
      });
      if (!reviewResponse.ok) throw new Error(reviewResponse.error);
      for (const batch of chunkArray(reviewResponse.result ?? [], BATCH_SIZE)) {
        const infoResponse = await ankiOperations.cardsInfo({ cards: batch });
        if (!infoResponse.ok) throw new Error(infoResponse.error);
        reviewCards.push(...(infoResponse.result ?? []));
      }
    }

    let eligibleReviewCards = reviewCards;
    const lastReviewIntervals = new Map<number, number>();
    if (mode === "orange") {
      const reviewsResponse = await getLastRevlogByCardIds(
        reviewCards.map((card) => card.cardId),
        BATCH_SIZE,
      );
      if (!reviewsResponse.ok) throw new Error(reviewsResponse.error);
      for (const [cardId, review] of reviewsResponse.value) {
        lastReviewIntervals.set(cardId, Number(review?.ivl ?? 0));
      }
      eligibleReviewCards = reviewCards.filter(
        (card) => Number(reviewsResponse.value.get(card.cardId)?.ivl) > TEN_YEARS_IN_DAYS,
      );
    }

    const matchingCards = eligibleReviewCards.flatMap((reviewCard) =>
      (sourcesByNoteId.get(reviewCard.note) ?? []).flatMap((sourceCard) => {
        const note = notesById.get(sourceCard.note);
        return note ? [{
          sourceCardId: sourceCard.cardId,
          reviewCardId: reviewCard.cardId,
          reviewInterval: mode === "orange" ? lastReviewIntervals.get(reviewCard.cardId) ?? 0 : undefined,
          sourceInterval: mode === "again" ? lastSourceIntervals.get(sourceCard.cardId) ?? 0 : undefined,
          noteId: sourceCard.note,
          baseForm: note.fields.base_form?.value ?? "",
          meaningFa: note.fields.meaning_fa?.value ?? "",
        }] : [];
      }),
    );
    return { sourceCardsChecked: sourceCards.length, matchingCards };
  }

  function formatPronunciationSourceStatus(
    result: PronunciationSourceScanResult,
    action: string,
    count?: number,
  ) {
    const actionText = count == null ? "" : ` | ${action}: ${count}`;
    return `Pronunciation cards checked: ${result.sourceCardsChecked} | Matching cards found: ${result.matchingCards.length}${actionText}`;
  }

  async function scanPronunciationResetCandidates(): Promise<PronunciationResetScanResult> {
    const purpleSourceCards: Array<{ cardId: number; note: number; sourceDeck: string }> = [];

    for (const source of SOURCE_CARDS) {
      const response = await ankiOperations.findCards({
        query: `deck:"${escapeAnkiQueryValue(source.deck)}" card:"${escapeAnkiQueryValue(source.cardTemplate)}" flag:${PURPLE_FLAG}`,
      });
      if (!response.ok) throw new Error(response.error);

      const cardIds = response.result ?? [];
      for (const batch of chunkArray(cardIds, BATCH_SIZE)) {
        const infoResponse = await ankiOperations.cardsInfo({ cards: batch });
        if (!infoResponse.ok) throw new Error(infoResponse.error);
        for (const card of infoResponse.result ?? []) {
          purpleSourceCards.push({ cardId: card.cardId, note: card.note, sourceDeck: source.deck });
        }
      }
    }

    const noteIds = [...new Set(purpleSourceCards.map((card) => card.note))];
    if (!noteIds.length) {
      return { sourceCardsChecked: 0, purpleSourceCards: 0, matchingPronunciationCards: [] };
    }

    const notesResponse = await ankiOperations.notesInfo({ notes: noteIds });
    if (!notesResponse.ok) throw new Error(notesResponse.error);
    const notesById = new Map((notesResponse.result ?? []).map((note) => [note.noteId, note]));
    const sourceCardsByNoteId = new Map<number, typeof purpleSourceCards>();
    for (const sourceCard of purpleSourceCards) {
      sourceCardsByNoteId.set(sourceCard.note, [
        ...(sourceCardsByNoteId.get(sourceCard.note) ?? []),
        sourceCard,
      ]);
    }
    const matchingPronunciationCards: PronunciationResetCandidate[] = [];

    for (const noteBatch of chunkArray(noteIds, BATCH_SIZE)) {
      const noteQuery = noteBatch.map((noteId) => `nid:${noteId}`).join(" OR ");
      const response = await ankiOperations.findCards({
        query: `deck:"${escapeAnkiQueryValue(PRONUNCIATION_DECK)}" card:"${escapeAnkiQueryValue(PRONUNCIATION_CARD_TEMPLATE)}" (${noteQuery})`,
      });
      if (!response.ok) throw new Error(response.error);

      for (const cardBatch of chunkArray(response.result ?? [], BATCH_SIZE)) {
        const infoResponse = await ankiOperations.cardsInfo({ cards: cardBatch });
        if (!infoResponse.ok) throw new Error(infoResponse.error);
        for (const card of infoResponse.result ?? []) {
          const note = notesById.get(card.note);
          if (!note) continue;
          for (const sourceCard of sourceCardsByNoteId.get(card.note) ?? []) {
            matchingPronunciationCards.push({
              sourceCardId: sourceCard.cardId,
              pronunciationCardId: card.cardId,
              noteId: card.note,
              baseForm: note.fields.base_form?.value ?? "",
              meaningFa: note.fields.meaning_fa?.value ?? "",
              sourceDeck: sourceCard.sourceDeck,
            });
          }
        }
      }
    }

    return {
      sourceCardsChecked: purpleSourceCards.length,
      purpleSourceCards: purpleSourceCards.length,
      matchingPronunciationCards,
    };
  }

  function formatPronunciationResetStatus(result: PronunciationResetScanResult, resetCount?: number) {
    const resetText = resetCount == null ? "" : ` | Reset: ${resetCount}`;
    return `Source cards with the Purple flag: ${result.purpleSourceCards} | Matching Pronunciation cards: ${result.matchingPronunciationCards.length}${resetText}`;
  }

  async function setCardFlags(cardIds: number[], flag: number) {
    for (const cardId of cardIds) {
      const response = await ankiOperations.setSpecificValueOfCard({
        card: cardId,
        keys: ["flags"],
        newValues: [flag],
        warning_check: true,
      });
      if (!response.ok) throw new Error(response.error);
    }
  }

  async function updateCardFlagsWithRollback(
    cardIds: number[],
    nextFlag: number,
    previousFlag: number,
  ) {
    const updatedCardIds: number[] = [];
    try {
      for (const cardId of cardIds) {
        const response = await ankiOperations.setSpecificValueOfCard({
          card: cardId,
          keys: ["flags"],
          newValues: [nextFlag],
          warning_check: true,
        });
        if (!response.ok) throw new Error(response.error);
        updatedCardIds.push(cardId);
      }
    } catch (error) {
      await setCardFlags(updatedCardIds, previousFlag);
      throw error;
    }
  }

  async function testPronunciationResetCandidates() {
    if (running || previewLoading) return;
    setPreviewLoading(true);
    setPronunciationResetError(null);
    setPronunciationResetStatus("Finding Pronunciation cards; no cards will be reset…");
    try {
      const result = await scanPronunciationResetCandidates();
      setPronunciationResetCandidates(result.matchingPronunciationCards);
      setPronunciationResetStatus(`Preview ready — ${formatPronunciationResetStatus(result)}`);
    } catch (caught) {
      setPronunciationResetCandidates([]);
      setPronunciationResetError(caught instanceof Error ? caught.message : "Could not connect to AnkiConnect.");
      setPronunciationResetStatus(null);
    } finally {
      setPreviewLoading(false);
    }
  }

  async function resetMatchingPronunciationCards() {
    if (running || previewLoading) return;
    setRunning(true);
    setPronunciationResetError(null);
    setPronunciationResetStatus("Finding cards, removing Purple flags, and recording Again for Pronunciation cards…");
    let currentStage = "recording Again on Pronunciation cards";
    try {
      const result = await scanPronunciationResetCandidates();
      setPronunciationResetCandidates(result.matchingPronunciationCards);
      const pronunciationCardIds = result.matchingPronunciationCards.map((candidate) => candidate.pronunciationCardId);
      const sourceCardIds = result.matchingPronunciationCards.map((candidate) => candidate.sourceCardId);
      for (const cardBatch of chunkArray([...new Set(pronunciationCardIds)], BATCH_SIZE)) {
        const answerResponse = await ankiOperations.answerCards({
          answers: cardBatch.map((cardId) => ({ cardId, ease: 1 })),
        });
        if (!answerResponse.ok) throw new Error(answerResponse.error);
      }
      currentStage = "removing the Purple flag from source cards";
      await updateCardFlagsWithRollback([...new Set(sourceCardIds)], 0, PURPLE_FLAG);
      setPronunciationResetStatus(
        `Done — ${formatPronunciationResetStatus(result)} | Again on Pronunciation: ${new Set(pronunciationCardIds).size} | Purple flags removed from source cards: ${new Set(sourceCardIds).size}`,
      );
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Could not connect to AnkiConnect.";
      setPronunciationResetError(`Error while ${currentStage}: ${message}`);
      setPronunciationResetStatus(null);
    } finally {
      setRunning(false);
    }
  }

  async function resetCardsToStudyQueue(cardIds: number[]) {
    // Never answer Again/Hard: this app's scheduling can send the card far into the future.
    // forgetCards alone makes the card New again, so Anki applies the deck's
    // initial learning steps from the beginning. Do not call setDueDate here:
    // AnkiConnect can turn a new card back into a review card with that action.
    for (const batch of chunkArray(cardIds, BATCH_SIZE)) {
      const forgetResponse = await ankiOperations.forgetCards({ cards: batch });
      if (!forgetResponse.ok) throw new Error(forgetResponse.error);
    }
  }

  async function testReviewResetCandidates() {
    if (running || previewLoading) return;
    setPreviewLoading(true);
    setReviewResetError(null);
    setReviewResetStatus("Finding matching cards; no cards will be reset…");
    try {
      const result = await scanReviewResetCandidates();
      setReviewResetCandidates(result.matchingSourceCards);
      setReviewResetStatus(`Preview ready — ${formatReviewResetStatus(result)}`);
    } catch (caught) {
      setReviewResetCandidates([]);
      setReviewResetError(caught instanceof Error ? caught.message : "Could not connect to AnkiConnect.");
      setReviewResetStatus(null);
    } finally {
      setPreviewLoading(false);
    }
  }

  async function resetMatchingSourceCards() {
    if (running || previewLoading) return;
    setRunning(true);
    setReviewResetError(null);
    setReviewResetStatus("Finding and resetting source cards, then removing their Orange flags…");
    let currentStage = "resetting source cards";
    try {
      const result = await scanReviewResetCandidates();
      setReviewResetCandidates(result.matchingSourceCards);
      const sourceCardIds = [...new Set(result.matchingSourceCards.map((candidate) => candidate.sourceCardId))];
      await resetCardsToStudyQueue(sourceCardIds);
      currentStage = "removing the Orange flag from source cards";
      await updateCardFlagsWithRollback(sourceCardIds, 0, ORANGE_FLAG);
      setReviewResetStatus(`Done — ${formatReviewResetStatus(result, sourceCardIds.length)}`);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Could not connect to AnkiConnect.";
      setReviewResetError(`Error while ${currentStage}: ${message}`);
      setReviewResetStatus(null);
    } finally {
      setRunning(false);
    }
  }

  async function testLastHardCards() {
    if (running || previewLoading) return;
    setPreviewLoading(true);
    setLastHardCardError(null);
    setLastHardCardStatus("Finding cards whose latest real answer was Hard; no cards will be reset…");
    try {
      const result = await scanLastHardCards();
      setLastHardCardCandidates(result.candidates);
      setLastHardCardStatus(`Preview ready — ${formatLastHardCardStatus(result)}`);
    } catch (caught) {
      setLastHardCardCandidates([]);
      setLastHardCardError(caught instanceof Error ? caught.message : "Could not connect to AnkiConnect.");
      setLastHardCardStatus(null);
    } finally {
      setPreviewLoading(false);
    }
  }

  async function resetLastHardCards() {
    if (running || previewLoading) return;
    setRunning(true);
    setLastHardCardError(null);
    setLastHardCardStatus("Finding and resetting cards whose latest real answer was Hard…");
    try {
      const result = await scanLastHardCards();
      setLastHardCardCandidates(result.candidates);
      const cardIds = [...new Set(result.candidates.map((candidate) => candidate.sourceCardId))];
      await resetCardsToStudyQueue(cardIds);
      setLastHardCardStatus(`Done — ${formatLastHardCardStatus(result, cardIds.length)}`);
    } catch (caught) {
      setLastHardCardError(caught instanceof Error ? caught.message : "Could not connect to AnkiConnect.");
      setLastHardCardStatus(null);
    } finally {
      setRunning(false);
    }
  }

  async function testPronunciationLastHardCards() {
    if (running || previewLoading) return;
    setPreviewLoading(true);
    setPronunciationLastHardCardError(null);
    setPronunciationLastHardCardStatus("Finding Pronunciation cards whose latest real answer was Hard; no cards will be reset…");
    try {
      const result = await scanPronunciationLastHardCards();
      setPronunciationLastHardCardCandidates(result.candidates);
      setPronunciationLastHardCardStatus(`Preview ready — ${formatPronunciationLastHardCardStatus(result)}`);
    } catch (caught) {
      setPronunciationLastHardCardCandidates([]);
      setPronunciationLastHardCardError(caught instanceof Error ? caught.message : "Could not connect to AnkiConnect.");
      setPronunciationLastHardCardStatus(null);
    } finally {
      setPreviewLoading(false);
    }
  }

  async function resetPronunciationLastHardCards() {
    if (running || previewLoading) return;
    setRunning(true);
    setPronunciationLastHardCardError(null);
    setPronunciationLastHardCardStatus("Finding and resetting Pronunciation cards whose latest real answer was Hard…");
    try {
      const result = await scanPronunciationLastHardCards();
      setPronunciationLastHardCardCandidates(result.candidates);
      const cardIds = [...new Set(result.candidates.map((candidate) => candidate.pronunciationCardId))];
      await resetCardsToStudyQueue(cardIds);
      setPronunciationLastHardCardStatus(`Done — ${formatPronunciationLastHardCardStatus(result, cardIds.length)}`);
    } catch (caught) {
      setPronunciationLastHardCardError(caught instanceof Error ? caught.message : "Could not connect to AnkiConnect.");
      setPronunciationLastHardCardStatus(null);
    } finally {
      setRunning(false);
    }
  }

  async function testReviewUnknownCards() {
    if (running || previewLoading) return;

    setPreviewLoading(true);
    setError(null);
    setStatus("Building a preview; no cards will be reset…");
    try {
      const result = await scanCandidates();
      setCandidates(result.candidates);
      setStatus(`Preview ready — ${formatScanStatus(result)}`);
    } catch (caught) {
      setCandidates([]);
      setError(caught instanceof Error ? caught.message : "Could not connect to AnkiConnect.");
      setStatus(null);
    } finally {
      setPreviewLoading(false);
    }
  }

  async function reviewUnknownCards() {
    if (running || previewLoading) return;

    setRunning(true);
    setError(null);
    setStatus("Checking cards, adding Orange flags to source cards, and resetting Review cards…");
    let currentStage = "resetting Review cards";
    try {
      const result = await scanCandidates();
      setCandidates(result.candidates);

      const sourceCardIds = [...new Set(result.candidates.map((candidate) => candidate.sourceCardId))];
      const reviewCardIds = [...new Set(result.candidates.map((candidate) => candidate.reviewCardId))];
      await resetCardsToStudyQueue(reviewCardIds);
      currentStage = "adding the Orange flag to source cards";
      await updateCardFlagsWithRollback(sourceCardIds, ORANGE_FLAG, 0);

      setStatus(`Done — ${formatScanStatus(result, reviewCardIds.length)} | Orange flags added: ${sourceCardIds.length}`);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Could not connect to AnkiConnect.";
      setError(`Error while ${currentStage}: ${message}`);
      setStatus(null);
    } finally {
      setRunning(false);
    }
  }

  async function previewPronunciationSourceCards(mode: "orange" | "again") {
    if (running || previewLoading) return;
    setPreviewLoading(true);
    setPronunciationSourceError(null);
    setPronunciationSourceStatus("Building a preview; no cards will be changed…");
    try {
      const result = await scanPronunciationSourceCandidates(mode);
      setPronunciationSourceCandidates(result.matchingCards);
      setPronunciationSourceStatus(
        `Preview ready — ${formatPronunciationSourceStatus(result, "", undefined)}`,
      );
    } catch (caught) {
      setPronunciationSourceCandidates([]);
      setPronunciationSourceError(caught instanceof Error ? caught.message : "Could not connect to AnkiConnect.");
      setPronunciationSourceStatus(null);
    } finally {
      setPreviewLoading(false);
    }
  }

  async function runPronunciationSourceOrangeStep() {
    if (running || previewLoading) return;
    setRunning(true);
    setPronunciationSourceError(null);
    setPronunciationSourceStatus("Checking and resetting Orange Pronunciation cards…");
    let currentStage = "resetting Pronunciation cards";
    try {
      const result = await scanPronunciationSourceCandidates("orange");
      setPronunciationSourceCandidates(result.matchingCards);
      const sourceCardIds = [...new Set(result.matchingCards.map((candidate) => candidate.sourceCardId))];
      await resetCardsToStudyQueue(sourceCardIds);
      currentStage = "removing the Orange flag from Pronunciation cards";
      await updateCardFlagsWithRollback(sourceCardIds, 0, ORANGE_FLAG);
      setPronunciationSourceStatus(
        `Done — ${formatPronunciationSourceStatus(result, "Reset", sourceCardIds.length)} | Orange flags removed: ${sourceCardIds.length}`,
      );
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Could not connect to AnkiConnect.";
      setPronunciationSourceError(`Error while ${currentStage}: ${message}`);
      setPronunciationSourceStatus(null);
    } finally {
      setRunning(false);
    }
  }

  async function runPronunciationSourceAgainStep() {
    if (running || previewLoading) return;
    setRunning(true);
    setPronunciationSourceError(null);
    setPronunciationSourceStatus("Checking and resetting ReviewPronunciation cards…");
    let currentStage = "resetting ReviewPronunciation cards";
    try {
      const result = await scanPronunciationSourceCandidates("again");
      setPronunciationSourceCandidates(result.matchingCards);
      const sourceCardIds = [...new Set(result.matchingCards.map((candidate) => candidate.sourceCardId))];
      const reviewCardIds = [...new Set(result.matchingCards.map((candidate) => candidate.reviewCardId))];
      await resetCardsToStudyQueue(reviewCardIds);
      currentStage = "adding the Orange flag to Pronunciation cards";
      await updateCardFlagsWithRollback(sourceCardIds, ORANGE_FLAG, 0);
      setPronunciationSourceStatus(
        `Done — ${formatPronunciationSourceStatus(result, "ReviewPronunciation cards reset", reviewCardIds.length)} | Orange flags added: ${sourceCardIds.length}`,
      );
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Could not connect to AnkiConnect.";
      setPronunciationSourceError(`Error while ${currentStage}: ${message}`);
      setPronunciationSourceStatus(null);
    } finally {
      setRunning(false);
    }
  }

  async function executeAllMainSteps(
    onProgress?: (processed: number, total: number, detail: string) => void,
  ) {
    let currentStep = "Step 1: Unknown pronunciation";
    const report: string[] = [];
    try {
      onProgress?.(0, 4, currentStep);
      const stepOne = await scanPronunciationResetCandidates();
      const stepOneSourceIds = [...new Set(stepOne.matchingPronunciationCards.map((card) => card.sourceCardId))];
      const stepOnePronunciationIds = [...new Set(stepOne.matchingPronunciationCards.map((card) => card.pronunciationCardId))];
      for (const batch of chunkArray(stepOnePronunciationIds, BATCH_SIZE)) {
        const answerResponse = await ankiOperations.answerCards({ answers: batch.map((cardId) => ({ cardId, ease: 1 })) });
        if (!answerResponse.ok) throw new Error(answerResponse.error);
      }
      await updateCardFlagsWithRollback(stepOneSourceIds, 0, PURPLE_FLAG);
      report.push(`Step 1: ${stepOnePronunciationIds.length} pronunciation cards`);
      onProgress?.(1, 4, report.at(-1) ?? currentStep);

      currentStep = "Step 2: Unknown primary card";
      onProgress?.(1, 4, currentStep);
      const stepTwo = await scanReviewResetCandidates();
      const stepTwoSourceIds = [...new Set(stepTwo.matchingSourceCards.map((card) => card.sourceCardId))];
      await resetCardsToStudyQueue(stepTwoSourceIds);
      await updateCardFlagsWithRollback(stepTwoSourceIds, 0, ORANGE_FLAG);
      report.push(`Step 2: ${stepTwoSourceIds.length} primary cards`);
      onProgress?.(2, 4, report.at(-1) ?? currentStep);

      currentStep = "Step 3: Reset cards whose latest answer was Hard";
      onProgress?.(2, 4, currentStep);
      const stepThree = await scanLastHardCards();
      const stepThreeCardIds = [...new Set(stepThree.candidates.map((card) => card.sourceCardId))];
      await resetCardsToStudyQueue(stepThreeCardIds);
      report.push(`Step 3: ${stepThreeCardIds.length} cards whose latest answer was Hard`);
      onProgress?.(3, 4, report.at(-1) ?? currentStep);

      currentStep = "Step 4: Complete review";
      onProgress?.(3, 4, currentStep);
      const stepFour = await scanCandidates();
      const stepFourReviewIds = [...new Set(stepFour.candidates.map((card) => card.reviewCardId))];
      const stepFourSourceIds = [...new Set(stepFour.candidates.map((card) => card.sourceCardId))];
      await resetCardsToStudyQueue(stepFourReviewIds);
      await updateCardFlagsWithRollback(stepFourSourceIds, ORANGE_FLAG, 0);
      report.push(`Step 4: ${stepFourReviewIds.length} Review cards`);
      onProgress?.(4, 4, report.at(-1) ?? currentStep);
      return report;
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Could not connect to AnkiConnect.";
      throw new Error(`Error in ${currentStep}: ${message}`);
    }
  }

  async function runAllMainSteps() {
    if (running || previewLoading) return;
    setRunning(true);
    setMainRunAllError(null);
    setMainRunAllStatus("Running steps 1 through 4…");
    try {
      const report = await executeAllMainSteps();
      setMainRunAllStatus(`Done — ${report.join(" | ")}`);
    } catch (caught) {
      setMainRunAllError(caught instanceof Error ? caught.message : String(caught));
      setMainRunAllStatus(null);
    } finally {
      setRunning(false);
    }
  }

  async function executeAllPronunciationSteps(
    onProgress?: (processed: number, total: number, detail: string) => void,
  ) {
    let currentStep = "Step 1: Unknown pronunciation";
    const report: string[] = [];
    try {
      onProgress?.(0, 3, currentStep);
      const stepOne = await scanPronunciationSourceCandidates("again");
      const stepOneReviewIds = [...new Set(stepOne.matchingCards.map((card) => card.reviewCardId))];
      const stepOneSourceIds = [...new Set(stepOne.matchingCards.map((card) => card.sourceCardId))];
      await resetCardsToStudyQueue(stepOneReviewIds);
      await updateCardFlagsWithRollback(stepOneSourceIds, ORANGE_FLAG, 0);
      report.push(`Step 1: ${stepOneReviewIds.length} ReviewPronunciation cards`);
      onProgress?.(1, 3, report.at(-1) ?? currentStep);

      currentStep = "Step 2: Reset Pronunciation cards whose latest answer was Hard";
      onProgress?.(1, 3, currentStep);
      const stepTwo = await scanPronunciationLastHardCards();
      const stepTwoCardIds = [...new Set(stepTwo.candidates.map((card) => card.pronunciationCardId))];
      await resetCardsToStudyQueue(stepTwoCardIds);
      report.push(`Step 2: ${stepTwoCardIds.length} Pronunciation cards whose latest answer was Hard`);
      onProgress?.(2, 3, report.at(-1) ?? currentStep);

      currentStep = "Step 3: Complete pronunciation review";
      onProgress?.(2, 3, currentStep);
      const stepThree = await scanPronunciationSourceCandidates("orange");
      const stepThreeSourceIds = [...new Set(stepThree.matchingCards.map((card) => card.sourceCardId))];
      await resetCardsToStudyQueue(stepThreeSourceIds);
      await updateCardFlagsWithRollback(stepThreeSourceIds, 0, ORANGE_FLAG);
      report.push(`Step 3: ${stepThreeSourceIds.length} pronunciation cards`);
      onProgress?.(3, 3, report.at(-1) ?? currentStep);
      return report;
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Could not connect to AnkiConnect.";
      throw new Error(`Error in ${currentStep}: ${message}`);
    }
  }

  async function runAllPronunciationSteps() {
    if (running || previewLoading) return;
    setRunning(true);
    setPronunciationRunAllError(null);
    setPronunciationRunAllStatus("Running Pronunciation steps 1 through 3…");
    try {
      const report = await executeAllPronunciationSteps();
      setPronunciationRunAllStatus(`Done — ${report.join(" | ")}`);
    } catch (caught) {
      setPronunciationRunAllError(caught instanceof Error ? caught.message : String(caught));
      setPronunciationRunAllStatus(null);
    } finally {
      setRunning(false);
    }
  }

  function updateMasterStage(index: number, patch: Partial<MasterStage>) {
    setMasterStages((current) =>
      current.map((stage, stageIndex) => (stageIndex === index ? { ...stage, ...patch } : stage)),
    );
  }

  async function requestJson<T>(endpoint: string, init?: RequestInit): Promise<T> {
    const response = await fetch(endpoint, init);
    const data = (await response.json().catch(() => ({}))) as T & { error?: string };
    if (!response.ok) throw new Error(data.error ?? `Request failed (${response.status})`);
    return data;
  }

  async function runBackgroundSync(
    stageIndex: number,
    startEndpoint: string,
    statusEndpoint: string,
    formatDetail: (status: BackgroundSyncStatus) => string,
    startBody?: Record<string, unknown>,
  ) {
    await requestJson(startEndpoint, {
      method: "POST",
      ...(startBody
        ? {
            headers: { "content-type": "application/json" },
            body: JSON.stringify(startBody),
          }
        : {}),
    });

    while (true) {
      const data = await requestJson<{ status?: BackgroundSyncStatus }>(statusEndpoint);
      const jobStatus = data.status;
      if (!jobStatus) throw new Error("The sync job did not return a status.");

      updateMasterStage(stageIndex, {
        processed: jobStatus.processed,
        total: jobStatus.total,
        detail: formatDetail(jobStatus),
      });

      if (jobStatus.error) throw new Error(jobStatus.error);
      if (!jobStatus.running) {
        if (jobStatus.stoppedEarly) throw new Error("The sync job stopped before completion.");
        if (!jobStatus.done) throw new Error("The sync job ended without completing.");
        if (jobStatus.failed > 0) throw new Error(`${jobStatus.failed} item(s) failed.`);
        return formatDetail(jobStatus);
      }

      await wait(750);
    }
  }

  async function deleteAnkiNotesMissingInDatabase(stageIndex: number) {
    updateMasterStage(stageIndex, { detail: "Checking Anki notes…" });
    const scan = await requestJson<{
      totalNotes?: number;
      checkedNotes?: number;
      missing?: Array<{ noteId: number }>;
      snapshotId?: string;
    }>("/api/word/anki-missing", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ limit: 50_000 }),
    });

    const missingNoteIds = Array.isArray(scan.missing) ? scan.missing.map((note) => note.noteId) : [];
    masterAnkiSnapshotIdRef.current = scan.snapshotId ?? null;
    updateMasterStage(stageIndex, {
      processed: 0,
      total: missingNoteIds.length,
      detail: `${scan.checkedNotes ?? 0} of ${scan.totalNotes ?? 0} notes checked; ${missingNoteIds.length} notes found for deletion.`,
    });

    if (!missingNoteIds.length) return "No notes were found for deletion.";

    const result = await requestJson<{ deleted?: number }>("/api/word/anki-missing/delete", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ noteIds: missingNoteIds }),
    });
    const deleted = result.deleted ?? 0;
    updateMasterStage(stageIndex, {
      processed: deleted,
      total: missingNoteIds.length,
      detail: `${deleted} of ${missingNoteIds.length} notes deleted.`,
    });
    if (deleted !== missingNoteIds.length) {
      throw new Error(`Expected to delete ${missingNoteIds.length} notes, but ${deleted} were reported deleted.`);
    }
    return `${deleted} notes deleted.`;
  }

  async function executeMasterStage(stageIndex: number) {
    switch (stageIndex) {
      case 0:
        return runBackgroundSync(
          stageIndex,
          "/api/tests/sync-anki-words/media/sync-all/start",
          "/api/tests/sync-anki-words/media/sync-all/status",
          (jobStatus) =>
            `${jobStatus.processed}/${jobStatus.total} processed • ${jobStatus.mediaUploaded} uploaded • ${jobStatus.failed} failed`,
        );
      case 1:
        return deleteAnkiNotesMissingInDatabase(stageIndex);
      case 2:
        return runBackgroundSync(
          stageIndex,
          "/api/tests/sync-anki-words/full/sync-all/start",
          "/api/tests/sync-anki-words/full/sync-all/status",
          (jobStatus) =>
            `${jobStatus.processed}/${jobStatus.total} processed • ${jobStatus.created ?? 0} created • ${jobStatus.updated} updated • ${jobStatus.failed} failed`,
          masterAnkiSnapshotIdRef.current
            ? { snapshotId: masterAnkiSnapshotIdRef.current }
            : undefined,
        );
      case 3: {
        setMainRunAllError(null);
        setMainRunAllStatus("Running steps 1 through 4…");
        const report = await executeAllMainSteps((processed, total, detail) => {
          updateMasterStage(stageIndex, { processed, total, detail });
        });
        const detail = report.join(" | ");
        setMainRunAllStatus(`Done — ${detail}`);
        return detail;
      }
      case 4: {
        setPronunciationRunAllError(null);
        setPronunciationRunAllStatus("Running Pronunciation steps 1 through 3…");
        const report = await executeAllPronunciationSteps((processed, total, detail) => {
          updateMasterStage(stageIndex, { processed, total, detail });
        });
        const detail = report.join(" | ");
        setPronunciationRunAllStatus(`Done — ${detail}`);
        return detail;
      }
      default:
        throw new Error("Unknown master workflow stage.");
    }
  }

  async function continueMasterWorkflow(
    startIndex: number,
    skipCompletedStages = false,
  ) {
    setMasterRunning(true);
    setRunning(true);
    setMasterFailedIndex(null);

    try {
      if (startIndex === 0 && !skipCompletedStages) {
        for (const stageIndex of [0, 1]) {
          updateMasterStage(stageIndex, {
            status: "running",
            detail: "Starting…",
            processed: 0,
            total: 0,
          });
        }
        const initialResults = await Promise.allSettled([
          executeMasterStage(0),
          executeMasterStage(1),
        ]);
        let firstFailedIndex: number | null = null;
        initialResults.forEach((result, stageIndex) => {
          if (result.status === "fulfilled") {
            updateMasterStage(stageIndex, {
              status: "completed",
              detail: result.value,
            });
            return;
          }
          const message =
            result.reason instanceof Error
              ? result.reason.message
              : String(result.reason);
          updateMasterStage(stageIndex, { status: "error", detail: message });
          if (firstFailedIndex === null) firstFailedIndex = stageIndex;
        });
        if (firstFailedIndex !== null) {
          setMasterFailedIndex(firstFailedIndex);
          return;
        }
        startIndex = 2;
      }

      for (let stageIndex = startIndex; stageIndex < MASTER_STAGE_LABELS.length; stageIndex += 1) {
        if (skipCompletedStages && masterStages[stageIndex]?.status === "completed") continue;
        updateMasterStage(stageIndex, {
          status: "running",
          detail: "Starting…",
          processed: 0,
          total: 0,
        });
        try {
          const detail = await executeMasterStage(stageIndex);
          updateMasterStage(stageIndex, { status: "completed", detail });
        } catch (caught) {
          const message = caught instanceof Error ? caught.message : String(caught);
          updateMasterStage(stageIndex, { status: "error", detail: message });
          setMasterFailedIndex(stageIndex);
          if (stageIndex === 3) {
            setMainRunAllError(message);
            setMainRunAllStatus(null);
          }
          if (stageIndex === 4) {
            setPronunciationRunAllError(message);
            setPronunciationRunAllStatus(null);
          }
          return;
        }
      }
    } finally {
      setMasterRunning(false);
      setRunning(false);
    }
  }

  function startMasterWorkflow() {
    if (running || previewLoading || masterRunning) return;
    setMasterStages(createMasterStages());
    masterAnkiSnapshotIdRef.current = null;
    setMasterFailedIndex(null);
    setMasterModalOpen(true);
    void continueMasterWorkflow(0);
  }

  function retryMasterWorkflow() {
    if (masterRunning || masterFailedIndex === null) return;
    void continueMasterWorkflow(masterFailedIndex, true);
  }

  return (
    <main className="mx-auto w-full max-w-6xl select-text p-4 text-left">
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="xl:col-span-2">
          <PageHeader
            title="Equivalent Card Reset"
            subtitle="Independent checks for primary and pronunciation cards"
          />
        </div>
        <AnkiWordSyncQuickActions
          disabled={running || previewLoading || masterRunning}
          allJobsRunning={masterRunning}
          onRunAllJobs={startMasterWorkflow}
        />
        {masterModalOpen ? (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
          >
            <div className="w-full max-w-3xl rounded-3xl border border-card bg-card p-5 text-left shadow-2xl sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-foreground">Run all operations</h2>
                  <p className="mt-1 text-sm text-muted">
                    Steps run in order, and the process stops if an error occurs.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setMasterModalOpen(false)}
                  disabled={masterRunning}
                  aria-label="Close"
                  className="grid size-10 shrink-0 place-items-center rounded-full border border-card bg-background text-xl text-muted disabled:opacity-50"
                >
                  ×
                </button>
              </div>

              <ol className="mt-5 grid gap-2">
                {masterStages.map((stage, index) => {
                  const progressPercent = stage.total > 0 ? Math.min(100, Math.round((stage.processed / stage.total) * 100)) : 0;
                  return (
                    <li key={stage.label} className="rounded-xl border border-card bg-background p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-foreground">
                            {index + 1}. <span dir="auto">{stage.label}</span>
                          </div>
                          <div className={`mt-1 text-xs ${stage.status === "error" ? "text-red-700 dark:text-red-400" : "text-muted"}`}>
                            {stage.detail}
                          </div>
                        </div>
                        <span
                          className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-semibold ${
                            stage.status === "completed"
                              ? "bg-green-600/10 text-green-700 dark:text-green-400"
                              : stage.status === "error"
                                ? "bg-red-600/10 text-red-700 dark:text-red-400"
                                : stage.status === "running"
                                  ? "bg-blue-600/10 text-blue-700 dark:text-blue-400"
                                  : "bg-black/5 text-muted dark:bg-white/5"
                          }`}
                        >
                          {stage.status === "completed"
                            ? "Done"
                            : stage.status === "error"
                              ? "Error"
                              : stage.status === "running"
                                ? "Running"
                                : "Waiting"}
                        </span>
                      </div>
                      {stage.status === "running" && stage.total > 0 ? (
                        <div className="mt-3">
                          <div className="mb-1 flex items-center justify-between text-[11px] text-muted">
                            <span>{progressPercent}%</span>
                            <span dir="ltr">{stage.processed}/{stage.total}</span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
                            <div className="h-full rounded-full bg-[var(--primary)] transition-[width]" style={{ width: `${progressPercent}%` }} />
                          </div>
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ol>

              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-card pt-4">
                <div className="text-xs text-muted">
                  {masterRunning
                    ? "Keep this window open until the current step finishes."
                    : masterFailedIndex !== null
                      ? "Resolve the error, then Retry will run the same step again."
                      : masterStages.every((stage) => stage.status === "completed")
                        ? "All steps completed successfully."
                        : "Ready to run"}
                </div>
                <div className="flex items-center gap-2">
                  {masterFailedIndex !== null ? (
                    <button
                      type="button"
                      onClick={retryMasterWorkflow}
                      disabled={masterRunning}
                      className="h-10 rounded-xl bg-[var(--primary)] px-4 text-sm font-bold text-[var(--primary-foreground)] disabled:opacity-50"
                    >
                      Retry
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setMasterModalOpen(false)}
                    disabled={masterRunning}
                    className="h-10 rounded-xl border border-card bg-background px-4 text-sm font-semibold text-foreground disabled:opacity-50"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}
        <section className="order-1 grid gap-3 rounded-2xl border border-card bg-background p-3 xl:col-span-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-foreground">Check EnToFa, FaToEn, and FaToEnWithHelp Cards</h2>
              <p className="mt-1 text-xs text-muted">Primary-card and matching Review-card workflow</p>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => void runAllMainSteps()} disabled={running || previewLoading} className="h-10 rounded-xl bg-[var(--primary)] px-3 text-xs font-bold text-[var(--primary-foreground)] disabled:opacity-60">
                {running ? "Running…" : "Run 4 steps"}
              </button>
              <button type="button" onClick={() => setIsHelpOpen(true)} aria-label="Primary card help" className="grid size-10 shrink-0 place-items-center rounded-full border border-card bg-card text-lg font-bold text-foreground shadow-elevated">?</button>
            </div>
          </div>
          {mainRunAllError ? <p className="text-sm font-semibold text-red-700 dark:text-red-400">{mainRunAllError}</p> : null}
          {mainRunAllStatus ? <p className="rounded-xl border border-card bg-card p-3 text-sm text-foreground">{mainRunAllStatus}</p> : null}
          <div className="grid gap-3 md:grid-cols-2">
          <section className="grid gap-3 rounded-2xl border border-card bg-background p-3">
          <div>
            <h2 className="text-base font-semibold text-foreground">1. Unknown Pronunciation</h2>
            <p className="mt-1 text-xs leading-5 text-muted">
              Purple (7): The matching Pronunciation card receives Again once, then the Purple flag is removed.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => void testPronunciationResetCandidates()}
              disabled={running || previewLoading}
              className="h-11 rounded-xl border border-card px-4 text-sm font-semibold text-foreground disabled:opacity-60"
            >
              {previewLoading ? "Preparing preview…" : "Test / Preview"}
            </button>
            <button
              type="button"
              onClick={() => void resetMatchingPronunciationCards()}
              disabled={running || previewLoading}
              className="h-11 rounded-xl bg-[var(--primary)] px-4 text-sm font-semibold text-[var(--primary-foreground)] disabled:opacity-60"
            >
              {running ? "Running…" : "Again Pronunciation"}
            </button>
          </div>
          {pronunciationResetError && <p className="text-sm font-semibold text-red-700 dark:text-red-400">{pronunciationResetError}</p>}
          {pronunciationResetStatus && <p className="rounded-xl border border-card p-3 text-sm text-foreground">{pronunciationResetStatus}</p>}
          </section>

          <section className="grid gap-3 rounded-2xl border border-card bg-background p-3">
          <div>
            <h2 className="text-base font-semibold text-foreground">2. Unknown Primary Card</h2>
            <p className="mt-1 text-xs leading-5 text-muted">
              Orange (2): If the matching Review card has <span dir="ltr">ivl &gt; 3650</span>, the source card is reset and then its flag is removed.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => void testReviewResetCandidates()}
              disabled={running || previewLoading}
              className="h-11 rounded-xl border border-card px-4 text-sm font-semibold text-foreground disabled:opacity-60"
            >
              {previewLoading ? "Preparing preview…" : "Test / Preview"}
            </button>
            <button
              type="button"
              onClick={() => void resetMatchingSourceCards()}
              disabled={running || previewLoading}
              className="h-11 rounded-xl bg-[var(--primary)] px-4 text-sm font-semibold text-[var(--primary-foreground)] disabled:opacity-60"
            >
              {running ? "Resetting…" : "Reset Orange"}
            </button>
          </div>
          {reviewResetError && <p className="text-sm font-semibold text-red-700 dark:text-red-400">{reviewResetError}</p>}
          {reviewResetStatus && <p className="rounded-xl border border-card p-3 text-sm text-foreground">{reviewResetStatus}</p>}
          </section>

          <section className="grid gap-3 rounded-2xl border border-card bg-background p-3">
          <div>
            <h2 className="text-base font-semibold text-foreground">3. Reset Cards Whose Latest Answer Was Hard</h2>
            <p className="mt-1 text-xs leading-5 text-muted">
              Non-New <span dir="ltr">EnToFa</span>, <span dir="ltr">FaToEn</span>, and <span dir="ltr">{FA_TO_EN_WITH_HELP_CARD_TEMPLATE}</span> cards whose latest real answer was <span dir="ltr">Hard (ease=2)</span> are returned to New.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => void testLastHardCards()}
              disabled={running || previewLoading}
              className="h-11 rounded-xl border border-card px-4 text-sm font-semibold text-foreground disabled:opacity-60"
            >
              {previewLoading ? "Preparing preview…" : "Test / Preview"}
            </button>
            <button
              type="button"
              onClick={() => void resetLastHardCards()}
              disabled={running || previewLoading}
              className="h-11 rounded-xl bg-[var(--primary)] px-4 text-sm font-semibold text-[var(--primary-foreground)] disabled:opacity-60"
            >
              {running ? "Resetting…" : "Reset Hard"}
            </button>
          </div>
          {lastHardCardError && <p className="text-sm font-semibold text-red-700 dark:text-red-400">{lastHardCardError}</p>}
          {lastHardCardStatus && <p className="rounded-xl border border-card p-3 text-sm text-foreground">{lastHardCardStatus}</p>}
          </section>

          <section className="grid gap-2 rounded-2xl border border-card bg-background p-2">
          <div>
            <h2 className="text-sm font-semibold text-foreground">4. Complete Review</h2>
            <p className="mt-1 text-xs leading-4 text-muted">
              No flag + Again + <span dir="ltr">ivl &gt; 3650</span>: Reset the Review card, then add the Orange flag.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => void testReviewUnknownCards()}
              disabled={running || previewLoading}
              className="h-10 rounded-xl border border-card px-3 text-xs font-semibold text-foreground disabled:opacity-60"
            >
              {previewLoading ? "Preparing preview…" : "Test / Preview"}
            </button>
            <button
              type="button"
              onClick={() => void reviewUnknownCards()}
              disabled={running || previewLoading}
              className="h-10 min-w-0 rounded-xl bg-[var(--primary)] px-3 text-xs font-semibold leading-4 text-[var(--primary-foreground)] disabled:opacity-60"
            >
              {running ? "Running…" : "Reset Review + Orange"}
            </button>
          </div>
          {error && <p className="text-xs font-semibold text-red-700 dark:text-red-400">{error}</p>}
          {status && <p className="rounded-xl border border-card p-2 text-xs text-foreground">{status}</p>}
          </section>
          </div>
        </section>

        <section className="order-2 grid gap-3 rounded-2xl border border-card bg-background p-3 xl:col-span-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-foreground">Check Pronunciation Cards</h2>
              <p className="mt-1 text-xs text-muted">Pronunciation and ReviewPronunciation workflow</p>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => void runAllPronunciationSteps()} disabled={running || previewLoading} className="h-10 rounded-xl bg-[var(--primary)] px-3 text-xs font-bold text-[var(--primary-foreground)] disabled:opacity-60">
                {running ? "Running…" : "Run 3 steps"}
              </button>
              <button type="button" onClick={() => setIsPronunciationHelpOpen(true)} aria-label="Pronunciation card help" className="grid size-10 shrink-0 place-items-center rounded-full border border-card bg-card text-lg font-bold text-foreground shadow-elevated">?</button>
            </div>
          </div>
          {pronunciationRunAllError ? <p className="text-sm font-semibold text-red-700 dark:text-red-400">{pronunciationRunAllError}</p> : null}
          {pronunciationRunAllStatus ? <p className="rounded-xl border border-card bg-card p-3 text-sm text-foreground">{pronunciationRunAllStatus}</p> : null}
          <div className="grid gap-3">
            <section className="grid gap-3 rounded-2xl border border-card bg-card p-3">
              <div>
                <h3 className="text-base font-semibold text-foreground">1. Unknown Pronunciation</h3>
                <p className="mt-1 text-xs leading-5 text-muted">No flag + Again + old interval: Reset ReviewPronunciation, then add Orange.</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <button type="button" onClick={() => void previewPronunciationSourceCards("again")} disabled={running || previewLoading} className="h-11 rounded-xl border border-card px-4 text-sm font-semibold text-foreground disabled:opacity-60">
                  {previewLoading ? "Preparing preview…" : "Test / Preview"}
                </button>
                <button type="button" onClick={() => void runPronunciationSourceAgainStep()} disabled={running || previewLoading} className="h-11 rounded-xl bg-[var(--primary)] px-4 text-sm font-semibold text-[var(--primary-foreground)] disabled:opacity-60">
                  {running ? "Running…" : "Reset Review + Orange"}
                </button>
              </div>
            </section>
            <section className="grid gap-3 rounded-2xl border border-card bg-card p-3">
              <div>
                <h3 className="text-base font-semibold text-foreground">2. Reset Cards Whose Latest Answer Was Hard</h3>
                <p className="mt-1 text-xs leading-5 text-muted">
                  Only non-New <span dir="ltr">{PRONUNCIATION_CARD_TEMPLATE}</span> cards in <span dir="ltr">{PRONUNCIATION_DECK}</span> whose latest real answer was <span dir="ltr">Hard (ease=2)</span> are returned to New.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <button type="button" onClick={() => void testPronunciationLastHardCards()} disabled={running || previewLoading} className="h-11 rounded-xl border border-card px-4 text-sm font-semibold text-foreground disabled:opacity-60">
                  {previewLoading ? "Preparing preview…" : "Test / Preview"}
                </button>
                <button type="button" onClick={() => void resetPronunciationLastHardCards()} disabled={running || previewLoading} className="h-11 rounded-xl bg-[var(--primary)] px-4 text-sm font-semibold text-[var(--primary-foreground)] disabled:opacity-60">
                  {running ? "Resetting…" : "Reset Hard"}
                </button>
              </div>
              {pronunciationLastHardCardError && <p className="text-sm font-semibold text-red-700 dark:text-red-400">{pronunciationLastHardCardError}</p>}
              {pronunciationLastHardCardStatus && <p className="rounded-xl border border-card p-3 text-sm text-foreground">{pronunciationLastHardCardStatus}</p>}
            </section>
            <section className="grid gap-3 rounded-2xl border border-card bg-card p-3">
              <div>
                <h3 className="text-base font-semibold text-foreground">3. Complete Pronunciation Review</h3>
                <p className="mt-1 text-xs leading-5 text-muted">Orange + old ReviewPronunciation: Reset Pronunciation, then remove Orange.</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <button type="button" onClick={() => void previewPronunciationSourceCards("orange")} disabled={running || previewLoading} className="h-11 rounded-xl border border-card px-4 text-sm font-semibold text-foreground disabled:opacity-60">
                  {previewLoading ? "Preparing preview…" : "Test / Preview"}
                </button>
                <button type="button" onClick={() => void runPronunciationSourceOrangeStep()} disabled={running || previewLoading} className="h-11 rounded-xl bg-[var(--primary)] px-4 text-sm font-semibold text-[var(--primary-foreground)] disabled:opacity-60">
                  {running ? "Resetting…" : "Reset Orange"}
                </button>
              </div>
            </section>
          </div>
          {pronunciationSourceError ? <p className="text-sm font-semibold text-red-700 dark:text-red-400">{pronunciationSourceError}</p> : null}
          {pronunciationSourceStatus ? <p className="rounded-xl border border-card bg-card p-3 text-sm text-foreground">{pronunciationSourceStatus}</p> : null}
          {pronunciationSourceCandidates.length > 0 ? (
          <div className="overflow-x-auto rounded-xl border border-card bg-card">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-background text-xs text-muted"><tr><th className="px-4 py-3">Word</th><th dir="rtl" className="px-4 py-3 text-right">معنی فارسی</th><th className="px-4 py-3">Source Interval</th><th className="px-4 py-3">ReviewPronunciation Interval</th><th className="px-4 py-3">Pronunciation Card</th><th className="px-4 py-3">ReviewPronunciation Card</th></tr></thead>
              <tbody>{pronunciationSourceCandidates.length === 0 ? <tr><td colSpan={6} className="px-4 py-8 text-center text-muted">No preview has run yet, or no eligible cards were found.</td></tr> : pronunciationSourceCandidates.map((candidate) => <tr key={`${candidate.sourceCardId}-${candidate.reviewCardId}`} className="border-t border-card"><td className="px-4 py-3 font-semibold text-foreground">{candidate.baseForm || "—"}</td><td dir="rtl" className="px-4 py-3 text-right">{candidate.meaningFa || "—"}</td><td className="px-4 py-3 text-muted">{candidate.sourceInterval ?? "—"}</td><td className="px-4 py-3 text-muted">{candidate.reviewInterval ?? "—"}</td><td className="px-4 py-3 font-mono text-xs text-muted">{candidate.sourceCardId}</td><td className="px-4 py-3 font-mono text-xs text-muted">{candidate.reviewCardId}</td></tr>)}</tbody>
            </table>
          </div>
          ) : null}
          {pronunciationLastHardCardCandidates.length > 0 ? (
          <div className="overflow-x-auto rounded-xl border border-card bg-card">
            <div className="border-b border-card p-4">
              <h3 className="font-semibold text-foreground">Pronunciation Latest-Hard Results</h3>
              <p className="mt-1 text-sm text-muted">Only Pronunciation cards in the Pronunciation deck whose latest real answer was Hard</p>
            </div>
            <table className="min-w-full text-left text-sm">
              <thead className="bg-background text-xs text-muted"><tr><th className="px-4 py-3">Word</th><th dir="rtl" className="px-4 py-3 text-right">معنی فارسی</th><th className="px-4 py-3">Pronunciation Card</th></tr></thead>
              <tbody>{pronunciationLastHardCardCandidates.map((candidate) => <tr key={candidate.pronunciationCardId} className="border-t border-card"><td className="px-4 py-3 font-semibold text-foreground">{candidate.baseForm || "—"}</td><td dir="rtl" className="px-4 py-3 text-right">{candidate.meaningFa || "—"}</td><td className="px-4 py-3 font-mono text-xs text-muted">{candidate.pronunciationCardId}</td></tr>)}</tbody>
            </table>
          </div>
          ) : null}
        </section>

        <section className={`${lastHardCardCandidates.length === 0 ? "hidden " : ""}order-4 overflow-hidden rounded-2xl border border-card bg-background xl:col-span-2`}>
          <div className="border-b border-card p-4">
            <h2 className="font-semibold text-foreground">Step 3 Results: Latest Answer Hard</h2>
            <p className="mt-1 text-sm text-muted">EnToFa, FaToEn, and FaToEnWithHelp cards whose latest real answer was Hard and will return to the New queue when reset</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-card/50 text-xs text-muted">
                <tr>
                  <th className="whitespace-nowrap px-4 py-3">Word</th>
                  <th dir="rtl" className="whitespace-nowrap px-4 py-3 text-right">معنی فارسی</th>
                  <th className="whitespace-nowrap px-4 py-3">Source Deck</th>
                  <th className="whitespace-nowrap px-4 py-3">Source Card</th>
                </tr>
              </thead>
              <tbody>
                {lastHardCardCandidates.map((candidate) => (
                  <tr key={candidate.sourceCardId} className="border-t border-card">
                    <td className="px-4 py-3 font-semibold text-foreground">{candidate.baseForm || "—"}</td>
                    <td dir="rtl" className="px-4 py-3 text-right text-foreground">{candidate.meaningFa || "—"}</td>
                    <td className="px-4 py-3 text-muted">{candidate.sourceDeck}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted">{candidate.sourceCardId}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className={`${candidates.length === 0 ? "hidden " : ""}order-5 overflow-hidden rounded-2xl border border-card bg-background xl:col-span-2`}>
          <div className="border-b border-card p-4">
            <h2 className="font-semibold text-foreground">Step 4 Results: Complete Review</h2>
            <p className="mt-1 text-sm text-muted">Unflagged cards with Again, an interval over 10 years, and a matching Review card</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-card/50 text-xs text-muted">
                <tr>
                  <th className="whitespace-nowrap px-4 py-3">Word</th>
                  <th dir="rtl" className="whitespace-nowrap px-4 py-3 text-right">معنی فارسی</th>
                  <th className="whitespace-nowrap px-4 py-3">Source Deck</th>
                  <th className="whitespace-nowrap px-4 py-3">Interval</th>
                  <th className="whitespace-nowrap px-4 py-3">Source Card</th>
                  <th className="whitespace-nowrap px-4 py-3">Review Card</th>
                </tr>
              </thead>
              <tbody>
                {candidates.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-muted">
                      No preview has run yet, or no eligible cards were found.
                    </td>
                  </tr>
                ) : (
                  candidates.map((candidate) => (
                    <tr key={`${candidate.reviewCardId}-${candidate.sourceCardId}`} className="border-t border-card">
                      <td className="px-4 py-3 font-semibold text-foreground">{candidate.baseForm || "—"}</td>
                      <td dir="rtl" className="px-4 py-3 text-right text-foreground">{candidate.meaningFa || "—"}</td>
                      <td className="px-4 py-3 text-muted">{candidate.sourceDeck}</td>
                      <td className="px-4 py-3 text-muted">{candidate.interval}</td>
                      <td className="px-4 py-3 font-mono text-xs text-muted">{candidate.sourceCardId}</td>
                      <td className="px-4 py-3 font-mono text-xs text-muted">{candidate.reviewCardId}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className={`${pronunciationResetCandidates.length === 0 ? "hidden " : ""}order-2 overflow-hidden rounded-2xl border border-card bg-background xl:col-span-2`}>
          <div className="border-b border-card p-4">
            <h2 className="font-semibold text-foreground">Step 1 Results: Unknown Pronunciation</h2>
            <p className="mt-1 text-sm text-muted">Source cards with the Purple flag and their matching Pronunciation cards</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-card/50 text-xs text-muted">
                <tr>
                  <th className="whitespace-nowrap px-4 py-3">Word</th>
                  <th dir="rtl" className="whitespace-nowrap px-4 py-3 text-right">معنی فارسی</th>
                  <th className="whitespace-nowrap px-4 py-3">Source Deck</th>
                  <th className="whitespace-nowrap px-4 py-3">Source Card</th>
                  <th className="whitespace-nowrap px-4 py-3">Pronunciation Card</th>
                </tr>
              </thead>
              <tbody>
                {pronunciationResetCandidates.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted">
                      Step 1 has not been previewed yet, or no eligible cards were found.
                    </td>
                  </tr>
                ) : (
                  pronunciationResetCandidates.map((candidate) => (
                    <tr key={`${candidate.sourceCardId}-${candidate.pronunciationCardId}`} className="border-t border-card">
                      <td className="px-4 py-3 font-semibold text-foreground">{candidate.baseForm || "—"}</td>
                      <td dir="rtl" className="px-4 py-3 text-right text-foreground">{candidate.meaningFa || "—"}</td>
                      <td className="px-4 py-3 text-muted">{candidate.sourceDeck}</td>
                      <td className="px-4 py-3 font-mono text-xs text-muted">{candidate.sourceCardId}</td>
                      <td className="px-4 py-3 font-mono text-xs text-muted">{candidate.pronunciationCardId}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className={`${reviewResetCandidates.length === 0 ? "hidden " : ""}order-3 overflow-hidden rounded-2xl border border-card bg-background xl:col-span-2`}>
          <div className="border-b border-card p-4">
            <h2 className="font-semibold text-foreground">Step 2 Results: Unknown Primary Cards</h2>
            <p className="mt-1 text-sm text-muted">Orange cards whose matching Review card has an interval over 10 years</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-card/50 text-xs text-muted">
                <tr>
                  <th className="whitespace-nowrap px-4 py-3">Word</th>
                  <th dir="rtl" className="whitespace-nowrap px-4 py-3 text-right">معنی فارسی</th>
                  <th className="whitespace-nowrap px-4 py-3">Review Interval</th>
                  <th className="whitespace-nowrap px-4 py-3">Source Deck</th>
                  <th className="whitespace-nowrap px-4 py-3">Source Card</th>
                  <th className="whitespace-nowrap px-4 py-3">Review Card</th>
                </tr>
              </thead>
              <tbody>
                {reviewResetCandidates.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-muted">
                      Step 2 has not been previewed yet, or no eligible cards were found.
                    </td>
                  </tr>
                ) : (
                  reviewResetCandidates.map((candidate) => (
                    <tr key={`${candidate.sourceCardId}-${candidate.reviewCardId}`} className="border-t border-card">
                      <td className="px-4 py-3 font-semibold text-foreground">{candidate.baseForm || "—"}</td>
                      <td dir="rtl" className="px-4 py-3 text-right text-foreground">{candidate.meaningFa || "—"}</td>
                      <td className="px-4 py-3 text-muted">{candidate.reviewInterval}</td>
                      <td className="px-4 py-3 text-muted">{candidate.sourceDeck}</td>
                      <td className="px-4 py-3 font-mono text-xs text-muted">{candidate.sourceCardId}</td>
                      <td className="px-4 py-3 font-mono text-xs text-muted">{candidate.reviewCardId}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {isPronunciationHelpOpen ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
            <div dir="rtl" lang="fa" className="w-full max-w-3xl rounded-3xl border border-card bg-card p-5 text-right shadow-2xl sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div><h2 className="text-lg font-bold text-foreground">راهنمای بررسی کارت‌های Pronunciation</h2><p className="mt-1 text-sm text-muted">Preview فقط گزارش می‌سازد؛ دکمهٔ اصلی تغییرات را در Anki ثبت می‌کند.</p></div>
                <button type="button" onClick={() => setIsPronunciationHelpOpen(false)} aria-label="بستن" className="grid size-10 shrink-0 place-items-center rounded-full border border-card bg-background text-xl text-muted">×</button>
              </div>
              <ol className="mt-5 list-inside list-decimal space-y-4 text-sm leading-7 text-foreground">
                <li><span className="font-semibold">بلد نبودن کارت صوت:</span> فقط کارت‌های بدون فلگ <span dir="ltr">{PRONUNCIATION_CARD_TEMPLATE}</span> که آخرین review آن‌ها <span dir="ltr">Again (ease=1)</span> و <span dir="ltr">ivl</span> آن‌ها بیشتر از ۳۶۵۰ روز است انتخاب می‌شوند. ابتدا <span dir="ltr">{REVIEW_PRONUNCIATION_CARD_TEMPLATE}</span> متناظر ریست و فقط پس از موفقیت، فلگ Orange روی Pronunciation ثبت می‌شود.</li>
                <li><span className="font-semibold">ریست کارت‌هایی با آخرین پاسخ Hard:</span> فقط کارت‌های غیر New از نوع <span dir="ltr">{PRONUNCIATION_CARD_TEMPLATE}</span> در خود دک <span dir="ltr">{PRONUNCIATION_DECK}</span> بررسی می‌شوند. اگر جدیدترین رکوردی که یک دکمهٔ واقعی مرور دارد <span dir="ltr">Hard (ease=2)</span> باشد، همان کارت Pronunciation ریست و به New برگردانده می‌شود؛ کارت‌های New و Hardهای قدیمی‌تر اثری ندارند.</li>
                <li><span className="font-semibold">اتمام مرور صوت:</span> کارت‌های <span dir="ltr">{PRONUNCIATION_CARD_TEMPLATE}</span> با فلگ Orange (کد ۲) از <span dir="ltr">{PRONUNCIATION_DECK}</span> انتخاب می‌شوند. اگر کارت متناظر <span dir="ltr">{REVIEW_PRONUNCIATION_CARD_TEMPLATE}</span> در <span dir="ltr">{REVIEW_PRONUNCIATION_DECK}</span> آخرین <span dir="ltr">ivl</span> بیشتر از ۳۶۵۰ روز داشته باشد، ابتدا Pronunciation ریست و فقط پس از موفقیت، فلگ Orange حذف می‌شود.</li>
              </ol>
              <p className="mt-4 rounded-xl border border-card bg-background p-3 text-sm leading-7 text-muted">قبل از اجرا، همهٔ شرایط و کارت‌های متناظر بررسی می‌شوند. در خطای عملیات اصلی فلگ تغییر نمی‌کند؛ اگر تغییر فلگ نیمه‌کاره بماند، فلگ‌های تغییرکرده به مقدار قبلی برمی‌گردند و مرحلهٔ خطادار گزارش می‌شود.</p>
            </div>
          </div>
        ) : null}

        {isHelpOpen ? (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
          >
            <div dir="rtl" lang="fa" className="w-full max-w-3xl rounded-3xl border border-card bg-card p-5 text-right shadow-2xl sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-foreground">راهنمای بررسی کارت‌ها</h2>
                  <p className="mt-1 text-sm text-muted">هر دکمه ابتدا Preview می‌سازد؛ دکمهٔ اصلی تغییرات را در Anki ثبت می‌کند.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsHelpOpen(false)}
                  aria-label="بستن"
                  className="grid size-10 shrink-0 place-items-center rounded-full border border-card bg-background text-xl text-muted"
                >
                  ×
                </button>
              </div>
              <ol className="mt-5 list-inside list-decimal space-y-4 text-sm leading-7 text-foreground">
                <li>
                  <span className="font-semibold">بلد نبودن صوت:</span>{" "}
                  کارت‌های <span dir="ltr">EnToFa</span>، <span dir="ltr">FaToEn</span> و <span dir="ltr">{FA_TO_EN_WITH_HELP_CARD_TEMPLATE}</span> در دک‌های متناظرشان با فلگ Purple (کد ۷) انتخاب می‌شوند. ابتدا روی کارت متناظر <span dir="ltr">{PRONUNCIATION_CARD_TEMPLATE}</span> در دک <span dir="ltr">{PRONUNCIATION_DECK}</span> یک بار <span dir="ltr">Again (ease=1)</span> ثبت می‌شود؛ فقط پس از موفقیت، فلگ بنفش حذف می‌شود.
                </li>
                <li>
                  <span className="font-semibold">بلد نبودن کارت‌های دک‌های اصلی:</span>{" "}
                  کارت‌های <span dir="ltr">EnToFa</span>، <span dir="ltr">FaToEn</span> و <span dir="ltr">{FA_TO_EN_WITH_HELP_CARD_TEMPLATE}</span> در دک‌های متناظرشان با فلگ Orange (کد ۲) بررسی می‌شوند. اگر کارت متناظر <span dir="ltr">{REVIEW_CARD_TEMPLATE}</span> در دک <span dir="ltr">{REVIEW_DECK}</span> آخرین <span dir="ltr">ivl</span> بیشتر از ۳۶۵۰ روز داشته باشد، ابتدا کارت‌های مبدا ریست و فقط پس از موفقیت، فلگ Orange آن‌ها حذف می‌شود.
                </li>
                <li>
                  <span className="font-semibold">ریست کارت‌هایی با آخرین پاسخ Hard:</span>{" "}
                  فقط تاریخچهٔ کارت‌های غیر New از نوع <span dir="ltr">EnToFa</span> در دک <span dir="ltr">{WordAnkiConstants.decks.EnToFa}</span>، نوع <span dir="ltr">FaToEn</span> در دک <span dir="ltr">{WordAnkiConstants.decks.FaToEn}</span> و نوع <span dir="ltr">{FA_TO_EN_WITH_HELP_CARD_TEMPLATE}</span> در دک <span dir="ltr">{FA_TO_EN_WITH_HELP_DECK}</span> بررسی می‌شود. اگر جدیدترین رکوردی که یک دکمهٔ واقعی مرور دارد <span dir="ltr">Hard (ease=2)</span> باشد، خود آن کارت ریست و به صف New برگردانده می‌شود. کارت‌های New و رکوردهای غیرِ دکمه‌ای در تعیین آخرین پاسخ نادیده گرفته می‌شوند.
                </li>
                <li>
                  <span className="font-semibold">اتمام مرور:</span>{" "}
                  فقط کارت‌های بدون فلگ از نوع <span dir="ltr">EnToFa</span>، <span dir="ltr">FaToEn</span> و <span dir="ltr">{FA_TO_EN_WITH_HELP_CARD_TEMPLATE}</span> در دک‌های متناظرشان انتخاب می‌شوند که آخرین review آن‌ها <span dir="ltr">Again (ease=1)</span> و <span dir="ltr">ivl</span> آن‌ها بیشتر از ۳۶۵۰ روز است. ابتدا کارت متناظر <span dir="ltr">{REVIEW_CARD_TEMPLATE}</span> ریست و فقط پس از موفقیت، فلگ Orange روی کارت مبدا ثبت می‌شود.
                </li>
              </ol>
              <p className="mt-4 rounded-xl border border-card bg-background p-3 text-sm leading-7 text-muted">
                قبل از اجرای هر گام، همهٔ شرایط و کارت‌های متناظر بررسی می‌شوند. اگر عملیات اصلی خطا بدهد، فلگ تغییر نمی‌کند؛ اگر تغییر فلگ نیمه‌کاره بماند، فلگ‌های تغییرکرده به مقدار قبلی برگردانده می‌شوند و گزارش مرحلهٔ خطادار نمایش داده می‌شود.
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}
