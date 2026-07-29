"use client";

import { useEffect, useMemo, useState } from "react";

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
const DEFAULT_PAGE_SIZE = 100;
const PAGE_SIZE_OPTIONS = [25, 50, 100, 200] as const;
const FILTER_KNOWING_DECK = "WordsForNewStudy::FilterKnowing" as const;
const REVIEW_CARD = "WordsForNewStudy-Review" as const;
const REVIEW_DECK = "WordsForNewStudy::Review" as const;

type DeckName = typeof FILTER_KNOWING_DECK;

type CardRow = {
  cardId: number;
  noteId: number;
  fields: AnkiNotesInfo[number]["fields"];
  tags: string[];
};

type KnowledgeAction = "again" | "familiar" | "good" | "easy";

type HelpActionSummary = {
  title: string;
  description: string;
  moves: string;
  answers: string;
  extra?: string;
  toneClassName: string;
};

const ACTIONS: Array<{
  value: KnowledgeAction;
  label: string;
  className: string;
}> = [
  {
    value: "again",
    label: "بلد نیستم",
    className: "border-red-500/30 text-red-700 dark:text-red-400",
  },
  {
    value: "familiar",
    label: "آشنا هستم",
    className: "border-amber-500/30 text-amber-700 dark:text-amber-400",
  },
  {
    value: "good",
    label: "بلدم",
    className: "border-emerald-500/30 text-emerald-700 dark:text-emerald-400",
  },
  {
    value: "easy",
    label: "عالی",
    className: "border-sky-500/30 text-sky-700 dark:text-sky-400",
  },
];

function fieldValue(row: CardRow, fieldName: string) {
  return row.fields[fieldName]?.value.trim() ?? "";
}

function actionTargets() {
  return {
    enToFa: {
      cardType: WordAnkiConstants.cardTypes.EnToFa,
      deck: WordAnkiConstants.decks.EnToFa,
    },
    faToEn: {
      cardType: WordAnkiConstants.cardTypes.FaToEn,
      deck: WordAnkiConstants.decks.FaToEn,
    },
    review: {
      cardType: REVIEW_CARD,
      deck: REVIEW_DECK,
    },
  };
}

type AnswerInstruction = {
  target: keyof ReturnType<typeof actionTargets>;
  ease: 1 | 3 | 4;
  repetitions: number;
};

