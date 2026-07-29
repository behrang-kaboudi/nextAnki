"use client";

import { useState } from "react";

import { PageHeader } from "@/components/page-header";
import {
  AnkiTag,
  ankiOperations,
  chunkArray,
  quoteAnkiSearchValue,
  WordAnkiConstants,
  type AnkiActionResult,
} from "@/lib/anki";

const BATCH_SIZE = 200;
const REVIEW_DECK = "WordsForNewStudy::Review";
const REVIEW_FILTER_CARD = WordAnkiConstants.cardTypes.EnToFaKnowingFilter;
const REVIEW_FILTER_DECK = WordAnkiConstants.decks.EnToFaKnowingFilter;

const MIGRATION_DIRECTIONS = [
  {
    sourceCard: WordAnkiConstants.cardTypes.EnToFa,
    sourceDeck: WordAnkiConstants.decks.EnToFa,
    filterCard: WordAnkiConstants.cardTypes.EnToFaKnowingFilter,
    filterDeck: WordAnkiConstants.decks.EnToFaKnowingFilter,
  },
  {
    sourceCard: WordAnkiConstants.cardTypes.FaToEn,
    sourceDeck: WordAnkiConstants.decks.FaToEn,
    filterCard: WordAnkiConstants.cardTypes.FaToEnKnowingFilter,
    filterDeck: WordAnkiConstants.decks.FaToEnKnowingFilter,
  },
] as const;

const REVIEW_BOOST_DIRECTIONS = [
  {
    sourceCard: WordAnkiConstants.cardTypes.EnToFa,
    sourceDeck: WordAnkiConstants.decks.EnToFa,
    reviewCard: WordAnkiConstants.cardTypes.EnToFaRev,
    reviewDeck: WordAnkiConstants.decks.EnToFaRev,
  },
  {
    sourceCard: WordAnkiConstants.cardTypes.FaToEn,
    sourceDeck: WordAnkiConstants.decks.FaToEn,
    reviewCard: WordAnkiConstants.cardTypes.FaToEnRev,
    reviewDeck: WordAnkiConstants.decks.FaToEnRev,
  },
] as const;

type MigrationDirection = (typeof MIGRATION_DIRECTIONS)[number];
type ReviewBoostDirection = (typeof REVIEW_BOOST_DIRECTIONS)[number];
type CardInfo = AnkiActionResult<"cardsInfo">[number];
type ReviewsByCard = AnkiActionResult<"getReviewsOfCards">;

type DirectionResult = {
  sourceCard: MigrationDirection["sourceCard"];
  sourceCards: number;
  filterCardsMoved: number;
  notesTaggedFiltered: number;
  newCardsMovedToTemp: number;
  missingFilterCards: number;
};

type EasyBoostResult = {
  sourceCard: ReviewBoostDirection["sourceCard"];
  sourceReviewCards: number;
  matchingReviewCards: number;
  cardsBoosted: number;
  totalEasyAnswers: number;
  missingReviewCards: number;
};

type ReviewDeckEasyResult = {
  deck: string;
  cardsFound: number;
  easyAnswers: number;
};

type ReviewFilterTagResult = {
  sourceCards: number;
  matchingFilterCards: number;
  taggedNotes: number;
  missingFilterCards: number;
};

type ReviewSnapshot = {
  count: number;
  lastReviewId: number;
  lastEase: number | null;
};

function isNewCard(card: CardInfo) {
  return card.type === 0;
}

function isReviewPhaseCard(card: CardInfo) {
  return card.type === 2 || card.queue === 2;
}

function randomEasyPasses() {
  return Math.floor(Math.random() * 3) + 1;
}

async function findCards(query: string) {
  const response = await ankiOperations.findCards({ query });
  if (!response.ok) throw new Error(response.error);
  if (!Array.isArray(response.result)) {
    throw new Error("AnkiConnect returned an invalid findCards result.");
  }
  return response.result;
}

