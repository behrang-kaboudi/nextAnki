"use client";

import { useState } from "react";

import { PageHeader } from "@/components/page-header";
import {
  ankiOperations,
  chunkArray,
  getLastRevlogByCardIds,
  WordAnkiConstants,
} from "@/lib/anki";

const BATCH_SIZE = 200;
const TEN_YEARS_IN_DAYS = 3650;
const ORANGE_FLAG = 2;
const REVIEW_CARD_TEMPLATE = "WordsForNewStudy-Review";
const REVIEW_DECK = "WordsForNewStudy::Review";
const PRONUNCIATION_CARD_TEMPLATE = "WordsForNewStudy-Pronunciation";
const PRONUNCIATION_DECK = "WordsForNewStudy::Pronunciation";
const REVIEW_PRONUNCIATION_CARD_TEMPLATE = "WordsForNewStudy-ReviewPronunciation";
const REVIEW_PRONUNCIATION_DECK = "WordsForNewStudy::ReviewPronunciation";
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

function escapeAnkiQueryValue(value: string) {
  return value.replaceAll('"', '\\"');
}

export default function CardTransferManagementClient() {
  const [running, setRunning] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [reviewResetCandidates, setReviewResetCandidates] = useState<ReviewResetCandidate[]>([]);
  const [reviewResetStatus, setReviewResetStatus] = useState<string | null>(null);
  const [reviewResetError, setReviewResetError] = useState<string | null>(null);
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
    const resetText = resetCount == null ? "" : ` | ریست‌شده: ${resetCount}`;
    return `کارت‌های بررسی‌شده: ${result.sourceCardsChecked} | interval بالای ۱۰ سال: ${result.longIntervalCards} | آخرین عمل Again: ${result.unknownCards} | کارت معادل پیدا‌شده: ${result.candidates.length}${resetText}`;
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
    const resetText = resetCount == null ? "" : ` | ریست‌شده: ${resetCount}`;
    return `کارت‌های مبدا با فلگ Orange: ${result.orangeSourceCards} | Review با interval بالای ۱۰ سال: ${result.reviewCardsOverTenYears} | کارت‌های مبدا قابل ریست: ${result.matchingSourceCards.length}${resetText}`;
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
    return `کارت‌های Pronunciation بررسی‌شده: ${result.sourceCardsChecked} | کارت متناظر پیدا‌شده: ${result.matchingCards.length}${actionText}`;
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
    const resetText = resetCount == null ? "" : ` | ریست‌شده: ${resetCount}`;
    return `کارت‌های مبدا با فلگ بنفش: ${result.purpleSourceCards} | کارت‌های Pronunciation متناظر: ${result.matchingPronunciationCards.length}${resetText}`;
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
    setPronunciationResetStatus("در حال استخراج کارت‌های Pronunciation؛ هیچ کارتی ریست نمی‌شود…");
    try {
      const result = await scanPronunciationResetCandidates();
      setPronunciationResetCandidates(result.matchingPronunciationCards);
      setPronunciationResetStatus(`Preview آماده است — ${formatPronunciationResetStatus(result)}`);
    } catch (caught) {
      setPronunciationResetCandidates([]);
      setPronunciationResetError(caught instanceof Error ? caught.message : "ارتباط با AnkiConnect ناموفق بود.");
      setPronunciationResetStatus(null);
    } finally {
      setPreviewLoading(false);
    }
  }

  async function resetMatchingPronunciationCards() {
    if (running || previewLoading) return;
    setRunning(true);
    setPronunciationResetError(null);
    setPronunciationResetStatus("در حال استخراج، برداشتن فلگ بنفش و ثبت Again برای کارت‌های Pronunciation…");
    let currentStage = "ثبت Again روی کارت‌های Pronunciation";
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
      currentStage = "برداشتن فلگ Purple کارت‌های مبدا";
      await updateCardFlagsWithRollback([...new Set(sourceCardIds)], 0, PURPLE_FLAG);
      setPronunciationResetStatus(
        `انجام شد — ${formatPronunciationResetStatus(result)} | Again روی Pronunciation: ${new Set(pronunciationCardIds).size} | فلگ بنفش برداشته‌شده از مبدا: ${new Set(sourceCardIds).size}`,
      );
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "ارتباط با AnkiConnect ناموفق بود.";
      setPronunciationResetError(`خطا در ${currentStage}: ${message}`);
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
    setReviewResetStatus("در حال استخراج کارت‌های متناظر؛ هیچ کارتی ریست نمی‌شود…");
    try {
      const result = await scanReviewResetCandidates();
      setReviewResetCandidates(result.matchingSourceCards);
      setReviewResetStatus(`Preview آماده است — ${formatReviewResetStatus(result)}`);
    } catch (caught) {
      setReviewResetCandidates([]);
      setReviewResetError(caught instanceof Error ? caught.message : "ارتباط با AnkiConnect ناموفق بود.");
      setReviewResetStatus(null);
    } finally {
      setPreviewLoading(false);
    }
  }

  async function resetMatchingSourceCards() {
    if (running || previewLoading) return;
    setRunning(true);
    setReviewResetError(null);
    setReviewResetStatus("در حال استخراج، ریست و برداشتن فلگ Orange کارت‌های مبدا…");
    let currentStage = "ریست کارت‌های مبدا";
    try {
      const result = await scanReviewResetCandidates();
      setReviewResetCandidates(result.matchingSourceCards);
      const sourceCardIds = [...new Set(result.matchingSourceCards.map((candidate) => candidate.sourceCardId))];
      await resetCardsToStudyQueue(sourceCardIds);
      currentStage = "برداشتن فلگ Orange کارت‌های مبدا";
      await updateCardFlagsWithRollback(sourceCardIds, 0, ORANGE_FLAG);
      setReviewResetStatus(`انجام شد — ${formatReviewResetStatus(result, sourceCardIds.length)}`);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "ارتباط با AnkiConnect ناموفق بود.";
      setReviewResetError(`خطا در ${currentStage}: ${message}`);
      setReviewResetStatus(null);
    } finally {
      setRunning(false);
    }
  }

  async function testReviewUnknownCards() {
    if (running || previewLoading) return;

    setPreviewLoading(true);
    setError(null);
    setStatus("در حال ساخت preview؛ هیچ کارتی ریست نمی‌شود…");
    try {
      const result = await scanCandidates();
      setCandidates(result.candidates);
      setStatus(`Preview آماده است — ${formatScanStatus(result)}`);
    } catch (caught) {
      setCandidates([]);
      setError(caught instanceof Error ? caught.message : "ارتباط با AnkiConnect ناموفق بود.");
      setStatus(null);
    } finally {
      setPreviewLoading(false);
    }
  }

  async function reviewUnknownCards() {
    if (running || previewLoading) return;

    setRunning(true);
    setError(null);
    setStatus("در حال بررسی، نارنجی‌کردن کارت‌های مبدا و ریست کارت‌های Review…");
    let currentStage = "ریست کارت‌های Review";
    try {
      const result = await scanCandidates();
      setCandidates(result.candidates);

      const sourceCardIds = [...new Set(result.candidates.map((candidate) => candidate.sourceCardId))];
      const reviewCardIds = [...new Set(result.candidates.map((candidate) => candidate.reviewCardId))];
      await resetCardsToStudyQueue(reviewCardIds);
      currentStage = "ثبت فلگ Orange روی کارت‌های مبدا";
      await updateCardFlagsWithRollback(sourceCardIds, ORANGE_FLAG, 0);

      setStatus(`انجام شد — ${formatScanStatus(result, reviewCardIds.length)} | فلگ Orange زده‌شده: ${sourceCardIds.length}`);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "ارتباط با AnkiConnect ناموفق بود.";
      setError(`خطا در ${currentStage}: ${message}`);
      setStatus(null);
    } finally {
      setRunning(false);
    }
  }

  async function previewPronunciationSourceCards(mode: "orange" | "again") {
    if (running || previewLoading) return;
    setPreviewLoading(true);
    setPronunciationSourceError(null);
    setPronunciationSourceStatus("در حال ساخت Preview؛ هیچ کارتی تغییر نمی‌کند…");
    try {
      const result = await scanPronunciationSourceCandidates(mode);
      setPronunciationSourceCandidates(result.matchingCards);
      setPronunciationSourceStatus(
        `Preview آماده است — ${formatPronunciationSourceStatus(result, "", undefined)}`,
      );
    } catch (caught) {
      setPronunciationSourceCandidates([]);
      setPronunciationSourceError(caught instanceof Error ? caught.message : "ارتباط با AnkiConnect ناموفق بود.");
      setPronunciationSourceStatus(null);
    } finally {
      setPreviewLoading(false);
    }
  }

  async function runPronunciationSourceOrangeStep() {
    if (running || previewLoading) return;
    setRunning(true);
    setPronunciationSourceError(null);
    setPronunciationSourceStatus("در حال بررسی و ریست کارت‌های Orange Pronunciation…");
    let currentStage = "ریست کارت‌های Pronunciation";
    try {
      const result = await scanPronunciationSourceCandidates("orange");
      setPronunciationSourceCandidates(result.matchingCards);
      const sourceCardIds = [...new Set(result.matchingCards.map((candidate) => candidate.sourceCardId))];
      await resetCardsToStudyQueue(sourceCardIds);
      currentStage = "برداشتن فلگ Orange کارت‌های Pronunciation";
      await updateCardFlagsWithRollback(sourceCardIds, 0, ORANGE_FLAG);
      setPronunciationSourceStatus(
        `انجام شد — ${formatPronunciationSourceStatus(result, "ریست‌شده", sourceCardIds.length)} | فلگ Orange برداشته‌شده: ${sourceCardIds.length}`,
      );
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "ارتباط با AnkiConnect ناموفق بود.";
      setPronunciationSourceError(`خطا در ${currentStage}: ${message}`);
      setPronunciationSourceStatus(null);
    } finally {
      setRunning(false);
    }
  }

  async function runPronunciationSourceAgainStep() {
    if (running || previewLoading) return;
    setRunning(true);
    setPronunciationSourceError(null);
    setPronunciationSourceStatus("در حال بررسی و ریست کارت‌های ReviewPronunciation…");
    let currentStage = "ریست کارت‌های ReviewPronunciation";
    try {
      const result = await scanPronunciationSourceCandidates("again");
      setPronunciationSourceCandidates(result.matchingCards);
      const sourceCardIds = [...new Set(result.matchingCards.map((candidate) => candidate.sourceCardId))];
      const reviewCardIds = [...new Set(result.matchingCards.map((candidate) => candidate.reviewCardId))];
      await resetCardsToStudyQueue(reviewCardIds);
      currentStage = "ثبت فلگ Orange روی کارت‌های Pronunciation";
      await updateCardFlagsWithRollback(sourceCardIds, ORANGE_FLAG, 0);
      setPronunciationSourceStatus(
        `انجام شد — ${formatPronunciationSourceStatus(result, "ReviewPronunciation ریست‌شده", reviewCardIds.length)} | فلگ Orange زده‌شده: ${sourceCardIds.length}`,
      );
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "ارتباط با AnkiConnect ناموفق بود.";
      setPronunciationSourceError(`خطا در ${currentStage}: ${message}`);
      setPronunciationSourceStatus(null);
    } finally {
      setRunning(false);
    }
  }

  async function runAllMainSteps() {
    if (running || previewLoading) return;
    setRunning(true);
    setMainRunAllError(null);
    setMainRunAllStatus("در حال اجرای گام‌های ۱ تا ۳…");
    let currentStep = "گام ۱: بلد نبودن صوت";
    const report: string[] = [];
    try {
      const stepOne = await scanPronunciationResetCandidates();
      const stepOneSourceIds = [...new Set(stepOne.matchingPronunciationCards.map((card) => card.sourceCardId))];
      const stepOnePronunciationIds = [...new Set(stepOne.matchingPronunciationCards.map((card) => card.pronunciationCardId))];
      for (const batch of chunkArray(stepOnePronunciationIds, BATCH_SIZE)) {
        const answerResponse = await ankiOperations.answerCards({ answers: batch.map((cardId) => ({ cardId, ease: 1 })) });
        if (!answerResponse.ok) throw new Error(answerResponse.error);
      }
      await updateCardFlagsWithRollback(stepOneSourceIds, 0, PURPLE_FLAG);
      report.push(`گام ۱: ${stepOnePronunciationIds.length} کارت صوت`);

      currentStep = "گام ۲: بلد نبودن کارت اصلی";
      const stepTwo = await scanReviewResetCandidates();
      const stepTwoSourceIds = [...new Set(stepTwo.matchingSourceCards.map((card) => card.sourceCardId))];
      await resetCardsToStudyQueue(stepTwoSourceIds);
      await updateCardFlagsWithRollback(stepTwoSourceIds, 0, ORANGE_FLAG);
      report.push(`گام ۲: ${stepTwoSourceIds.length} کارت اصلی`);

      currentStep = "گام ۳: اتمام مرور";
      const stepThree = await scanCandidates();
      const stepThreeReviewIds = [...new Set(stepThree.candidates.map((card) => card.reviewCardId))];
      const stepThreeSourceIds = [...new Set(stepThree.candidates.map((card) => card.sourceCardId))];
      await resetCardsToStudyQueue(stepThreeReviewIds);
      await updateCardFlagsWithRollback(stepThreeSourceIds, ORANGE_FLAG, 0);
      report.push(`گام ۳: ${stepThreeReviewIds.length} کارت Review`);
      setMainRunAllStatus(`انجام شد — ${report.join(" | ")}`);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "ارتباط با AnkiConnect ناموفق بود.";
      setMainRunAllError(`خطا در ${currentStep}: ${message}`);
      setMainRunAllStatus(null);
    } finally {
      setRunning(false);
    }
  }

  async function runAllPronunciationSteps() {
    if (running || previewLoading) return;
    setRunning(true);
    setPronunciationRunAllError(null);
    setPronunciationRunAllStatus("در حال اجرای گام‌های Pronunciation…");
    let currentStep = "گام ۱: بلد نبودن صوت";
    const report: string[] = [];
    try {
      const stepOne = await scanPronunciationSourceCandidates("again");
      const stepOneReviewIds = [...new Set(stepOne.matchingCards.map((card) => card.reviewCardId))];
      const stepOneSourceIds = [...new Set(stepOne.matchingCards.map((card) => card.sourceCardId))];
      await resetCardsToStudyQueue(stepOneReviewIds);
      await updateCardFlagsWithRollback(stepOneSourceIds, ORANGE_FLAG, 0);
      report.push(`گام ۱: ${stepOneReviewIds.length} کارت ReviewPronunciation`);

      currentStep = "گام ۲: اتمام مرور صوت";
      const stepTwo = await scanPronunciationSourceCandidates("orange");
      const stepTwoSourceIds = [...new Set(stepTwo.matchingCards.map((card) => card.sourceCardId))];
      await resetCardsToStudyQueue(stepTwoSourceIds);
      await updateCardFlagsWithRollback(stepTwoSourceIds, 0, ORANGE_FLAG);
      report.push(`گام ۲: ${stepTwoSourceIds.length} کارت صوت`);
      setPronunciationRunAllStatus(`انجام شد — ${report.join(" | ")}`);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "ارتباط با AnkiConnect ناموفق بود.";
      setPronunciationRunAllError(`خطا در ${currentStep}: ${message}`);
      setPronunciationRunAllStatus(null);
    } finally {
      setRunning(false);
    }
  }

  return (
    <main dir="rtl" className="mx-auto w-full max-w-6xl select-text p-4 text-right">
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="xl:col-span-2">
          <PageHeader
            title="Equivalent Card Reset"
            subtitle="بررسی مستقل کارت‌های اصلی و کارت‌های صوت"
          />
        </div>
        <section className="order-1 grid gap-3 rounded-2xl border border-card bg-background p-3 xl:col-span-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-foreground">بررسی کارت‌های EnToFa و FaToEn</h2>
              <p className="mt-1 text-xs text-muted">چرخهٔ کارت‌های اصلی و کارت‌های Review متناظر</p>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => void runAllMainSteps()} disabled={running || previewLoading} className="h-10 rounded-xl bg-[var(--primary)] px-3 text-xs font-bold text-[var(--primary-foreground)] disabled:opacity-60">
                {running ? "در حال اجرا…" : "انجام ۳ مرحله"}
              </button>
              <button type="button" onClick={() => setIsHelpOpen(true)} aria-label="راهنمای کارت‌های اصلی" className="grid size-10 shrink-0 place-items-center rounded-full border border-card bg-card text-lg font-bold text-foreground shadow-elevated">?</button>
            </div>
          </div>
          {mainRunAllError ? <p className="text-sm font-semibold text-red-700 dark:text-red-400">{mainRunAllError}</p> : null}
          {mainRunAllStatus ? <p className="rounded-xl border border-card bg-card p-3 text-sm text-foreground">{mainRunAllStatus}</p> : null}
          <div className="grid gap-3 md:grid-cols-2">
          <section className="grid gap-3 rounded-2xl border border-card bg-background p-3">
          <div>
            <h2 className="text-base font-semibold text-foreground">۱. بلد نبودن صوت</h2>
            <p className="mt-1 text-xs leading-5 text-muted">
              Purple (۷): Pronunciation متناظر یک بار Again می‌گیرد؛ سپس Purple حذف می‌شود.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => void testPronunciationResetCandidates()}
              disabled={running || previewLoading}
              className="h-11 rounded-xl border border-card px-4 text-sm font-semibold text-foreground disabled:opacity-60"
            >
              {previewLoading ? "در حال آماده‌سازی Preview…" : "Test / Preview"}
            </button>
            <button
              type="button"
              onClick={() => void resetMatchingPronunciationCards()}
              disabled={running || previewLoading}
              className="h-11 rounded-xl bg-[var(--primary)] px-4 text-sm font-semibold text-[var(--primary-foreground)] disabled:opacity-60"
            >
              {running ? "در حال انجام…" : "Again صوت"}
            </button>
          </div>
          {pronunciationResetError && <p className="text-sm font-semibold text-red-700 dark:text-red-400">{pronunciationResetError}</p>}
          {pronunciationResetStatus && <p className="rounded-xl border border-card p-3 text-sm text-foreground">{pronunciationResetStatus}</p>}
          </section>

          <section className="grid gap-3 rounded-2xl border border-card bg-background p-3">
          <div>
            <h2 className="text-base font-semibold text-foreground">۲. بلد نبودن کارت اصلی</h2>
            <p className="mt-1 text-xs leading-5 text-muted">
              Orange (۲): اگر Review متناظر <span dir="ltr">ivl &gt; 3650</span> دارد، کارت مبدا ریست و سپس فلگ حذف می‌شود.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => void testReviewResetCandidates()}
              disabled={running || previewLoading}
              className="h-11 rounded-xl border border-card px-4 text-sm font-semibold text-foreground disabled:opacity-60"
            >
              {previewLoading ? "در حال آماده‌سازی Preview…" : "Test / Preview"}
            </button>
            <button
              type="button"
              onClick={() => void resetMatchingSourceCards()}
              disabled={running || previewLoading}
              className="h-11 rounded-xl bg-[var(--primary)] px-4 text-sm font-semibold text-[var(--primary-foreground)] disabled:opacity-60"
            >
              {running ? "در حال ریست…" : "ریست Orange"}
            </button>
          </div>
          {reviewResetError && <p className="text-sm font-semibold text-red-700 dark:text-red-400">{reviewResetError}</p>}
          {reviewResetStatus && <p className="rounded-xl border border-card p-3 text-sm text-foreground">{reviewResetStatus}</p>}
          </section>

          <section className="grid gap-3 rounded-2xl border border-card bg-background p-3 md:col-span-2">
          <div>
            <h2 className="text-base font-semibold text-foreground">۳. اتمام مرور</h2>
            <p className="mt-1 text-xs leading-5 text-muted">
              بدون فلگ + Again + <span dir="ltr">ivl &gt; 3650</span>: Review ریست و سپس Orange ثبت می‌شود.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => void testReviewUnknownCards()}
              disabled={running || previewLoading}
              className="h-11 rounded-xl border border-card px-4 text-sm font-semibold text-foreground disabled:opacity-60"
            >
              {previewLoading ? "در حال آماده‌سازی Preview…" : "Test / Preview"}
            </button>
            <button
              type="button"
              onClick={() => void reviewUnknownCards()}
              disabled={running || previewLoading}
              className="h-11 min-w-0 rounded-xl bg-[var(--primary)] px-3 text-xs font-semibold leading-5 text-[var(--primary-foreground)] disabled:opacity-60"
            >
              {running ? "در حال انجام…" : "ریست مرور + Orange"}
            </button>
          </div>
          {error && <p className="text-sm font-semibold text-red-700 dark:text-red-400">{error}</p>}
          {status && <p className="rounded-xl border border-card p-3 text-sm text-foreground">{status}</p>}
          </section>
          </div>
        </section>

        <section className="order-2 grid gap-3 rounded-2xl border border-card bg-background p-3 xl:col-span-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-foreground">بررسی کارت‌های Pronunciation</h2>
              <p className="mt-1 text-xs text-muted">چرخهٔ Pronunciation و ReviewPronunciation</p>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => void runAllPronunciationSteps()} disabled={running || previewLoading} className="h-10 rounded-xl bg-[var(--primary)] px-3 text-xs font-bold text-[var(--primary-foreground)] disabled:opacity-60">
                {running ? "در حال اجرا…" : "انجام ۲ مرحله"}
              </button>
              <button type="button" onClick={() => setIsPronunciationHelpOpen(true)} aria-label="راهنمای کارت‌های Pronunciation" className="grid size-10 shrink-0 place-items-center rounded-full border border-card bg-card text-lg font-bold text-foreground shadow-elevated">?</button>
            </div>
          </div>
          {pronunciationRunAllError ? <p className="text-sm font-semibold text-red-700 dark:text-red-400">{pronunciationRunAllError}</p> : null}
          {pronunciationRunAllStatus ? <p className="rounded-xl border border-card bg-card p-3 text-sm text-foreground">{pronunciationRunAllStatus}</p> : null}
          <div className="grid gap-3">
            <section className="grid gap-3 rounded-2xl border border-card bg-card p-3">
              <div>
                <h3 className="text-base font-semibold text-foreground">۱. بلد نبودن صوت</h3>
                <p className="mt-1 text-xs leading-5 text-muted">بدون فلگ + Again + interval قدیمی: ریست ReviewPronunciation، سپس ثبت Orange.</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <button type="button" onClick={() => void previewPronunciationSourceCards("again")} disabled={running || previewLoading} className="h-11 rounded-xl border border-card px-4 text-sm font-semibold text-foreground disabled:opacity-60">
                  {previewLoading ? "در حال آماده‌سازی Preview…" : "Test / Preview"}
                </button>
                <button type="button" onClick={() => void runPronunciationSourceAgainStep()} disabled={running || previewLoading} className="h-11 rounded-xl bg-[var(--primary)] px-4 text-sm font-semibold text-[var(--primary-foreground)] disabled:opacity-60">
                  {running ? "در حال انجام…" : "ریست مرور + Orange"}
                </button>
              </div>
            </section>
            <section className="grid gap-3 rounded-2xl border border-card bg-card p-3">
              <div>
                <h3 className="text-base font-semibold text-foreground">۲. اتمام مرور صوت</h3>
                <p className="mt-1 text-xs leading-5 text-muted">Orange + ReviewPronunciation قدیمی: ریست Pronunciation، سپس حذف Orange.</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <button type="button" onClick={() => void previewPronunciationSourceCards("orange")} disabled={running || previewLoading} className="h-11 rounded-xl border border-card px-4 text-sm font-semibold text-foreground disabled:opacity-60">
                  {previewLoading ? "در حال آماده‌سازی Preview…" : "Test / Preview"}
                </button>
                <button type="button" onClick={() => void runPronunciationSourceOrangeStep()} disabled={running || previewLoading} className="h-11 rounded-xl bg-[var(--primary)] px-4 text-sm font-semibold text-[var(--primary-foreground)] disabled:opacity-60">
                  {running ? "در حال ریست…" : "ریست Orange"}
                </button>
              </div>
            </section>
          </div>
          {pronunciationSourceError ? <p className="text-sm font-semibold text-red-700 dark:text-red-400">{pronunciationSourceError}</p> : null}
          {pronunciationSourceStatus ? <p className="rounded-xl border border-card bg-card p-3 text-sm text-foreground">{pronunciationSourceStatus}</p> : null}
          {pronunciationSourceCandidates.length > 0 ? (
          <div className="overflow-x-auto rounded-xl border border-card bg-card">
            <table className="min-w-full text-right text-sm">
              <thead className="bg-background text-xs text-muted"><tr><th className="px-4 py-3">لغت</th><th className="px-4 py-3">معنی فارسی</th><th className="px-4 py-3">Source Interval</th><th className="px-4 py-3">ReviewPronunciation Interval</th><th className="px-4 py-3">Pronunciation Card</th><th className="px-4 py-3">ReviewPronunciation Card</th></tr></thead>
              <tbody>{pronunciationSourceCandidates.length === 0 ? <tr><td colSpan={6} className="px-4 py-8 text-center text-muted">هنوز Preview اجرا نشده یا کارت واجد شرایطی پیدا نشده است.</td></tr> : pronunciationSourceCandidates.map((candidate) => <tr key={`${candidate.sourceCardId}-${candidate.reviewCardId}`} className="border-t border-card"><td className="px-4 py-3 font-semibold text-foreground">{candidate.baseForm || "—"}</td><td className="px-4 py-3">{candidate.meaningFa || "—"}</td><td className="px-4 py-3 text-muted">{candidate.sourceInterval ?? "—"}</td><td className="px-4 py-3 text-muted">{candidate.reviewInterval ?? "—"}</td><td className="px-4 py-3 font-mono text-xs text-muted">{candidate.sourceCardId}</td><td className="px-4 py-3 font-mono text-xs text-muted">{candidate.reviewCardId}</td></tr>)}</tbody>
            </table>
          </div>
          ) : null}
        </section>

        <section className={`${candidates.length === 0 ? "hidden " : ""}order-4 overflow-hidden rounded-2xl border border-card bg-background xl:col-span-2`}>
          <div className="border-b border-card p-4">
            <h2 className="font-semibold text-foreground">نتیجهٔ گام ۳: اتمام مرور</h2>
            <p className="mt-1 text-sm text-muted">کارت‌های بدون فلگ Orange با Again و interval بالای ۱۰ سال و کارت Review متناظر</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-right text-sm">
              <thead className="bg-card/50 text-xs text-muted">
                <tr>
                  <th className="whitespace-nowrap px-4 py-3">لغت</th>
                  <th className="whitespace-nowrap px-4 py-3">معنی فارسی</th>
                  <th className="whitespace-nowrap px-4 py-3">دک مبدا</th>
                  <th className="whitespace-nowrap px-4 py-3">Interval</th>
                  <th className="whitespace-nowrap px-4 py-3">Source Card</th>
                  <th className="whitespace-nowrap px-4 py-3">Review Card</th>
                </tr>
              </thead>
              <tbody>
                {candidates.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-muted">
                      هنوز Preview اجرا نشده یا کارت واجد شرایطی پیدا نشده است.
                    </td>
                  </tr>
                ) : (
                  candidates.map((candidate) => (
                    <tr key={`${candidate.reviewCardId}-${candidate.sourceCardId}`} className="border-t border-card">
                      <td className="px-4 py-3 font-semibold text-foreground">{candidate.baseForm || "—"}</td>
                      <td className="px-4 py-3 text-foreground">{candidate.meaningFa || "—"}</td>
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
            <h2 className="font-semibold text-foreground">نتیجهٔ گام ۱: بلد نبودن صوت</h2>
            <p className="mt-1 text-sm text-muted">کارت‌های مبدا با فلگ بنفش و کارت Pronunciation متناظر آن‌ها</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-right text-sm">
              <thead className="bg-card/50 text-xs text-muted">
                <tr>
                  <th className="whitespace-nowrap px-4 py-3">لغت</th>
                  <th className="whitespace-nowrap px-4 py-3">معنی فارسی</th>
                  <th className="whitespace-nowrap px-4 py-3">دک مبدا</th>
                  <th className="whitespace-nowrap px-4 py-3">Source Card</th>
                  <th className="whitespace-nowrap px-4 py-3">Pronunciation Card</th>
                </tr>
              </thead>
              <tbody>
                {pronunciationResetCandidates.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted">
                      هنوز Preview گام اول اجرا نشده یا کارت واجد شرایطی پیدا نشده است.
                    </td>
                  </tr>
                ) : (
                  pronunciationResetCandidates.map((candidate) => (
                    <tr key={`${candidate.sourceCardId}-${candidate.pronunciationCardId}`} className="border-t border-card">
                      <td className="px-4 py-3 font-semibold text-foreground">{candidate.baseForm || "—"}</td>
                      <td className="px-4 py-3 text-foreground">{candidate.meaningFa || "—"}</td>
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
            <h2 className="font-semibold text-foreground">نتیجهٔ گام ۲: بلد نبودن کارت‌های دک‌های اصلی</h2>
            <p className="mt-1 text-sm text-muted">کارت‌های Orange که کارت Review متناظرشان interval بالای ۱۰ سال دارد</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-right text-sm">
              <thead className="bg-card/50 text-xs text-muted">
                <tr>
                  <th className="whitespace-nowrap px-4 py-3">لغت</th>
                  <th className="whitespace-nowrap px-4 py-3">معنی فارسی</th>
                  <th className="whitespace-nowrap px-4 py-3">Review Interval</th>
                  <th className="whitespace-nowrap px-4 py-3">دک مبدا</th>
                  <th className="whitespace-nowrap px-4 py-3">Source Card</th>
                  <th className="whitespace-nowrap px-4 py-3">Review Card</th>
                </tr>
              </thead>
              <tbody>
                {reviewResetCandidates.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-muted">
                      هنوز Preview گام دوم اجرا نشده یا کارت واجد شرایطی پیدا نشده است.
                    </td>
                  </tr>
                ) : (
                  reviewResetCandidates.map((candidate) => (
                    <tr key={`${candidate.sourceCardId}-${candidate.reviewCardId}`} className="border-t border-card">
                      <td className="px-4 py-3 font-semibold text-foreground">{candidate.baseForm || "—"}</td>
                      <td className="px-4 py-3 text-foreground">{candidate.meaningFa || "—"}</td>
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
            <div className="w-full max-w-3xl rounded-3xl border border-card bg-card p-5 shadow-2xl sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div><h2 className="text-lg font-bold text-foreground">راهنمای بررسی کارت‌های Pronunciation</h2><p className="mt-1 text-sm text-muted">Preview فقط گزارش می‌سازد؛ دکمهٔ اصلی تغییرات را در Anki ثبت می‌کند.</p></div>
                <button type="button" onClick={() => setIsPronunciationHelpOpen(false)} aria-label="بستن" className="grid size-10 shrink-0 place-items-center rounded-full border border-card bg-background text-xl text-muted">×</button>
              </div>
              <ol className="mt-5 list-inside list-decimal space-y-4 text-sm leading-7 text-foreground">
                <li><span className="font-semibold">بلد نبودن کارت صوت:</span> فقط کارت‌های بدون فلگ <span dir="ltr">{PRONUNCIATION_CARD_TEMPLATE}</span> که آخرین review آن‌ها <span dir="ltr">Again (ease=1)</span> و <span dir="ltr">ivl</span> آن‌ها بیشتر از ۳۶۵۰ روز است انتخاب می‌شوند. ابتدا <span dir="ltr">{REVIEW_PRONUNCIATION_CARD_TEMPLATE}</span> متناظر ریست و فقط پس از موفقیت، فلگ Orange روی Pronunciation ثبت می‌شود.</li>
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
            <div className="w-full max-w-3xl rounded-3xl border border-card bg-card p-5 shadow-2xl sm:p-6">
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
                  کارت‌های <span dir="ltr">EnToFa</span> و <span dir="ltr">FaToEn</span> با فلگ Purple (کد ۷) انتخاب می‌شوند. ابتدا روی کارت متناظر <span dir="ltr">{PRONUNCIATION_CARD_TEMPLATE}</span> در دک <span dir="ltr">{PRONUNCIATION_DECK}</span> یک بار <span dir="ltr">Again (ease=1)</span> ثبت می‌شود؛ فقط پس از موفقیت، فلگ بنفش حذف می‌شود.
                </li>
                <li>
                  <span className="font-semibold">بلد نبودن کارت‌های دک‌های اصلی:</span>{" "}
                  کارت‌های <span dir="ltr">EnToFa</span> و <span dir="ltr">FaToEn</span> با فلگ Orange (کد ۲) بررسی می‌شوند. اگر کارت متناظر <span dir="ltr">{REVIEW_CARD_TEMPLATE}</span> در دک <span dir="ltr">{REVIEW_DECK}</span> آخرین <span dir="ltr">ivl</span> بیشتر از ۳۶۵۰ روز داشته باشد، ابتدا کارت‌های مبدا ریست و فقط پس از موفقیت، فلگ Orange آن‌ها حذف می‌شود.
                </li>
                <li>
                  <span className="font-semibold">اتمام مرور:</span>{" "}
                  فقط کارت‌های بدون فلگ انتخاب می‌شوند که آخرین review آن‌ها <span dir="ltr">Again (ease=1)</span> و <span dir="ltr">ivl</span> آن‌ها بیشتر از ۳۶۵۰ روز است. ابتدا کارت متناظر <span dir="ltr">{REVIEW_CARD_TEMPLATE}</span> ریست و فقط پس از موفقیت، فلگ Orange روی کارت مبدا ثبت می‌شود.
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
