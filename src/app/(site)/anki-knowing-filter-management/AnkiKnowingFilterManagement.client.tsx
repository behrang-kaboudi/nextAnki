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
  reviewMove: string;
  simpleMove: string;
  extra?: string;
  toneClassName: string;
};

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

function actionTargets() {
  return {
    reviewCard: WordAnkiConstants.cardTypes.EnToFaRev,
    reviewDeck: WordAnkiConstants.decks.EnToFaRev,
    simpleCard: WordAnkiConstants.cardTypes.EnToFa,
    simpleDeck: WordAnkiConstants.decks.EnToFa,
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

function buildHelpSummaries(deck: DeckName): HelpActionSummary[] {
  const targets = actionTargets();

  return [
    {
      title: "بلد نیستم",
      description:
        "برای زمانی است که کلمه را بلد نیستی. فقط کارت مروری همان نوت از Knowing Filter خارج می‌شود و کارت ساده عمداً در Knowing Filter باقی می‌ماند.",
      reviewMove: `کارت ${WordAnkiConstants.cardTypes.EnToFaRev} به دک ${WordAnkiConstants.decks.EnToFaRev} منتقل می‌شود.`,
      simpleMove: `کارت ${WordAnkiConstants.cardTypes.EnToFa} جابه‌جا نمی‌شود و در همان دک باقی می‌ماند.`,
      extra: `تگ ${AnkiTag.Filtered} روی نوت اضافه می‌شود؛ این تگ حذف نمی‌شود، اما کارت مرور دیگر در Deck فیلتر شناخت نیست.`,
      toneClassName:
        "border-red-500/20 bg-red-500/5 text-red-800 dark:text-red-300",
    },
    {
      title: "آشنا هستم",
      description:
        "برای زمانی است که کلمه برایت آشناست، اما نمی‌خواهی فعلاً آن را به‌عنوان پاسخ درست در Anki ثبت کنی. هر دو کارت از Knowing Filter خارج می‌شوند و هیچ answerCards اجرا نمی‌شود.",
      reviewMove: `اگر دک انتخاب‌شده «${deck}» باشد، کارت ${targets.reviewCard} به دک ${targets.reviewDeck} منتقل می‌شود.`,
      simpleMove: `کارت ${targets.simpleCard} نیز به دک ${targets.simpleDeck} منتقل می‌شود.`,
      extra: `تگ ${AnkiTag.Filtered} روی نوت اضافه می‌شود؛ چون هر دو کارت به Deck عادی منتقل شده‌اند، این تگ باعث باقی‌ماندن آن‌ها در Knowing Filter نمی‌شود.`,
      toneClassName:
        "border-amber-500/20 bg-amber-500/5 text-amber-800 dark:text-amber-300",
    },
    {
      title: "بلدم",
      description:
        "برای زمانی است که کلمه را می‌دانی. هر دو کارت به Deckهای عادی برمی‌گردند و سپس برای هر دو کارت پاسخ خوب در Anki ثبت می‌شود.",
      reviewMove: `اگر دک انتخاب‌شده «${deck}» باشد، کارت ${targets.reviewCard} به دک ${targets.reviewDeck} منتقل می‌شود.`,
      simpleMove: `کارت ${targets.simpleCard} نیز به دک ${targets.simpleDeck} منتقل می‌شود.`,
      extra:
        "پس از انتقال، برای هر دو کارت answerCards با ease=3 اجرا می‌شود؛ یعنی معادل انتخاب Good در Anki.",
      toneClassName:
        "border-emerald-500/20 bg-emerald-500/5 text-emerald-800 dark:text-emerald-300",
    },
    {
      title: "عالی",
      description:
        "برای زمانی است که کلمه را کاملاً و بدون زحمت می‌دانی. هر دو کارت به Deckهای عادی برمی‌گردند و پاسخ آسان در Anki ثبت می‌شود.",
      reviewMove: `اگر دک انتخاب‌شده «${deck}» باشد، کارت ${targets.reviewCard} به دک ${targets.reviewDeck} منتقل می‌شود.`,
      simpleMove: `کارت ${targets.simpleCard} نیز به دک ${targets.simpleDeck} منتقل می‌شود.`,
      extra:
        "پس از انتقال، برای هر دو کارت answerCards با ease=4 اجرا می‌شود؛ یعنی معادل انتخاب Easy در Anki.",
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
            subtitle="مدیریت کارت‌های دو Deck فیلتر شناخت"
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
                    برای دک انتخاب‌شده یعنی{" "}
                    <span dir="ltr">{selectedDeck}</span> این دکمه‌ها این
                    جابه‌جایی‌ها را انجام می‌دهند.
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
                    <p>
                      هر ردیف مربوط به یک کارت از یک نوت است. دکمه‌ای که می‌زنی
                      روی همان نوت و کارت‌های متناظر آن اجرا می‌شود؛ بنابراین
                      نتیجه ممکن است روی دو کارتِ یک کلمه اثر بگذارد.
                    </p>
                    <p className="mt-2 text-muted">
                      در هر اکشن ابتدا تگ <span dir="ltr">{AnkiTag.Filtered}</span>
                      روی نوت ثبت می‌شود. این تگ فقط علامت پردازش‌شدن نوت است و
                      با انتقال کارت‌ها حذف نمی‌شود.
                    </p>
                    <p className="mt-2 text-muted">
                      «کارت مرور» همان کارت <span dir="ltr">Rev</span> است و
                      «کارت ساده» همان کارت اصلی بدون پسوند <span dir="ltr">Rev</span>.
                      تفاوت دکمه‌ها در این است که کدام کارت جابه‌جا شود و آیا
                      برای آن پاسخ Anki با ease ثبت شود یا نه.
                    </p>
                  </div>

                  {buildHelpSummaries(selectedDeck).map((item) => (
                    <section
                      key={item.title}
                      className={`rounded-2xl border p-4 ${item.toneClassName}`}
                    >
                      <h3 className="text-sm font-bold">{item.title}</h3>
                      <p className="mt-2 text-sm leading-7">
                        {item.description}
                      </p>
                      <p className="mt-3 text-sm leading-7">
                        {item.reviewMove}
                      </p>
                      <p className="mt-1 text-sm leading-7">
                        {item.simpleMove}
                      </p>
                      {item.extra ? (
                        <p className="mt-1 text-sm leading-7">{item.extra}</p>
                      ) : null}
                    </section>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}