async function loadCardsInfo(cardIds: number[]) {
  const cards: CardInfo[] = [];
  for (const batch of chunkArray(cardIds, BATCH_SIZE)) {
    const response = await ankiOperations.cardsInfo({ cards: batch });
    if (!response.ok) throw new Error(response.error);
    if (!Array.isArray(response.result)) {
      throw new Error("AnkiConnect returned an invalid cardsInfo result.");
    }
    cards.push(...response.result);
  }
  return cards;
}

async function findCardsForNotes(
  noteIds: number[],
  cardType: string,
  deck?: string,
) {
  const cardIds = new Set<number>();

  for (const batch of chunkArray(
    Array.from(new Set(noteIds)),
    BATCH_SIZE,
  )) {
    const noteQuery = batch.map((noteId) => `nid:${noteId}`).join(" OR ");
    const deckQuery = deck
      ? ` deck:${quoteAnkiSearchValue(deck)}`
      : "";
    const matchingIds = await findCards(
      `(${noteQuery}) card:${quoteAnkiSearchValue(cardType)}${deckQuery}`,
    );
    for (const cardId of matchingIds) cardIds.add(cardId);
  }

  return Array.from(cardIds);
}

async function moveCards(cardIds: number[], deck: string) {
  for (const batch of chunkArray(cardIds, BATCH_SIZE)) {
    const response = await ankiOperations.changeDeck({ cards: batch, deck });
    if (!response.ok) throw new Error(response.error);
  }
}

async function tagNotes(noteIds: number[]) {
  for (const batch of chunkArray(
    Array.from(new Set(noteIds)),
    BATCH_SIZE,
  )) {
    const response = await ankiOperations.addTags({
      notes: batch,
      tags: AnkiTag.Filtered,
    });
    if (!response.ok) throw new Error(response.error);
  }
}

async function answerCards(cardIds: number[], ease: 1 | 2 | 3 | 4) {
  for (const batch of chunkArray(cardIds, BATCH_SIZE)) {
    const response = await ankiOperations.answerCards({
      answers: batch.map((cardId) => ({ cardId, ease })),
    });
    if (!response.ok) throw new Error(response.error);
  }
}

async function loadReviewSnapshots(cardIds: number[]) {
  const snapshots = new Map<number, ReviewSnapshot>();

  for (const batch of chunkArray(cardIds, BATCH_SIZE)) {
    const response = await ankiOperations.getReviewsOfCards({ cards: batch });
    if (!response.ok) throw new Error(response.error);

    const reviewsByCard = (response.result ?? {}) as ReviewsByCard;
    for (const cardId of batch) {
      const reviews = reviewsByCard[String(cardId)] ?? [];
      const lastReview = reviews.reduce<ReviewsByCard[string][number] | null>(
        (latest, review) =>
          latest === null || review.id > latest.id ? review : latest,
        null,
      );

      snapshots.set(cardId, {
        count: reviews.length,
        lastReviewId: lastReview?.id ?? 0,
        lastEase: lastReview?.ease ?? null,
      });
    }
  }

  return snapshots;
}

async function confirmAnswerApplied(
  cardIds: number[],
  previousSnapshots: Map<number, ReviewSnapshot>,
  ease: 1 | 2 | 3 | 4,
) {
  let pendingCardIds = [...cardIds];

  for (let attempt = 0; attempt < 5 && pendingCardIds.length > 0; attempt += 1) {
    const currentSnapshots = await loadReviewSnapshots(pendingCardIds);
    pendingCardIds = pendingCardIds.filter((cardId) => {
      const previous = previousSnapshots.get(cardId);
      const current = currentSnapshots.get(cardId);

      if (!previous || !current) return true;
      return !(
        current.count > previous.count &&
        current.lastReviewId > previous.lastReviewId &&
        current.lastEase === ease
      );
    });
  }

  if (pendingCardIds.length > 0) {
    throw new Error(
      `Anki did not confirm the Easy answer for cardIds: ${pendingCardIds.join(", ")}`,
    );
  }
}

