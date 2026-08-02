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
  const [isHelpOpen, setIsHelpOpen] = useState(false);

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

  return (
    <main dir="rtl" className="mx-auto w-full max-w-6xl select-text p-4 text-right">
      <div className="grid gap-4">
        <div className="flex items-start justify-between gap-3">
          <PageHeader
            title="بررسی کارت‌های EnToFa و FaToEn"
            subtitle="مدیریت کارت‌ها بر اساس فلگ و آخرین مرور"
          />
          <button
            type="button"
            onClick={() => setIsHelpOpen(true)}
            aria-label="راهنما"
            className="grid size-10 shrink-0 place-items-center rounded-full border border-card bg-card text-lg font-bold text-foreground shadow-elevated"
          >
            ?
          </button>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <section className="grid gap-4 rounded-2xl border border-card bg-background p-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">گام ۱. بلد نبودن صوت</h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              کارت‌های EN→FA و FA→EN با فلگ بنفش (کد ۷) پیدا می‌شوند. ابتدا روی کارت Pronunciation متناظر همان Note یک بار Again ثبت می‌شود؛ فقط پس از موفقیت، فلگ بنفش کارت مبدا حذف می‌شود.
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
              {running ? "در حال انجام…" : "Apply Again to Pronunciation"}
            </button>
          </div>
          {pronunciationResetError && <p className="text-sm font-semibold text-red-700 dark:text-red-400">{pronunciationResetError}</p>}
          {pronunciationResetStatus && <p className="rounded-xl border border-card p-3 text-sm text-foreground">{pronunciationResetStatus}</p>}
          </section>

          <section className="grid gap-4 rounded-2xl border border-card bg-background p-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">گام ۲. بلد نبودن کارت‌های دک‌های اصلی</h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              کارت‌های EnToFa و FaToEn با فلگ Orange (کد ۲) پیدا می‌شوند. اگر کارت Review متناظر همان Note آخرین interval بیشتر از ۱۰ سال داشته باشد، کارت‌های مبدا ریست می‌شوند؛ فقط پس از موفقیت، فلگ Orange آن‌ها حذف می‌شود.
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
              {running ? "در حال ریست…" : "Reset Orange Cards"}
            </button>
          </div>
          {reviewResetError && <p className="text-sm font-semibold text-red-700 dark:text-red-400">{reviewResetError}</p>}
          {reviewResetStatus && <p className="rounded-xl border border-card p-3 text-sm text-foreground">{reviewResetStatus}</p>}
          </section>

          <section className="grid gap-4 rounded-2xl border border-card bg-background p-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">گام ۳. اتمام مرور</h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              کارت‌های EnToFa و FaToEn بدون فلگ که آخرین مرورشان Again و interval آن‌ها بیشتر از ۱۰ سال است پیدا می‌شوند. ابتدا کارت Review متناظر همان Note ریست می‌شود؛ فقط پس از موفقیت، فلگ Orange روی کارت مبدا ثبت می‌شود.
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
              {running ? "در حال انجام…" : "Flag Orange & Reset Review"}
            </button>
          </div>
          {error && <p className="text-sm font-semibold text-red-700 dark:text-red-400">{error}</p>}
          {status && <p className="rounded-xl border border-card p-3 text-sm text-foreground">{status}</p>}
          </section>
        </div>

        <section className="order-4 overflow-hidden rounded-2xl border border-card bg-background">
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

        <section className="order-2 overflow-hidden rounded-2xl border border-card bg-background">
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

        <section className="order-3 overflow-hidden rounded-2xl border border-card bg-background">
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
