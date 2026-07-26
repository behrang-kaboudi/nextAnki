"use client";

import { useState } from "react";

import { PageHeader } from "@/components/page-header";
import {
  AnkiTag,
  ankiOperations,
  chunkArray,
  quoteAnkiSearchValue,
  WordAnkiConstants,
  type AnkiNotesInfo,
} from "@/lib/anki";

const BATCH_SIZE = 200;

const DECKS = [
  {
    label: "1EnToFaKnowingFilter",
    value: WordAnkiConstants.decks.EnToFaKnowingFilter,
  },
  {
    label: "1FaToEnKnowingFilter",
    value: WordAnkiConstants.decks.FaToEnKnowingFilter,
  },
] as const;

type DeckName = (typeof DECKS)[number]["value"];

type CardRow = {
  cardId: number;
  noteId: number;
  fields: AnkiNotesInfo[number]["fields"];
  tags: string[];
};

type KnowledgeAction = "again" | "familiar" | "good" | "easy";

const ACTIONS: Array<{
  value: KnowledgeAction;
  label: string;
  moveSimpleCard: boolean;
  ease?: 3 | 4;
  className: string;
}> = [
  {
    value: "again",
    label: "بلد نیستم",
    moveSimpleCard: false,
    className: "border-red-500/30 text-red-700 dark:text-red-400",
  },
  {
    value: "familiar",
    label: "آشنا هستم",
    moveSimpleCard: true,
    className: "border-amber-500/30 text-amber-700 dark:text-amber-400",
  },
  {
    value: "good",
    label: "بلدم",
    moveSimpleCard: true,
    ease: 3,
    className: "border-emerald-500/30 text-emerald-700 dark:text-emerald-400",
  },
  {
    value: "easy",
    label: "عالی",
    moveSimpleCard: true,
    ease: 4,
    className: "border-sky-500/30 text-sky-700 dark:text-sky-400",
  },
];

function fieldValue(row: CardRow, fieldName: string) {
  return row.fields[fieldName]?.value.trim() ?? "";
}

function actionTargets(deck: DeckName) {
  if (deck === WordAnkiConstants.decks.EnToFaKnowingFilter) {
    return {
      reviewCard: WordAnkiConstants.cardTypes.EnToFaRev,
      reviewDeck: WordAnkiConstants.decks.EnToFaRev,
      simpleCard: WordAnkiConstants.cardTypes.EnToFa,
      simpleDeck: WordAnkiConstants.decks.EnToFa,
    };
  }

  return {
    reviewCard: WordAnkiConstants.cardTypes.FaToEnRev,
    reviewDeck: WordAnkiConstants.decks.FaToEnRev,
    simpleCard: WordAnkiConstants.cardTypes.FaToEn,
    simpleDeck: WordAnkiConstants.decks.FaToEn,
  };
}

function buildQuery(
  deck: DeckName,
  includeFiltered: boolean,
  includeNotFiltered: boolean,
) {
  const deckQuery = `deck:${quoteAnkiSearchValue(deck)}`;

  if (includeFiltered && !includeNotFiltered) {
    return `${deckQuery} tag:${quoteAnkiSearchValue(AnkiTag.Filtered)}`;
  }
  if (!includeFiltered && includeNotFiltered) {
    return `${deckQuery} -tag:${quoteAnkiSearchValue(AnkiTag.Filtered)}`;
  }
  return deckQuery;
}