async function applyRandomEasyAnswers(cardIds: number[]) {
  const easyPassesByCardId = new Map(
    cardIds.map((cardId) => [cardId, randomEasyPasses()]),
  );
  let totalEasyAnswers = 0;

  for (let round = 1; round <= 3; round += 1) {
    const roundCardIds = cardIds.filter(
      (cardId) => (easyPassesByCardId.get(cardId) ?? 0) >= round,
    );
    if (roundCardIds.length === 0) continue;

    const previousSnapshots = await loadReviewSnapshots(roundCardIds);
    await answerCards(roundCardIds, 4);
    await confirmAnswerApplied(roundCardIds, previousSnapshots, 4);
    totalEasyAnswers += roundCardIds.length;
  }

  return {
    cardsBoosted: cardIds.length,
    totalEasyAnswers,
  };
}

async function applyOneEasyAnswerToReviewDeck() {
  const cardIds = await findCards(`deck:${quoteAnkiSearchValue(REVIEW_DECK)}`);
  if (!cardIds.length) {
    return { deck: REVIEW_DECK, cardsFound: 0, easyAnswers: 0 } satisfies ReviewDeckEasyResult;
  }

  const previousSnapshots = await loadReviewSnapshots(cardIds);
  await answerCards(cardIds, 4);
  await confirmAnswerApplied(cardIds, previousSnapshots, 4);

  return {
    deck: REVIEW_DECK,
    cardsFound: cardIds.length,
    easyAnswers: cardIds.length,
  } satisfies ReviewDeckEasyResult;
}

async function tagReviewFilterNotes() {
  const sourceCardIds = await findCards(`deck:${quoteAnkiSearchValue(REVIEW_DECK)}`);
  const sourceCards = await loadCardsInfo(sourceCardIds);
  const sourceNoteIds = Array.from(new Set(sourceCards.map((card) => card.note)));
  const filterCardIds = await findCardsForNotes(
    sourceNoteIds,
    REVIEW_FILTER_CARD,
    REVIEW_FILTER_DECK,
  );
  const filterCards = await loadCardsInfo(filterCardIds);
  const filterNoteIds = Array.from(new Set(filterCards.map((card) => card.note)));

  if (filterNoteIds.length > 0) {
    await tagNotes(filterNoteIds);
  }

  return {
    sourceCards: sourceCards.length,
    matchingFilterCards: filterCards.length,
    taggedNotes: filterNoteIds.length,
    missingFilterCards: Math.max(sourceNoteIds.length - filterNoteIds.length, 0),
  } satisfies ReviewFilterTagResult;
}

async function prepareDirection(direction: MigrationDirection) {
  const sourceCardIds = await findCards(
    `deck:${quoteAnkiSearchValue(direction.sourceDeck)} card:${quoteAnkiSearchValue(direction.sourceCard)}`,
  );
  const sourceCards = await loadCardsInfo(sourceCardIds);
  const noteIds = sourceCards.map((card) => card.note);
  const filterCardIds = await findCardsForNotes(
    noteIds,
    direction.filterCard,
  );
  const filterCards = await loadCardsInfo(filterCardIds);
  const filterNoteIds = new Set(filterCards.map((card) => card.note));

  return {
    direction,
    sourceCards,
    filterCardIds,
    studiedNoteIds: Array.from(
      new Set(
        sourceCards
          .filter((card) => !isNewCard(card) && filterNoteIds.has(card.note))
          .map((card) => card.note),
      ),
    ),
    newSourceCardIds: sourceCards
      .filter(isNewCard)
      .map((card) => card.cardId),
    missingFilterCards: new Set(
      noteIds.filter((noteId) => !filterNoteIds.has(noteId)),
    ).size,
  };
}

