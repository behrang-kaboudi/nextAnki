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
const ONE_YEAR_IN_DAYS = 365;
const TEN_YEARS_IN_DAYS = 3650;
const REVIEW_CARD_TEMPLATE = "WordsForNewStudy-Review";
const REVIEW_DECK = "WordsForNewStudy::Review";
const PRONUNCIATION_CARD_TEMPLATE = "WordsForNewStudy-Pronunciation";
const PRONUNCIATION_DECK = "WordsForNewStudy::Pronunciation";
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
  sourceCardTemplate: string;
  sourceCardId: number;
  sourceInterval: number;
  noteId: number;
  baseForm: string;
  meaningFa: string;
};

type ReviewResetScanResult = {
  reviewCardsChecked: number;
  reviewCardsOverOneYear: number;
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

  async function scanCandidates(): Promise<ScanResult> {
    const allCandidates: Candidate[] = [];
    let sourceCardsChecked = 0;
    let longIntervalCards = 0;
    let unknownCards = 0;

    for (const source of SOURCE_CARDS) {
      const cardsResponse = await ankiOperations.findCards({
        query: `deck:"${escapeAnkiQueryValue(source.deck)}" card:"${escapeAnkiQueryValue(source.cardTemplate)}"`,
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
      const sourceByNoteId = new Map(unknownSourceCards.map((card) => [card.note, card]));

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
            const sourceCard = sourceByNoteId.get(reviewCard.note);
            const note = notesById.get(reviewCard.note);
            if (!sourceCard || !note) continue;

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
    const reviewCardsResponse = await ankiOperations.findCards({
      query: `deck:"${escapeAnkiQueryValue(REVIEW_DECK)}" card:"${escapeAnkiQueryValue(REVIEW_CARD_TEMPLATE)}"`,
    });
    if (!reviewCardsResponse.ok) throw new Error(reviewCardsResponse.error);

    const reviewCardIds = reviewCardsResponse.result ?? [];
    const reviewCards: Array<{ cardId: number; note: number }> = [];
    for (const batch of chunkArray(reviewCardIds, BATCH_SIZE)) {
      const infoResponse = await ankiOperations.cardsInfo({ cards: batch });
      if (!infoResponse.ok) throw new Error(infoResponse.error);
      reviewCards.push(...(infoResponse.result ?? []));
    }

    const reviewLastReviews = await getLastRevlogByCardIds(
      reviewCards.map((card) => card.cardId),
      BATCH_SIZE,
    );
    if (!reviewLastReviews.ok) throw new Error(reviewLastReviews.error);

    const eligibleReviewCards = reviewCards.filter((card) => {
      const lastReview = reviewLastReviews.value.get(card.cardId);
      return Number(lastReview?.ivl) > ONE_YEAR_IN_DAYS;
    });
    const noteIds = [...new Set(eligibleReviewCards.map((card) => card.note))];
    if (!noteIds.length) {
      return {
        reviewCardsChecked: reviewCards.length,
        reviewCardsOverOneYear: 0,
        matchingSourceCards: [],
      };
    }

    const notesResponse = await ankiOperations.notesInfo({ notes: noteIds });
    if (!notesResponse.ok) throw new Error(notesResponse.error);
    const notesById = new Map(
      (notesResponse.result ?? []).map((note) => [note.noteId, note]),
    );
    const reviewByNoteId = new Map(eligibleReviewCards.map((card) => [card.note, card]));
    const matchingSourceCards: ReviewResetCandidate[] = [];
    const seenSourceCardIds = new Set<number>();

    for (const source of SOURCE_CARDS) {
      const sourceCardIds: number[] = [];
      for (const noteBatch of chunkArray(noteIds, BATCH_SIZE)) {
        const noteQuery = noteBatch.map((noteId) => `nid:${noteId}`).join(" OR ");
        const sourceResponse = await ankiOperations.findCards({
          query: `deck:"${escapeAnkiQueryValue(source.deck)}" card:"${escapeAnkiQueryValue(source.cardTemplate)}" (${noteQuery})`,
        });
        if (!sourceResponse.ok) throw new Error(sourceResponse.error);
        sourceCardIds.push(...(sourceResponse.result ?? []));
      }

      const sourceCards: Array<{ cardId: number; note: number }> = [];
      for (const batch of chunkArray([...new Set(sourceCardIds)], BATCH_SIZE)) {
        const infoResponse = await ankiOperations.cardsInfo({ cards: batch });
        if (!infoResponse.ok) throw new Error(infoResponse.error);
        sourceCards.push(...(infoResponse.result ?? []));
      }
      const sourceLastReviews = await getLastRevlogByCardIds(
        sourceCards.map((card) => card.cardId),
        BATCH_SIZE,
      );
      if (!sourceLastReviews.ok) throw new Error(sourceLastReviews.error);

      for (const sourceCard of sourceCards) {
        const lastReview = sourceLastReviews.value.get(sourceCard.cardId);
        if (seenSourceCardIds.has(sourceCard.cardId)) continue;
        if (lastReview?.ease !== 1 || Number(lastReview.ivl) <= TEN_YEARS_IN_DAYS) continue;

        const reviewCard = reviewByNoteId.get(sourceCard.note);
        const note = notesById.get(sourceCard.note);
        if (!reviewCard || !note) continue;

        seenSourceCardIds.add(sourceCard.cardId);
        matchingSourceCards.push({
          reviewCardId: reviewCard.cardId,
          reviewInterval: Number(reviewLastReviews.value.get(reviewCard.cardId)?.ivl ?? 0),
          sourceDeck: source.deck,
          sourceCardTemplate: source.cardTemplate,
          sourceCardId: sourceCard.cardId,
          sourceInterval: Number(lastReview.ivl),
          noteId: sourceCard.note,
          baseForm: note.fields.base_form?.value ?? "",
          meaningFa: note.fields.meaning_fa?.value ?? "",
        });
      }
    }

    return {
      reviewCardsChecked: reviewCards.length,
      reviewCardsOverOneYear: eligibleReviewCards.length,
      matchingSourceCards,
    };
  }

  function formatReviewResetStatus(result: ReviewResetScanResult, resetCount?: number) {
    const resetText = resetCount == null ? "" : ` | ریست‌شده: ${resetCount}`;
    return `Review cards: ${result.reviewCardsChecked} | Review interval بالای ۱ سال: ${result.reviewCardsOverOneYear} | کارت‌های متناظر با Again و interval بالای ۱۰ سال: ${result.matchingSourceCards.length}${resetText}`;
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
    const sourceByNoteId = new Map(purpleSourceCards.map((card) => [card.note, card]));
    const matchingPronunciationCards: PronunciationResetCandidate[] = [];
    const seenPronunciationCardIds = new Set<number>();

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
          if (seenPronunciationCardIds.has(card.cardId)) continue;
          const sourceCard = sourceByNoteId.get(card.note);
          const note = notesById.get(card.note);
          if (!sourceCard || !note) continue;
          seenPronunciationCardIds.add(card.cardId);
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

    return {
      sourceCardsChecked: SOURCE_CARDS.length,
      purpleSourceCards: purpleSourceCards.length,
      matchingPronunciationCards,
    };
  }

  function formatPronunciationResetStatus(result: PronunciationResetScanResult, resetCount?: number) {
    const resetText = resetCount == null ? "" : ` | ریست‌شده: ${resetCount}`;
    return `کارت‌های مبدا با فلگ بنفش: ${result.purpleSourceCards} | کارت‌های Pronunciation متناظر: ${result.matchingPronunciationCards.length}${resetText}`;
  }

  async function clearCardFlags(cardIds: number[]) {
    for (const cardId of cardIds) {
      const response = await ankiOperations.setSpecificValueOfCard({
        card: cardId,
        keys: ["flags"],
        newValues: [0],
        warning_check: true,
      });
      if (!response.ok) throw new Error(response.error);
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
    setPronunciationResetStatus("در حال استخراج، ریست و برداشتن فلگ کارت‌های Pronunciation…");
    try {
      const result = await scanPronunciationResetCandidates();
      setPronunciationResetCandidates(result.matchingPronunciationCards);
      const pronunciationCardIds = result.matchingPronunciationCards.map((candidate) => candidate.pronunciationCardId);
      const sourceCardIds = result.matchingPronunciationCards.map((candidate) => candidate.sourceCardId);
      // Reset both groups: the source card may be a review card whose due date
      // is in the future, while its matching pronunciation card may already be
      // new. Forgetting both makes the source card available from today too.
      const cardsToReset = [...new Set([...sourceCardIds, ...pronunciationCardIds])];
      await resetCardsToStudyQueue(cardsToReset);
      // The purple flag belongs to the EN->FA / FA->EN source cards. The
      // pronunciation cards are reset, while both card groups are unflagged.
      await clearCardFlags(cardsToReset);
      setPronunciationResetStatus(
        `انجام شد — ${formatPronunciationResetStatus(result, cardsToReset.length)} | ریست مبدا: ${new Set(sourceCardIds).size} | ریست Pronunciation: ${new Set(pronunciationCardIds).size} | فلگ برداشته‌شده از مبدا: ${new Set(sourceCardIds).size}`,
      );
    } catch (caught) {
      setPronunciationResetError(caught instanceof Error ? caught.message : "ارتباط با AnkiConnect ناموفق بود.");
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
    setReviewResetStatus("در حال استخراج و ریست کارت‌های متناظر مبدا…");
    try {
      const result = await scanReviewResetCandidates();
      setReviewResetCandidates(result.matchingSourceCards);
      const sourceCardIds = result.matchingSourceCards.map((candidate) => candidate.sourceCardId);
      await resetCardsToStudyQueue(sourceCardIds);
      setReviewResetStatus(`انجام شد — ${formatReviewResetStatus(result, sourceCardIds.length)}`);
    } catch (caught) {
      setReviewResetError(caught instanceof Error ? caught.message : "ارتباط با AnkiConnect ناموفق بود.");
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
    setStatus("در حال بررسی کارت‌ها و ریست کارت‌های معادل…");
    try {
      const result = await scanCandidates();
      setCandidates(result.candidates);

      await resetCardsToStudyQueue(result.candidates.map((candidate) => candidate.reviewCardId));

      setStatus(`انجام شد — ${formatScanStatus(result, result.candidates.length)}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "ارتباط با AnkiConnect ناموفق بود.");
      setStatus(null);
    } finally {
      setRunning(false);
    }
  }

  return (
    <main dir="rtl" className="mx-auto w-full max-w-6xl select-text p-4 text-right">
      <div className="grid gap-4">
        <PageHeader
          title="Reset Manager"
          subtitle="بررسی و ریست کارت‌های متناظر"
        />
        <div className="grid gap-4 md:grid-cols-3">
          <section className="grid gap-4 rounded-2xl border border-card bg-background p-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">۱. ریست کارت‌های Review</h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              کارت‌های EnToFa و FaToEn با interval آخرین review بیشتر از ۱۰ سال بررسی می‌شوند. اگر آخرین عمل ثبت‌شده در تاریخچه‌ی مرور آن‌ها Again باشد، کارت WordsForNewStudy-Review همان Note در دک WordsForNewStudy::Review پیدا و بدون ثبت دوباره‌ی Again ریست می‌شود.
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
              className="h-11 rounded-xl bg-[var(--primary)] px-4 text-sm font-semibold text-[var(--primary-foreground)] disabled:opacity-60"
            >
              {running ? "در حال بررسی…" : "Review Unknown Cards"}
            </button>
          </div>
          {error && <p className="text-sm font-semibold text-red-700 dark:text-red-400">{error}</p>}
          {status && <p className="rounded-xl border border-card p-3 text-sm text-foreground">{status}</p>}
          </section>

          <section className="grid gap-4 rounded-2xl border border-card bg-background p-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">۲. ریست کارت‌های مبدا از روی Review</h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              کارت‌های WordsForNewStudy-Review در دک WordsForNewStudy::Review که interval آخرین review آن‌ها بیشتر از ۱ سال باشد استخراج می‌شوند. سپس کارت‌های متناظر FaToEn و EnToFa بررسی می‌شوند و فقط کارت‌هایی که آخرین review آن‌ها Again و interval آن بیشتر از ۱۰ سال باشد، در جدول نمایش داده و با دکمه‌ی اصلی ریست می‌شوند.
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
              {running ? "در حال ریست…" : "Reset Matching Cards"}
            </button>
          </div>
          {reviewResetError && <p className="text-sm font-semibold text-red-700 dark:text-red-400">{reviewResetError}</p>}
          {reviewResetStatus && <p className="rounded-xl border border-card p-3 text-sm text-foreground">{reviewResetStatus}</p>}
          </section>

          <section className="grid gap-4 rounded-2xl border border-card bg-background p-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">۳. ریست Pronunciation با فلگ بنفش</h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              کارت‌های EN→FA و FA→EN با فلگ بنفش پیدا می‌شوند. کارت مبدا و کارت Pronunciation متناظر همان Note هر دو ریست می‌شوند تا از امروز قابل مطالعه باشند و فلگ کارت مبدا برداشته می‌شود.
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
              className="h-11 min-w-0 rounded-xl bg-[var(--primary)] px-3 text-xs font-semibold leading-5 text-[var(--primary-foreground)] disabled:opacity-60"
            >
              {running ? "در حال ریست…" : "Reset Pronunciation"}
            </button>
          </div>
          {pronunciationResetError && <p className="text-sm font-semibold text-red-700 dark:text-red-400">{pronunciationResetError}</p>}
          {pronunciationResetStatus && <p className="rounded-xl border border-card p-3 text-sm text-foreground">{pronunciationResetStatus}</p>}
          </section>
        </div>

        <section className="overflow-hidden rounded-2xl border border-card bg-background">
          <div className="border-b border-card p-4">
            <h2 className="font-semibold text-foreground">کارت‌های یافت‌شده برای انتقال/ریست</h2>
            <p className="mt-1 text-sm text-muted">نتیجه‌ی دک‌های WordsForNewStudy::FaToEn و WordsForNewStudy::EnToFa</p>
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

        <section className="overflow-hidden rounded-2xl border border-card bg-background">
          <div className="border-b border-card p-4">
            <h2 className="font-semibold text-foreground">کارت‌های متناظر Pronunciation</h2>
            <p className="mt-1 text-sm text-muted">نتیجه‌ی کارت‌های مبدا با فلگ بنفش و کارت Pronunciation متناظر آن‌ها</p>
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
                      هنوز Preview بخش سوم اجرا نشده یا کارت واجد شرایطی پیدا نشده است.
                    </td>
                  </tr>
                ) : (
                  pronunciationResetCandidates.map((candidate) => (
                    <tr key={candidate.pronunciationCardId} className="border-t border-card">
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

        <section className="overflow-hidden rounded-2xl border border-card bg-background">
          <div className="border-b border-card p-4">
            <h2 className="font-semibold text-foreground">کارت‌های متناظر بخش دوم</h2>
            <p className="mt-1 text-sm text-muted">کارت‌های مبدا که با شرایط آخرین review و interval بالای ۱۰ سال مطابقت دارند</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-right text-sm">
              <thead className="bg-card/50 text-xs text-muted">
                <tr>
                  <th className="whitespace-nowrap px-4 py-3">لغت</th>
                  <th className="whitespace-nowrap px-4 py-3">معنی فارسی</th>
                  <th className="whitespace-nowrap px-4 py-3">Review Interval</th>
                  <th className="whitespace-nowrap px-4 py-3">دک مبدا</th>
                  <th className="whitespace-nowrap px-4 py-3">نوع کارت</th>
                  <th className="whitespace-nowrap px-4 py-3">Source Interval</th>
                  <th className="whitespace-nowrap px-4 py-3">Source Card</th>
                  <th className="whitespace-nowrap px-4 py-3">Review Card</th>
                </tr>
              </thead>
              <tbody>
                {reviewResetCandidates.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-muted">
                      هنوز Preview بخش دوم اجرا نشده یا کارت واجد شرایطی پیدا نشده است.
                    </td>
                  </tr>
                ) : (
                  reviewResetCandidates.map((candidate) => (
                    <tr key={`${candidate.sourceCardId}-${candidate.reviewCardId}`} className="border-t border-card">
                      <td className="px-4 py-3 font-semibold text-foreground">{candidate.baseForm || "—"}</td>
                      <td className="px-4 py-3 text-foreground">{candidate.meaningFa || "—"}</td>
                      <td className="px-4 py-3 text-muted">{candidate.reviewInterval}</td>
                      <td className="px-4 py-3 text-muted">{candidate.sourceDeck}</td>
                      <td className="px-4 py-3 text-muted">{candidate.sourceCardTemplate}</td>
                      <td className="px-4 py-3 text-muted">{candidate.sourceInterval}</td>
                      <td className="px-4 py-3 font-mono text-xs text-muted">{candidate.sourceCardId}</td>
                      <td className="px-4 py-3 font-mono text-xs text-muted">{candidate.reviewCardId}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