export default function AnkiKnowingFilterManagementClient() {
  const [selectedDeck, setSelectedDeck] = useState<DeckName>(DECKS[0].value);
  const [includeFiltered, setIncludeFiltered] = useState(true);
  const [includeNotFiltered, setIncludeNotFiltered] = useState(true);
  const [rows, setRows] = useState<CardRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [busyCardId, setBusyCardId] = useState<number | null>(null);
  const [busyAction, setBusyAction] = useState<KnowledgeAction | null>(null);
  const [completedActions, setCompletedActions] = useState<
    Record<number, KnowledgeAction>
  >({});
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  async function loadCards() {
    if (isLoading || busyCardId !== null) return;

    setIsLoading(true);
    setError(null);
    setActionMessage(null);
    setCompletedActions({});
    setRows(null);

    try {
      const cardsResponse = await ankiOperations.findCards({
        query: buildQuery(
          selectedDeck,
          includeFiltered,
          includeNotFiltered,
        ),
      });
      if (!cardsResponse.ok) throw new Error(cardsResponse.error);
      if (!Array.isArray(cardsResponse.result)) {
        throw new Error("AnkiConnect returned an invalid findCards result.");
      }

      const cardIds = cardsResponse.result;
      if (cardIds.length === 0) {
        setRows([]);
        return;
      }

      const noteIdByCardId = new Map<number, number>();
      for (const batch of chunkArray(cardIds, BATCH_SIZE)) {
        const response = await ankiOperations.cardsInfo({ cards: batch });
        if (!response.ok) throw new Error(response.error);
        if (!Array.isArray(response.result)) {
          throw new Error("AnkiConnect returned an invalid cardsInfo result.");
        }
        for (const card of response.result) {
          noteIdByCardId.set(card.cardId, card.note);
        }
      }

      const noteIds = Array.from(new Set(noteIdByCardId.values()));
      const noteById = new Map<number, AnkiNotesInfo[number]>();
      for (const batch of chunkArray(noteIds, BATCH_SIZE)) {
        const response = await ankiOperations.notesInfo({ notes: batch });
        if (!response.ok) throw new Error(response.error);
        if (!Array.isArray(response.result)) {
          throw new Error("AnkiConnect returned an invalid notesInfo result.");
        }
        for (const note of response.result) {
          noteById.set(note.noteId, note);
        }
      }

      setRows(
        cardIds.flatMap((cardId) => {
          const noteId = noteIdByCardId.get(cardId);
          const note = noteId === undefined ? undefined : noteById.get(noteId);
          return note
            ? [{ cardId, noteId: note.noteId, fields: note.fields, tags: note.tags }]
            : [];
        }),
      );
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "ارتباط با AnkiConnect ناموفق بود.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function findNoteCards(noteId: number, cardType: string) {
    const response = await ankiOperations.findCards({
      query: `nid:${noteId} card:${quoteAnkiSearchValue(cardType)}`,
    });
    if (!response.ok) throw new Error(response.error);
    if (!Array.isArray(response.result) || response.result.length === 0) {
      throw new Error(
        `کارت ${cardType} برای نوت ${noteId} پیدا نشد.`,
      );
    }
    return response.result;
  }

  async function confirmCardsInDeck(cardIds: number[], deck: string) {
    const response = await ankiOperations.cardsInfo({ cards: cardIds });
    if (!response.ok) throw new Error(response.error);
    if (
      !Array.isArray(response.result) ||
      response.result.length !== cardIds.length ||
      response.result.some((card) => card.deckName !== deck)
    ) {
      throw new Error(`انتقال کارت به Deck «${deck}» تأیید نشد.`);
    }
  }

  async function runRowAction(row: CardRow, action: (typeof ACTIONS)[number]) {
    if (busyCardId !== null || completedActions[row.cardId]) return;

    setBusyCardId(row.cardId);
    setBusyAction(action.value);
    setError(null);
    setActionMessage(null);

    try {
      const targets = actionTargets(selectedDeck);
      const reviewCardIds = await findNoteCards(row.noteId, targets.reviewCard);
      const simpleCardIds = action.moveSimpleCard
        ? await findNoteCards(row.noteId, targets.simpleCard)
        : [];

      const tagResponse = await ankiOperations.addTags({
        notes: [row.noteId],
        tags: AnkiTag.Filtered,
      });
      if (!tagResponse.ok) throw new Error(tagResponse.error);

      const reviewMoveResponse = await ankiOperations.changeDeck({
        cards: reviewCardIds,
        deck: targets.reviewDeck,
      });
      if (!reviewMoveResponse.ok) throw new Error(reviewMoveResponse.error);
      await confirmCardsInDeck(reviewCardIds, targets.reviewDeck);

      if (simpleCardIds.length > 0) {
        const simpleMoveResponse = await ankiOperations.changeDeck({
          cards: simpleCardIds,
          deck: targets.simpleDeck,
        });
        if (!simpleMoveResponse.ok) throw new Error(simpleMoveResponse.error);
        await confirmCardsInDeck(simpleCardIds, targets.simpleDeck);
      }

      if (action.ease !== undefined) {
        const answerCardIds = [...reviewCardIds, ...simpleCardIds];
        const answerResponse = await ankiOperations.answerCards({
          answers: answerCardIds.map((cardId) => ({
            cardId,
            ease: action.ease as 3 | 4,
          })),
        });
        if (!answerResponse.ok) throw new Error(answerResponse.error);
      }

      setRows((currentRows) =>
        currentRows?.map((currentRow) =>
          currentRow.noteId === row.noteId &&
          !currentRow.tags.includes(AnkiTag.Filtered)
            ? {
                ...currentRow,
                tags: [...currentRow.tags, AnkiTag.Filtered],
              }
            : currentRow,
        ) ?? null,
      );
      setCompletedActions((current) => ({
        ...current,
        [row.cardId]: action.value,
      }));
      setActionMessage(
        `${action.label} برای «${fieldValue(row, "base_form") || row.noteId}» با موفقیت انجام شد.`,
      );
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "انجام اکشن در Anki ناموفق بود.",
      );
    } finally {
      setBusyCardId(null);
      setBusyAction(null);
    }
  }

  function changeFilteredFilter(
    kind: "filtered" | "notFiltered",
    checked: boolean,
  ) {
    if (kind === "filtered") {
      if (!checked && !includeNotFiltered) return;
      setIncludeFiltered(checked);
      return;
    }

    if (!checked && !includeFiltered) return;
    setIncludeNotFiltered(checked);
  }

  return (
    <main className="mx-auto w-full max-w-7xl select-text p-4">
      <div className="flex flex-col gap-4">
        <PageHeader
          title="Knowing Filter Card Management"
          subtitle="مدیریت کارت‌های دو Deck فیلتر شناخت"
        />

        <section className="rounded-2xl border border-card bg-background p-4">
          <div className="grid gap-4 lg:grid-cols-[minmax(16rem,1fr)_auto_auto] lg:items-end">
            <label className="grid gap-1">
              <span className="text-xs font-semibold text-muted">Deck</span>
              <select
                value={selectedDeck}
                onChange={(event) => {
                  setSelectedDeck(event.target.value as DeckName);
                  setRows(null);
                }}
                className="h-11 w-full rounded-xl border border-card bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-[var(--ring)]"
              >
                {DECKS.map((deck) => (
                  <option key={deck.value} value={deck.value}>
                    {deck.label}
                  </option>
                ))}
              </select>
            </label>

            <fieldset className="flex h-11 items-center gap-4 rounded-xl border border-card px-4">
              <legend className="sr-only">Filtered tag filter</legend>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={includeFiltered}
                  onChange={(event) =>
                    changeFilteredFilter("filtered", event.target.checked)
                  }
                  className="size-4 accent-[var(--primary)]"
                />
                With Filtered
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={includeNotFiltered}
                  onChange={(event) =>
                    changeFilteredFilter("notFiltered", event.target.checked)
                  }
                  className="size-4 accent-[var(--primary)]"
                />
                Without Filtered
              </label>
            </fieldset>

            <button
              type="button"
              onClick={() => void loadCards()}
              disabled={isLoading}
              className="h-11 rounded-xl bg-[var(--primary)] px-5 text-sm font-semibold text-[var(--primary-foreground)] shadow-elevated transition hover:opacity-95 disabled:opacity-60"
            >
              {isLoading ? "Loading…" : "Show Cards"}
            </button>
          </div>

          <p className="mt-2 text-xs text-muted">
            انتخاب هر دو فیلتر، همه کارت‌ها را نمایش می‌دهد.
          </p>
        </section>

        {error ? (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm font-semibold text-red-700 dark:text-red-400">
            {error}
          </div>
        ) : null}

        {actionMessage ? (
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
            {actionMessage}
          </div>
        ) : null}

        {rows ? (
          <section className="rounded-2xl border border-card bg-card p-2 shadow-elevated">
            <div className="flex items-center justify-between gap-3 px-2 py-2">
              <p className="text-sm font-semibold text-foreground">
                {rows.length.toLocaleString()} cards
              </p>
              <p className="text-xs text-muted">
                اکشن‌های انجام‌شده در این بارگذاری دوباره اجرا نمی‌شوند.
              </p>
            </div>

            <div className="overflow-auto rounded-xl border border-card bg-background">
              <table className="w-full min-w-[1000px] border-collapse text-sm">
                <thead className="sticky top-0 bg-background">
                  <tr className="border-b border-card">
                    <th className="px-3 py-2 text-left font-semibold">#</th>
                    <th className="px-3 py-2 text-left font-semibold">Word</th>
                    <th
                      dir="rtl"
                      className="w-48 px-3 py-2 text-right font-semibold"
                    >
                      Meaning
                    </th>
                    <th className="px-3 py-2 text-right font-semibold">Actions</th>
                    <th className="px-3 py-2 text-left font-semibold">Sentence</th>
                    <th
                      dir="rtl"
                      className="px-3 py-2 text-right font-semibold"
                    >
                      Sentence Meaning
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => {
                    const word = fieldValue(row, "base_form");
                    const meaning = fieldValue(row, "meaning_fa");
                    const sentence = fieldValue(row, "sentence_en");
                    const sentenceMeaning = fieldValue(
                      row,
                      "sentence_en_meaning_fa",
                    );

                    const renderValue = (value: string) => (
                      <td className="max-w-80 px-3 py-3 align-top text-foreground">
                        {value ? (
                          <span className="whitespace-pre-wrap">{value}</span>
                        ) : (
                          <span className="opacity-50">—</span>
                        )}
                      </td>
                    );

                    const renderMeaning = (
                      value: string,
                      className = "max-w-80",
                    ) => (
                      <td
                        dir="rtl"
                        className={`${className} px-3 py-3 text-right align-top text-foreground`}
                      >
                        {value ? (
                          <span className="whitespace-pre-wrap">{value}</span>
                        ) : (
                          <span className="opacity-50">—</span>
                        )}
                      </td>
                    );

                    return (
                      <tr
                        key={row.cardId}
                        className="border-b border-card last:border-b-0"
                      >
                        <td className="px-3 py-3 text-muted">{index + 1}</td>
                        {renderValue(word)}
                        {renderMeaning(meaning, "w-48 max-w-48")}
                        <td className="px-3 py-3 text-right align-top">
                          <div
                            dir="rtl"
                            title={`Card ${row.cardId} · Note ${row.noteId}${
                              row.tags.includes(AnkiTag.Filtered)
                                ? " · Filtered"
                                : ""
                            }`}
                            className="flex min-w-64 flex-wrap justify-start gap-1.5"
                          >
                            {ACTIONS.map((action) => (
                              <button
                                key={action.value}
                                type="button"
                                onClick={() => void runRowAction(row, action)}
                                disabled={
                                  busyCardId !== null ||
                                  completedActions[row.cardId] !== undefined
                                }
                                className={`rounded-md border bg-background px-2 py-1 text-[11px] font-semibold transition hover:bg-card disabled:cursor-not-allowed disabled:opacity-50 ${action.className}`}
                              >
                                {busyCardId === row.cardId &&
                                busyAction === action.value
                                  ? "در حال انجام…"
                                  : action.label}
                              </button>
                            ))}
                          </div>
                          {completedActions[row.cardId] ? (
                            <p
                              dir="rtl"
                              className="mt-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400"
                            >
                              انجام شد
                            </p>
                          ) : null}
                        </td>
                        {renderValue(sentence)}
                        {renderMeaning(sentenceMeaning)}
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {rows.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted">
                  کارتی با این فیلتر پیدا نشد.
                </div>
              ) : null}
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