async function runReviewBoostForDirection(direction: ReviewBoostDirection) {
  const sourceCardIds = await findCards(
    `deck:${quoteAnkiSearchValue(direction.sourceDeck)} card:${quoteAnkiSearchValue(direction.sourceCard)}`,
  );
  const sourceCards = await loadCardsInfo(sourceCardIds);
  const sourceReviewCards = sourceCards.filter(isReviewPhaseCard);
  const sourceReviewNoteIds = sourceReviewCards.map((card) => card.note);
  const reviewCardIds = await findCardsForNotes(
    sourceReviewNoteIds,
    direction.reviewCard,
    direction.reviewDeck,
  );
  const reviewCards = await loadCardsInfo(reviewCardIds);
  const reviewNoteIds = new Set(reviewCards.map((card) => card.note));

  const boostResult =
    reviewCardIds.length > 0
      ? await applyRandomEasyAnswers(reviewCardIds)
      : { cardsBoosted: 0, totalEasyAnswers: 0 };

  return {
    sourceCard: direction.sourceCard,
    sourceReviewCards: sourceReviewCards.length,
    matchingReviewCards: reviewCardIds.length,
    cardsBoosted: boostResult.cardsBoosted,
    totalEasyAnswers: boostResult.totalEasyAnswers,
    missingReviewCards: new Set(
      sourceReviewNoteIds.filter((noteId) => !reviewNoteIds.has(noteId)),
    ).size,
  };
}