function answerInstructions(action: KnowledgeAction): AnswerInstruction[] {
  switch (action) {
    case "again":
      return [
        { target: "enToFa", ease: 1, repetitions: 1 },
        { target: "faToEn", ease: 1, repetitions: 1 },
      ];
    case "familiar":
      return [{ target: "enToFa", ease: 3, repetitions: 1 }];
    case "good":
      return [
        { target: "enToFa", ease: 4, repetitions: 2 },
        { target: "faToEn", ease: 3, repetitions: 1 },
        { target: "review", ease: 4, repetitions: 1 },
      ];
    case "easy":
      return [
        { target: "enToFa", ease: 4, repetitions: 2 },
        { target: "faToEn", ease: 4, repetitions: 1 },
        { target: "review", ease: 4, repetitions: 1 },
      ];
  }
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

function buildHelpSummaries(): HelpActionSummary[] {
  return [
    {
      title: "بلد نیستم",
      description:
        "برای زمانی است که کلمه را بلد نیستی. کارت‌های متناظر همین Note با نوع‌های EnToFa، FaToEn و WordsForNewStudy-Review پیدا می‌شوند و به دک‌های اصلی خودشان منتقل می‌شوند.",
      moves: `کارت ${WordAnkiConstants.cardTypes.EnToFa} به ${WordAnkiConstants.decks.EnToFa}، کارت ${WordAnkiConstants.cardTypes.FaToEn} به ${WordAnkiConstants.decks.FaToEn} و کارت ${REVIEW_CARD} به ${REVIEW_DECK} منتقل می‌شود.`,
      answers: "برای کارت‌های EnToFa و FaToEn یک بار Again با ease=1 اجرا می‌شود. روی کارت Review هیچ پاسخی اجرا نمی‌شود.",
      extra: `تگ ${AnkiTag.Filtered} روی نوت باقی می‌ماند.`,
      toneClassName:
        "border-red-500/20 bg-red-500/5 text-red-800 dark:text-red-300",
    },
    {
      title: "آشنا هستم",
      description:
        "برای زمانی است که کلمه برایت آشناست، اما نمی‌خواهی برای همهٔ کارت‌ها پاسخ ثبت شود. کارت‌های متناظر همین Note پیدا می‌شوند و فقط برای EnToFa پاسخ ثبت می‌شود.",
      moves: `کارت‌های ${WordAnkiConstants.cardTypes.EnToFa}، ${WordAnkiConstants.cardTypes.FaToEn} و ${REVIEW_CARD} به‌ترتیب به ${WordAnkiConstants.decks.EnToFa}، ${WordAnkiConstants.decks.FaToEn} و ${REVIEW_DECK} منتقل می‌شوند.`,
      answers: "فقط برای کارت EnToFa یک بار Good با ease=3 اجرا می‌شود. برای کارت FaToEn و Review هیچ عملی انجام نمی‌شود.",
      extra: `تگ ${AnkiTag.Filtered} روی نوت باقی می‌ماند.`,
      toneClassName:
        "border-amber-500/20 bg-amber-500/5 text-amber-800 dark:text-amber-300",
    },
    {
      title: "بلدم",
      description:
        "برای زمانی است که کلمه را می‌دانی. کارت‌های متناظر همین Note پیدا می‌شوند، به دک‌های اصلی می‌روند و سپس برای هر نوع کارت پاسخ مخصوص خودش ثبت می‌شود.",
      moves: `کارت‌های EnToFa، FaToEn و ${REVIEW_CARD} به دک‌های ${WordAnkiConstants.decks.EnToFa}، ${WordAnkiConstants.decks.FaToEn} و ${REVIEW_DECK} منتقل می‌شوند.`,
      answers: "برای EnToFa دو بار Easy با ease=4، برای FaToEn یک بار Good با ease=3 و برای Review یک بار Easy با ease=4 اجرا می‌شود.",
      extra: `تگ ${AnkiTag.Filtered} روی نوت باقی می‌ماند.`,
      toneClassName:
        "border-emerald-500/20 bg-emerald-500/5 text-emerald-800 dark:text-emerald-300",
    },
    {
      title: "عالی",
      description:
        "برای زمانی است که کلمه را کاملاً و بدون زحمت می‌دانی. کارت‌های متناظر همین Note به دک‌های اصلی می‌روند و پاسخ Easy ثبت می‌شود؛ EnToFa دو بار پاسخ می‌گیرد.",
      moves: `کارت‌های EnToFa، FaToEn و ${REVIEW_CARD} به دک‌های ${WordAnkiConstants.decks.EnToFa}، ${WordAnkiConstants.decks.FaToEn} و ${REVIEW_DECK} منتقل می‌شوند.`,
      answers: "برای EnToFa دو بار Easy با ease=4، برای FaToEn یک بار Easy با ease=4 و برای Review یک بار Easy با ease=4 اجرا می‌شود.",
      extra: `تگ ${AnkiTag.Filtered} روی نوت باقی می‌ماند.`,
      toneClassName:
        "border-sky-500/20 bg-sky-500/5 text-sky-800 dark:text-sky-300",
    },
  ];
}

export default function AnkiKnowingFilterManagementClient() {
  const selectedDeck: DeckName = FILTER_KNOWING_DECK;
  const [includeFiltered, setIncludeFiltered] = useState(false);
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
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const totalPages = Math.max(1, Math.ceil((rows?.length ?? 0) / pageSize));
  const visibleRows = useMemo(
    () => rows?.slice((currentPage - 1) * pageSize, currentPage * pageSize) ?? [],
    [currentPage, pageSize, rows],
  );

  async function loadCards() {
    if (isLoading || busyCardId !== null) return;

    setIsLoading(true);
    setError(null);
    setActionMessage(null);
    setCompletedActions({});
    setRows(null);
    setCurrentPage(1);

    try {
      const cardsResponse = await ankiOperations.findCards({
        query: buildQuery(selectedDeck, includeFiltered, includeNotFiltered),
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
            ? [
                {
                  cardId,
                  noteId: note.noteId,
                  fields: note.fields,
                  tags: note.tags,
                },
              ]
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

  useEffect(() => {
    void loadCards();
    // The initial search intentionally runs only once when the page opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function findNoteCards(noteId: number, cardType: string) {
    const response = await ankiOperations.findCards({
      query: `nid:${noteId} card:${quoteAnkiSearchValue(cardType)}`,
    });
    if (!response.ok) throw new Error(response.error);
    if (!Array.isArray(response.result) || response.result.length === 0) {
      throw new Error(`کارت ${cardType} برای نوت ${noteId} پیدا نشد.`);
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
      const targets = actionTargets();
      const enToFaCardIds = await findNoteCards(
        row.noteId,
        targets.enToFa.cardType,
      );
      const faToEnCardIds = await findNoteCards(
        row.noteId,
        targets.faToEn.cardType,
      );
      const reviewCardIds = await findNoteCards(
        row.noteId,
        targets.review.cardType,
      );
      const cardIdsByTarget = {
        enToFa: enToFaCardIds,
        faToEn: faToEnCardIds,
        review: reviewCardIds,
      } satisfies Record<
        keyof ReturnType<typeof actionTargets>,
        number[]
      >;

      const tagResponse = await ankiOperations.addTags({
        notes: [row.noteId],
        tags: AnkiTag.Filtered,
      });
      if (!tagResponse.ok) throw new Error(tagResponse.error);

      const cardsToMove = [
        [targets.enToFa, enToFaCardIds],
        [targets.faToEn, faToEnCardIds],
        [targets.review, reviewCardIds],
      ] as const;
      for (const [target, cardIds] of cardsToMove) {
        const moveResponse = await ankiOperations.changeDeck({
          cards: cardIds,
          deck: target.deck,
        });
        if (!moveResponse.ok) throw new Error(moveResponse.error);
        await confirmCardsInDeck(cardIds, target.deck);
      }

      for (const instruction of answerInstructions(action.value)) {
        const answerCardIds = cardIdsByTarget[instruction.target];
        for (let repetition = 0; repetition < instruction.repetitions; repetition += 1) {
          const answerResponse = await ankiOperations.answerCards({
            answers: answerCardIds.map((cardId) => ({
              cardId,
              ease: instruction.ease,
            })),
          });
          if (!answerResponse.ok) throw new Error(answerResponse.error);
        }
      }

      setRows(
        (currentRows) =>
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

  function renderPaginationControls() {
    if (!rows || rows.length === 0) return null;

    return (
      <div className="flex flex-wrap items-center justify-between gap-3 px-2 py-3 text-sm">
        <div className="flex flex-wrap items-center gap-3 text-muted">
          <span>
            نمایش {(currentPage - 1) * pageSize + 1} تا {Math.min(currentPage * pageSize, rows.length)} از {rows.length.toLocaleString()}
          </span>
          <label className="flex items-center gap-2">
            <span>تعداد در صفحه</span>
            <select
              value={pageSize}
              onChange={(event) => {
                setPageSize(Number(event.target.value));
                setCurrentPage(1);
              }}
              className="rounded-lg border border-card bg-background px-2 py-1.5 text-foreground outline-none focus:ring-2 focus:ring-[var(--ring)]"
            >
              {PAGE_SIZE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="flex items-center gap-2" dir="rtl">
          <button
            type="button"
            onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
            disabled={currentPage === 1}
            className="rounded-lg border border-card bg-background px-3 py-1.5 font-semibold disabled:cursor-not-allowed disabled:opacity-40"
          >
            قبلی
          </button>
          <span className="min-w-20 text-center text-xs text-muted">
            صفحه {currentPage} از {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
            disabled={currentPage === totalPages}
            className="rounded-lg border border-card bg-background px-3 py-1.5 font-semibold disabled:cursor-not-allowed disabled:opacity-40"
          >
            بعدی
          </button>
        </div>
      </div>
    );
  }

  return (
    <main className="mx-auto w-full max-w-7xl select-text p-4">
      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <PageHeader
            title="Knowing Filter Card Management"
            subtitle="مدیریت سه کارت متناظر هر کلمه در دک فیلتر شناخت"
          />
          <button
            type="button"
            onClick={() => setIsHelpOpen(true)}
            aria-label="راهنمای اکشن‌ها"
            title="راهنمای اکشن‌ها"
            className="grid size-10 shrink-0 place-items-center rounded-full border border-card bg-card text-lg font-bold text-foreground shadow-elevated transition hover:bg-background"
          >
            ?
          </button>
        </div>

        <section className="rounded-2xl border border-card bg-background p-4">
          <div className="grid gap-4 lg:grid-cols-[minmax(16rem,1fr)_auto_auto] lg:items-end">
            <div className="grid gap-1">
              <span className="text-xs font-semibold text-muted">Deck</span>
              <div className="flex h-11 items-center rounded-xl border border-card bg-card px-3 text-sm font-semibold text-foreground">
                <span dir="ltr">{FILTER_KNOWING_DECK}</span>
              </div>
            </div>

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
                {rows.length.toLocaleString()} cards · صفحه {currentPage} از {totalPages}
              </p>
              <p className="text-xs text-muted">
                اکشن‌های انجام‌شده در این بارگذاری دوباره اجرا نمی‌شوند.
              </p>
            </div>
            {renderPaginationControls()}

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
                    <th className="px-3 py-2 text-right font-semibold">
                      Actions
                    </th>
                    <th className="px-3 py-2 text-left font-semibold">
                      Sentence
                    </th>
                    <th
                      dir="rtl"
                      className="px-3 py-2 text-right font-semibold"
                    >
                      Sentence Meaning
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((row, index) => {
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
                        <td className="px-3 py-3 text-muted">{(currentPage - 1) * pageSize + index + 1}</td>
                        {renderValue(word)}
                        {renderMeaning(meaning, "w-48 max-w-48")}
                        <td className="px-3 py-3 text-right align-top">
                          {row.tags.includes(AnkiTag.Filtered) ? (
                            <span className="text-xs font-semibold text-muted">
                              فیلتر شده
                            </span>
                          ) : (
                            <div
                              dir="rtl"
                              title={`Card ${row.cardId} · Note ${row.noteId}`}
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
                          )}
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

        {isHelpOpen ? (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
          >
            <div
              dir="rtl"
              className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-card bg-card shadow-2xl"
            >
              <div className="flex items-start justify-between gap-4 border-b border-card p-5 sm:p-6">
                <div>
                  <h2 className="text-lg font-bold text-foreground">
                    راهنمای اکشن‌های این صفحه
                  </h2>
                  <p className="mt-1 text-sm text-muted">
                    کارت‌های متناظر از دک انتخاب‌شده یعنی{" "}
                    <span dir="ltr">{selectedDeck}</span> این دکمه‌ها این
                    جابه‌جایی‌ها و پاسخ‌ها را اجرا می‌کنند.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsHelpOpen(false)}
                  aria-label="بستن"
                  className="grid size-10 shrink-0 place-items-center rounded-full border border-card bg-background text-xl text-muted transition hover:text-foreground"
                >
                  ×
                </button>
              </div>

              <div className="overflow-y-auto p-5 sm:p-6">
                <div className="grid gap-4">
                  <div className="rounded-2xl border border-card bg-background p-4 text-sm leading-7 text-foreground">
                    <h3 className="font-bold">این صفحه چه کاری انجام می‌دهد؟</h3>
                    <p className="mt-2">
                      این صفحه کلمه‌ها را از دک فیلتر شناخت بررسی می‌کند تا مشخص
                      کنی کدام کلمه را بلدی. دک انتخاب‌شده همیشه{" "}
                      <span dir="ltr">{selectedDeck}</span> است و نتیجهٔ هر
                      عملیات مستقیماً در Anki ثبت می‌شود.
                    </p>
                    <div className="mt-3 rounded-xl border border-card bg-card p-3">
                      <p className="font-semibold">روند کار</p>
                      <ol className="mt-1 list-inside list-decimal text-muted">
                        <li>تگ‌ها را انتخاب کن و روی «Show Cards» بزن.</li>
                        <li>برای هر ردیف، میزان شناختت از کلمه را انتخاب کن.</li>
                        <li>کارت‌ها به دک مناسب منتقل می‌شوند و در صورت نیاز پاسخ Anki ثبت می‌شود.</li>
                        <li>برای دیدن وضعیت واقعی پس از عملیات، دوباره «Show Cards» را اجرا کن.</li>
                      </ol>
                    </div>
                    <p className="mt-3 text-muted">
                      هر ردیف یک کارت است، اما دکمه روی نوت همان ردیف اجرا می‌شود
                      و کارت‌های متناظر همان نوت را هم پیدا می‌کند. بنابراین ممکن
                      است یک کلیک روی هر سه کارتِ یک کلمه اثر بگذارد.
                    </p>
                    <p className="mt-2 text-muted">
                      در شروع هر عملیات تگ <span dir="ltr">{AnkiTag.Filtered}</span>
                      روی نوت اضافه می‌شود و حذف نمی‌شود. این تگ فقط نشان می‌دهد
                      نوت بررسی شده است؛ جابه‌جایی کارت‌ها بر اساس خود کارت انجام
                      می‌شود، نه حذف تگ.
                    </p>
                    <p className="mt-2 text-muted">
                      سه کارت متناظر هر Note عبارت‌اند از{" "}
                      <span dir="ltr">EnToFa</span>،{" "}
                      <span dir="ltr">FaToEn</span> و{" "}
                      <span dir="ltr">{REVIEW_CARD}</span>. اپ این کارت‌ها را
                      برای همان Note پیدا می‌کند و به دک اصلی خودشان منتقل
                      می‌کند؛ سپس بسته به دکمه، پاسخ متفاوتی برای هر کارت اجرا
                      می‌شود.
                    </p>
                    <p className="mt-2 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-amber-800 dark:text-amber-300">
                      منظور از «کارت متناظر» کارت جدید یا کارت مخصوص فیلتر
                      نیست؛ منظور کارت همان Note با نوع EnToFa، FaToEn یا{" "}
                      <span dir="ltr">{REVIEW_CARD}</span> است. ردیف فعلی فقط
                      Note و کلمه را مشخص می‌کند؛ عملیات روی کارت‌های متناظر
                      انجام می‌شود، نه صرفاً روی کارت فیلتر نمایش‌داده‌شده.
                    </p>
                  </div>

                  <section className="rounded-2xl border border-card bg-background p-4 text-sm leading-7">
                    <h3 className="font-bold text-foreground">فیلترهای نمایش</h3>
                    <div className="mt-3 grid gap-3 sm:grid-cols-3">
                      <div className="rounded-xl border border-card bg-card p-3">
                        <p className="font-semibold text-foreground">With Filtered</p>
                        <p className="mt-1 text-muted">فقط کارت‌هایی که نوتشان تگ <span dir="ltr">Filtered</span> دارد.</p>
                      </div>
                      <div className="rounded-xl border border-card bg-card p-3">
                        <p className="font-semibold text-foreground">Without Filtered</p>
                        <p className="mt-1 text-muted">فقط کارت‌هایی که نوتشان این تگ را ندارد.</p>
                      </div>
                      <div className="rounded-xl border border-card bg-card p-3">
                        <p className="font-semibold text-foreground">هر دو</p>
                        <p className="mt-1 text-muted">همهٔ کارت‌های دک را نشان می‌دهد؛ یکی از دو گزینه باید فعال بماند.</p>
                      </div>
                    </div>
                    <p className="mt-3 text-xs text-muted">
                      توجه: تگ روی Note ذخیره می‌شود، پس همهٔ کارت‌های آن Note
                      در فیلتر تگ یکسان دیده می‌شوند.
                    </p>
                  </section>

                  {buildHelpSummaries().map((item) => (
                    <section
                      key={item.title}
                      className={`rounded-2xl border p-4 ${item.toneClassName}`}
                    >
                      <h3 className="text-sm font-bold">{item.title}</h3>
                      <p className="mt-2 text-sm leading-7">
                        {item.description}
                      </p>
                      <p className="mt-3 text-sm leading-7">{item.moves}</p>
                      <p className="mt-1 text-sm leading-7">{item.answers}</p>
                      {item.extra ? (
                        <p className="mt-1 text-sm leading-7">{item.extra}</p>
                      ) : null}
                    </section>
                  ))}

                  <section className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm leading-7 text-amber-800 dark:text-amber-300">
                    <h3 className="font-bold">نکات مهم</h3>
                    <ul className="mt-2 list-inside list-disc">
                      <li>در هر چهار دکمه، کارت‌های متناظر EnToFa، FaToEn و {REVIEW_CARD} برای همان Note پیدا و به دک‌های اصلی منتقل می‌شوند.</li>
                      <li>«بلد نیستم» برای EnToFa و FaToEn یک بار Again می‌زند و Review را دست‌نخورده می‌گذارد.</li>
                      <li>«آشنا هستم» فقط برای EnToFa یک بار Good با <span dir="ltr">ease=3</span> اجرا می‌کند.</li>
                      <li>«بلدم»: برای EnToFa دو بار Easy با <span dir="ltr">ease=4</span>، برای FaToEn یک بار Good با <span dir="ltr">ease=3</span> و برای Review یک بار Easy با <span dir="ltr">ease=4</span>.</li>
                      <li>«عالی»: برای هر سه کارت Easy با <span dir="ltr">ease=4</span> اجرا می‌شود و EnToFa دو بار پاسخ می‌گیرد.</li>
                      <li>اگر عملیات موفق شود، همان ردیف تا زمان بارگذاری دوباره «فیلتر شده» نشان داده می‌شود و دکمه‌ها دوباره فعال نمی‌شوند.</li>
                      <li>اگر خطا دیدی، ابتدا وضعیت Deck و اتصال AnkiConnect را بررسی کن و سپس فهرست را دوباره بارگذاری کن.</li>
                    </ul>
                  </section>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}