export default function AnkiMigrationClient() {
  const [isRunning, setIsRunning] = useState(false);
  const [activeJob, setActiveJob] = useState<"migration" | "reviewBoost" | "reviewDeckEasy" | "reviewFilterTag" | null>(null);
  const [status, setStatus] = useState("Ready to run.");
  const [error, setError] = useState<string | null>(null);
  const [migrationResults, setMigrationResults] = useState<DirectionResult[]>([]);
  const [easyBoostResults, setEasyBoostResults] = useState<EasyBoostResult[]>([]);
  const [reviewDeckEasyResult, setReviewDeckEasyResult] = useState<ReviewDeckEasyResult | null>(null);
  const [reviewFilterTagResult, setReviewFilterTagResult] = useState<ReviewFilterTagResult | null>(null);

  async function runMigration() {
    if (isRunning) return;

    setIsRunning(true);
  setActiveJob("migration");
    setError(null);
    setMigrationResults([]);
    setEasyBoostResults([]);
    setReviewDeckEasyResult(null);
    setReviewFilterTagResult(null);

    try {
      setStatus("Reading source cards and locating corresponding filter cards…");
      const preparedDirections = [];
      for (const direction of MIGRATION_DIRECTIONS) {
        preparedDirections.push(await prepareDirection(direction));
      }

      setStatus("Moving corresponding filter cards to their study decks…");
      for (const prepared of preparedDirections) {
        await moveCards(
          prepared.filterCardIds,
          prepared.direction.filterDeck,
        );
      }

      setStatus(`Applying the ${AnkiTag.Filtered} tag to studied notes…`);
      for (const prepared of preparedDirections) {
        await tagNotes(prepared.studiedNoteIds);
      }

      setStatus(
        `Moving new source cards to ${WordAnkiConstants.decks.tempRoot}…`,
      );
      for (const prepared of preparedDirections) {
        await moveCards(
          prepared.newSourceCardIds,
          WordAnkiConstants.decks.tempRoot,
        );
      }

      setMigrationResults(
        preparedDirections.map((prepared) => ({
          sourceCard: prepared.direction.sourceCard,
          sourceCards: prepared.sourceCards.length,
          filterCardsMoved: prepared.filterCardIds.length,
          notesTaggedFiltered: prepared.studiedNoteIds.length,
          newCardsMovedToTemp: prepared.newSourceCardIds.length,
          missingFilterCards: prepared.missingFilterCards,
        })),
      );
      setStatus("Migration completed.");
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "The migration failed.",
      );
      setStatus("Migration stopped.");
    } finally {
      setIsRunning(false);
      setActiveJob(null);
    }
  }

  async function runReviewBoost() {
    if (isRunning) return;

    setIsRunning(true);
  setActiveJob("reviewBoost");
    setError(null);
    setMigrationResults([]);
    setEasyBoostResults([]);
    setReviewDeckEasyResult(null);
    setReviewFilterTagResult(null);

    try {
      setStatus("Finding source cards that have entered review…");
      const results: EasyBoostResult[] = [];

      for (const direction of REVIEW_BOOST_DIRECTIONS) {
        setStatus(
          `Applying 1 to 3 random Easy answers to ${direction.reviewCard} cards…`,
        );
        results.push(await runReviewBoostForDirection(direction));
      }

      setEasyBoostResults(results);
      setStatus("Random Easy review boost completed.");
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "The review boost failed.",
      );
      setStatus("Review boost stopped.");
    } finally {
      setIsRunning(false);
      setActiveJob(null);
    }
  }

  async function runReviewDeckEasy() {
    if (isRunning) return;

    setIsRunning(true);
    setActiveJob("reviewDeckEasy");
    setError(null);
    setMigrationResults([]);
    setEasyBoostResults([]);
    setReviewDeckEasyResult(null);
    setReviewFilterTagResult(null);

    try {
      setStatus(`Finding all cards in ${REVIEW_DECK}…`);
      const result = await applyOneEasyAnswerToReviewDeck();
      setReviewDeckEasyResult(result);
      setStatus(
        result.cardsFound
          ? `Easy was answered once for all ${result.cardsFound} cards in ${REVIEW_DECK}.`
          : `No cards were found in ${REVIEW_DECK}.`,
      );
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "The Review deck Easy action failed.",
      );
      setStatus("Review deck Easy action stopped.");
    } finally {
      setIsRunning(false);
      setActiveJob(null);
    }
  }

  async function runReviewFilterTag() {
    if (isRunning) return;

    setIsRunning(true);
    setActiveJob("reviewFilterTag");
    setError(null);
    setMigrationResults([]);
    setEasyBoostResults([]);
    setReviewDeckEasyResult(null);
    setReviewFilterTagResult(null);

    try {
      setStatus(`Finding ${REVIEW_FILTER_CARD} cards for notes in ${REVIEW_DECK}…`);
      const result = await tagReviewFilterNotes();
      setReviewFilterTagResult(result);
      setStatus(
        result.taggedNotes
          ? `The ${AnkiTag.Filtered} tag was added to ${result.taggedNotes} matching notes.`
          : `No matching ${REVIEW_FILTER_CARD} cards were found.`,
      );
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "The Review filter tagging action failed.",
      );
      setStatus("Review filter tagging stopped.");
    } finally {
      setIsRunning(false);
      setActiveJob(null);
    }
  }

  return (
    <main className="mx-auto w-full max-w-5xl select-text p-4">
      <div className="grid gap-8">
        <PageHeader
          title="Anki Migration"
          subtitle="Move knowing-filter cards, mark studied notes, and return new source cards to the temporary deck."
        />

        <section className="rounded-2xl border border-card bg-card shadow-elevated">
          <div className="border-b border-card px-5 py-4">
            <h2 className="text-lg font-semibold text-foreground">
              Knowing Filter Migration
            </h2>
            <p className="mt-1 text-sm leading-6 text-muted">
              Runs the EnToFa and FaToEn migration in a safe, fixed order.
            </p>
          </div>

          <div className="grid gap-5 p-5">
            <ol className="grid list-decimal gap-2 pl-5 text-sm leading-6 text-muted">
              <li>Find source cards and their corresponding filter cards.</li>
              <li>Move filter cards to the matching knowing-filter decks.</li>
              <li>
                Add the <code>{AnkiTag.Filtered}</code> tag when the source card
                is in learning or review.
              </li>
              <li>
                Move new source cards to{" "}
                <code>{WordAnkiConstants.decks.tempRoot}</code>.
              </li>
            </ol>

            <div>
              <button
                type="button"
                onClick={() => void runMigration()}
                disabled={isRunning}
                className="h-11 rounded-xl bg-[var(--primary)] px-5 text-sm font-semibold text-[var(--primary-foreground)] shadow-elevated transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {activeJob === "migration" ? "Running migration…" : "Run Migration"}
              </button>
            </div>

            <div className="grid gap-3 rounded-2xl border border-card/70 bg-background/60 p-4">
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  Review-Phase Easy Boost
                </h3>
                <p className="mt-1 text-sm leading-6 text-muted">
                  Finds source cards that are already in review, loads their
                  matching review cards from the dedicated review decks, then
                  presses Easy 1 to 3 times per card. Each round waits for a
                  revlog confirmation before the next Easy press starts.
                </p>
              </div>

              <div>
                <button
                  type="button"
                  onClick={() => void runReviewBoost()}
                  disabled={isRunning}
                  className="h-11 rounded-xl border border-card bg-background px-5 text-sm font-semibold text-foreground shadow-elevated transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {activeJob === "reviewBoost"
                    ? "Running review boost…"
                    : "Boost Review Cards"}
                </button>
              </div>
            </div>

            <div className="grid gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  ثبت «راحت» برای دک Review
                </h3>
                <p className="mt-1 text-sm leading-6 text-muted">
                  همه کارت‌های دک <code>{REVIEW_DECK}</code> را پیدا می‌کند و برای هر کارت دقیقاً یک‌بار پاسخ Easy ثبت می‌کند.
                </p>
              </div>

              <div>
                <button
                  type="button"
                  onClick={() => void runReviewDeckEasy()}
                  disabled={isRunning}
                  className="h-11 rounded-xl border border-amber-600/40 bg-background px-5 text-sm font-semibold text-amber-800 shadow-elevated transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {activeJob === "reviewDeckEasy"
                    ? "در حال ثبت پاسخ راحت…"
                    : "یک‌بار زدن «راحت» برای همه کارت‌ها"}
                </button>
              </div>
            </div>

            <div className="grid gap-3 rounded-2xl border border-blue-500/30 bg-blue-500/5 p-4">
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  تگ‌گذاری Filtered برای کارت‌های معادل
                </h3>
                <p className="mt-1 text-sm leading-6 text-muted">
                  کارت‌های دک <code>{REVIEW_DECK}</code> را با Note مشترک به کارت نوع <code>{REVIEW_FILTER_CARD}</code> در دک <code>{REVIEW_FILTER_DECK}</code> وصل می‌کند و روی Noteهای معادل تگ <code>{AnkiTag.Filtered}</code> می‌زند.
                </p>
              </div>

              <div>
                <button
                  type="button"
                  onClick={() => void runReviewFilterTag()}
                  disabled={isRunning}
                  className="h-11 rounded-xl border border-blue-600/40 bg-background px-5 text-sm font-semibold text-blue-800 shadow-elevated transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {activeJob === "reviewFilterTag"
                    ? "در حال تگ‌گذاری کارت‌های معادل…"
                    : "تگ Filtered برای کارت‌های معادل"}
                </button>
              </div>
            </div>
          </div>
        </section>

        <section
          aria-live="polite"
          className="rounded-2xl border border-card bg-card shadow-elevated"
        >
          <div className="border-b border-card px-5 py-4">
            <h2 className="text-lg font-semibold text-foreground">
              Execution Log
            </h2>
            <p className="mt-1 text-sm text-muted">{status}</p>
          </div>

          <div className="min-h-32 p-5">
            {error ? (
              <p className="text-sm font-semibold text-red-700 dark:text-red-400">
                {error}
              </p>
            ) : migrationResults.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs text-muted">
                    <tr>
                      <th className="pb-3 pr-4 font-semibold">Direction</th>
                      <th className="pb-3 pr-4 font-semibold">Source</th>
                      <th className="pb-3 pr-4 font-semibold">Filters moved</th>
                      <th className="pb-3 pr-4 font-semibold">
                        Tagged Filtered
                      </th>
                      <th className="pb-3 pr-4 font-semibold">New to temp</th>
                      <th className="pb-3 font-semibold">Missing filters</th>
                    </tr>
                  </thead>
                  <tbody>
                    {migrationResults.map((result) => (
                      <tr
                        key={result.sourceCard}
                        className="border-t border-card text-foreground"
                      >
                        <td className="py-3 pr-4 font-medium">
                          {result.sourceCard}
                        </td>
                        <td className="py-3 pr-4">{result.sourceCards}</td>
                        <td className="py-3 pr-4">
                          {result.filterCardsMoved}
                        </td>
                        <td className="py-3 pr-4">
                          {result.notesTaggedFiltered}
                        </td>
                        <td className="py-3 pr-4">
                          {result.newCardsMovedToTemp}
                        </td>
                        <td className="py-3">{result.missingFilterCards}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : easyBoostResults.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs text-muted">
                    <tr>
                      <th className="pb-3 pr-4 font-semibold">Direction</th>
                      <th className="pb-3 pr-4 font-semibold">Sources in review</th>
                      <th className="pb-3 pr-4 font-semibold">Review cards found</th>
                      <th className="pb-3 pr-4 font-semibold">Cards boosted</th>
                      <th className="pb-3 pr-4 font-semibold">Easy answers</th>
                      <th className="pb-3 font-semibold">Missing review cards</th>
                    </tr>
                  </thead>
                  <tbody>
                    {easyBoostResults.map((result) => (
                      <tr
                        key={result.sourceCard}
                        className="border-t border-card text-foreground"
                      >
                        <td className="py-3 pr-4 font-medium">
                          {result.sourceCard}
                        </td>
                        <td className="py-3 pr-4">{result.sourceReviewCards}</td>
                        <td className="py-3 pr-4">{result.matchingReviewCards}</td>
                        <td className="py-3 pr-4">{result.cardsBoosted}</td>
                        <td className="py-3 pr-4">{result.totalEasyAnswers}</td>
                        <td className="py-3">{result.missingReviewCards}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : reviewDeckEasyResult ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs text-muted">
                    <tr>
                      <th className="pb-3 pr-4 font-semibold">Deck</th>
                      <th className="pb-3 pr-4 font-semibold">Cards found</th>
                      <th className="pb-3 font-semibold">Easy answers</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t border-card text-foreground">
                      <td className="py-3 pr-4 font-medium">{reviewDeckEasyResult.deck}</td>
                      <td className="py-3 pr-4">{reviewDeckEasyResult.cardsFound}</td>
                      <td className="py-3">{reviewDeckEasyResult.easyAnswers}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : reviewFilterTagResult ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs text-muted">
                    <tr>
                      <th className="pb-3 pr-4 font-semibold">Source cards</th>
                      <th className="pb-3 pr-4 font-semibold">Matching Filter cards</th>
                      <th className="pb-3 pr-4 font-semibold">Tagged notes</th>
                      <th className="pb-3 font-semibold">Missing Filter cards</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t border-card text-foreground">
                      <td className="py-3 pr-4">{reviewFilterTagResult.sourceCards}</td>
                      <td className="py-3 pr-4">{reviewFilterTagResult.matchingFilterCards}</td>
                      <td className="py-3 pr-4">{reviewFilterTagResult.taggedNotes}</td>
                      <td className="py-3">{reviewFilterTagResult.missingFilterCards}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-muted">
                Results will appear here after a migration or review boost runs.
              </p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
