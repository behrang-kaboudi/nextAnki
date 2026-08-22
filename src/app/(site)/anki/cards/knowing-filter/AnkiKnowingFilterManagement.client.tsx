"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

import { AnkiScoreColumnIcon } from "@/components/anki-score-column-icon";
import { PendingStudyWords } from "@/components/anki/PendingStudyWords.client";
import { PageHeader } from "@/components/page-header";
import { TableColumnSelector } from "@/components/table-column-selector";
import {
  AnkiTag,
  ankiOperations,
  chunkArray,
  getLastRevlogByCardIds,
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
const PRONUNCIATION_CARD = "WordsForNewStudy-Pronunciation" as const;
const PRONUNCIATION_DECK = "WordsForNewStudy::Pronunciation" as const;
const PRONUNCIATION_DUE_OFFSET_MIN_DAYS = 60;
const PRONUNCIATION_DUE_OFFSET_MAX_DAYS = 120;
const GOOD_DUE_OFFSET_MIN_DAYS = 20;
const GOOD_DUE_OFFSET_MAX_DAYS = 40;
const EASY_DUE_OFFSET_MIN_DAYS = 80;
const EASY_DUE_OFFSET_MAX_DAYS = 160;
const REVIEW_PRONUNCIATION_CARD = "WordsForNewStudy-ReviewPronunciation" as const;
const REVIEW_PRONUNCIATION_DECK = "WordsForNewStudy::ReviewPronunciation" as const;
const FA_TO_EN_WITH_HELP_CARD = "WordsForNewStudy-FaToEnWithHelp" as const;
const FA_TO_EN_WITH_HELP_DECK = "WordsForNewStudy::FaToEnWithHelp" as const;
const HARD_CARDS_DECK = "WordsForNewStudy::FaToEn" as const;
const HARD_CARDS_CARD = "FaToEn" as const;

const TABLE_COLUMNS = [
  { key: "index", label: "#" },
  { key: "word", label: "Word" },
  { key: "meaning", label: "Meaning" },
  { key: "actions", label: "Actions" },
  { key: "sentence", label: "Sentence" },
  { key: "sentenceMeaning", label: "Sentence Meaning" },
  { key: "learningDepth", label: "🧠" },
  { key: "imageability", label: "🖼️" },
  { key: "productiveTarget", label: "🎯" },
  { key: "productiveLearningAverage", label: "⚖️" },
  { key: "threeFieldAverage", label: "📊" },
] as const;
type TableColumnKey = (typeof TABLE_COLUMNS)[number]["key"];
const DEFAULT_COLUMNS: TableColumnKey[] = TABLE_COLUMNS.map((column) => column.key);

type DeckName = typeof FILTER_KNOWING_DECK;

type CardRow = {
  cardId: number;
  noteId: number;
  fields: AnkiNotesInfo[number]["fields"];
  tags: string[];
};

type HardCardRow = CardRow & {
  suspended: boolean;
};

type ScoreSortKey =
  | "learningDepth"
  | "imageability"
  | "productiveTarget"
  | "productiveLearningAverage"
  | "threeFieldAverage";

type KnowledgeAction = "again" | "familiar" | "good" | "easy";

type HelpActionSummary = {
  title: string;
  results: string[];
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

function numericField(row: CardRow, fieldName: string) {
  const value = Number(fieldValue(row, fieldName));
  return fieldValue(row, fieldName) && Number.isFinite(value) ? value : null;
}

function scoreAverage(row: CardRow, fieldNames: string[]) {
  const values = fieldNames.map((fieldName) => {
    const value = numericField(row, fieldName);
    return fieldName === "learning_depth" && value !== null ? value * 100 : value;
  });
  if (values.some((value) => value === null)) return null;
  return (values as number[]).reduce((sum, value) => sum + value, 0) / values.length;
}

function formatScore(value: number | null) {
  if (value === null) return "—";
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function scoreForSort(row: CardRow, key: ScoreSortKey) {
  switch (key) {
    case "learningDepth":
      return numericField(row, "learning_depth");
    case "imageability":
      return numericField(row, "imageability");
    case "productiveTarget":
      return numericField(row, "productive_target");
    case "productiveLearningAverage":
      return scoreAverage(row, ["productive_target", "learning_depth"]);
    case "threeFieldAverage":
      return scoreAverage(row, [
        "learning_depth",
        "imageability",
        "productive_target",
      ]);
  }
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
    pronunciation: {
      cardType: PRONUNCIATION_CARD,
      deck: PRONUNCIATION_DECK,
    },
    reviewPronunciation: {
      cardType: REVIEW_PRONUNCIATION_CARD,
      deck: REVIEW_PRONUNCIATION_DECK,
    },
    faToEnWithHelp: {
      cardType: FA_TO_EN_WITH_HELP_CARD,
      deck: FA_TO_EN_WITH_HELP_DECK,
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
        { target: "review", ease: 4, repetitions: 1 },
        { target: "pronunciation", ease: 4, repetitions: 1 },
        { target: "reviewPronunciation", ease: 4, repetitions: 1 },
        { target: "faToEnWithHelp", ease: 1, repetitions: 1 },
      ];
    case "familiar":
      return [
        { target: "enToFa", ease: 3, repetitions: 1 },
        { target: "review", ease: 4, repetitions: 1 },
        { target: "pronunciation", ease: 4, repetitions: 1 },
        { target: "reviewPronunciation", ease: 4, repetitions: 1 },
      ];
    case "good":
      return [
        { target: "enToFa", ease: 4, repetitions: 1 },
        { target: "faToEn", ease: 4, repetitions: 1 },
        { target: "review", ease: 4, repetitions: 1 },
        { target: "pronunciation", ease: 4, repetitions: 1 },
        { target: "reviewPronunciation", ease: 4, repetitions: 1 },
        { target: "faToEnWithHelp", ease: 4, repetitions: 1 },
      ];
    case "easy":
      return [
        { target: "enToFa", ease: 4, repetitions: 1 },
        { target: "faToEn", ease: 4, repetitions: 1 },
        { target: "review", ease: 4, repetitions: 1 },
        { target: "pronunciation", ease: 4, repetitions: 1 },
        { target: "reviewPronunciation", ease: 4, repetitions: 1 },
        { target: "faToEnWithHelp", ease: 4, repetitions: 1 },
      ];
  }
}

function randomDueOffsetDays(minDays: number, maxDays: number) {
  return Math.floor(Math.random() * (maxDays - minDays + 1)) + minDays;
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
      results: [
        `${WordAnkiConstants.cardTypes.EnToFa} → ${WordAnkiConstants.decks.EnToFa}: یک بار Again (ease=1).`,
        `${WordAnkiConstants.cardTypes.FaToEn} → ${WordAnkiConstants.decks.FaToEn}: یک بار Again (ease=1).`,
        `${REVIEW_CARD} → ${REVIEW_DECK}: یک بار Easy (ease=4).`,
        `${PRONUNCIATION_CARD} → ${PRONUNCIATION_DECK}: یک بار Easy (ease=4)، سپس افزودن رندم ۶۰ تا ۱۲۰ روز به تاریخ حاصل از Easy.`,
        `${REVIEW_PRONUNCIATION_CARD} → ${REVIEW_PRONUNCIATION_DECK}: یک بار Easy (ease=4).`,
        `${FA_TO_EN_WITH_HELP_CARD} → ${FA_TO_EN_WITH_HELP_DECK}: یک بار Again (ease=1).`,
      ],
      toneClassName:
        "border-red-500/20 bg-red-500/5 text-red-800 dark:text-red-300",
    },
    {
      title: "آشنا هستم",
      results: [
        `${WordAnkiConstants.cardTypes.EnToFa} → ${WordAnkiConstants.decks.EnToFa}: یک بار Good (ease=3).`,
        `${WordAnkiConstants.cardTypes.FaToEn} → ${WordAnkiConstants.decks.FaToEn}: فقط انتقال؛ بدون پاسخ یا ریست.`,
        `${REVIEW_CARD} → ${REVIEW_DECK}: یک بار Easy (ease=4).`,
        `${PRONUNCIATION_CARD} → ${PRONUNCIATION_DECK}: یک بار Easy (ease=4)، سپس افزودن رندم ۶۰ تا ۱۲۰ روز به تاریخ حاصل از Easy.`,
        `${REVIEW_PRONUNCIATION_CARD} → ${REVIEW_PRONUNCIATION_DECK}: یک بار Easy (ease=4).`,
        `${FA_TO_EN_WITH_HELP_CARD} → ${FA_TO_EN_WITH_HELP_DECK}: فقط انتقال؛ بدون پاسخ یا ریست.`,
      ],
      toneClassName:
        "border-amber-500/20 bg-amber-500/5 text-amber-800 dark:text-amber-300",
    },
    {
      title: "بلدم",
      results: [
        `${WordAnkiConstants.cardTypes.EnToFa} → ${WordAnkiConstants.decks.EnToFa}: یک بار Easy (ease=4)، سپس افزودن رندم ۲۰ تا ۴۰ روز به تاریخ حاصل از Easy.`,
        `${WordAnkiConstants.cardTypes.FaToEn} → ${WordAnkiConstants.decks.FaToEn}: یک بار Easy (ease=4)، سپس افزودن رندم ۲۰ تا ۴۰ روز به تاریخ حاصل از Easy.`,
        `${REVIEW_CARD} → ${REVIEW_DECK}: یک بار Easy (ease=4)، سپس افزودن رندم ۲۰ تا ۴۰ روز به تاریخ حاصل از Easy.`,
        `${PRONUNCIATION_CARD} → ${PRONUNCIATION_DECK}: یک بار Easy (ease=4)، سپس افزودن رندم ۲۰ تا ۴۰ روز به تاریخ حاصل از Easy.`,
        `${REVIEW_PRONUNCIATION_CARD} → ${REVIEW_PRONUNCIATION_DECK}: یک بار Easy (ease=4)، سپس افزودن رندم ۲۰ تا ۴۰ روز به تاریخ حاصل از Easy.`,
        `${FA_TO_EN_WITH_HELP_CARD} → ${FA_TO_EN_WITH_HELP_DECK}: یک بار Easy (ease=4)، سپس افزودن رندم ۲۰ تا ۴۰ روز به تاریخ حاصل از Easy.`,
      ],
      toneClassName:
        "border-emerald-500/20 bg-emerald-500/5 text-emerald-800 dark:text-emerald-300",
    },
    {
      title: "عالی",
      results: [
        `${WordAnkiConstants.cardTypes.EnToFa} → ${WordAnkiConstants.decks.EnToFa}: یک بار Easy (ease=4)، سپس افزودن رندم ۸۰ تا ۱۶۰ روز به تاریخ حاصل از Easy.`,
        `${WordAnkiConstants.cardTypes.FaToEn} → ${WordAnkiConstants.decks.FaToEn}: یک بار Easy (ease=4)، سپس افزودن رندم ۸۰ تا ۱۶۰ روز به تاریخ حاصل از Easy.`,
        `${REVIEW_CARD} → ${REVIEW_DECK}: یک بار Easy (ease=4)، سپس افزودن رندم ۸۰ تا ۱۶۰ روز به تاریخ حاصل از Easy.`,
        `${PRONUNCIATION_CARD} → ${PRONUNCIATION_DECK}: یک بار Easy (ease=4)، سپس افزودن رندم ۶۰ تا ۱۲۰ روز به تاریخ حاصل از Easy.`,
        `${REVIEW_PRONUNCIATION_CARD} → ${REVIEW_PRONUNCIATION_DECK}: یک بار Easy (ease=4)، سپس افزودن رندم ۸۰ تا ۱۶۰ روز به تاریخ حاصل از Easy.`,
        `${FA_TO_EN_WITH_HELP_CARD} → ${FA_TO_EN_WITH_HELP_DECK}: یک بار Easy (ease=4)، سپس افزودن رندم ۸۰ تا ۱۶۰ روز به تاریخ حاصل از Easy.`,
      ],
      toneClassName:
        "border-sky-500/20 bg-sky-500/5 text-sky-800 dark:text-sky-300",
    },
  ];
}

export default function AnkiKnowingFilterManagementClient() {
  const searchParams = useSearchParams();
  const requestedColumns = searchParams.getAll("columns");
  const selectedColumns = requestedColumns.length
    ? DEFAULT_COLUMNS.filter((column) => requestedColumns.includes(column))
    : DEFAULT_COLUMNS;
  const hasColumn = (key: TableColumnKey) => selectedColumns.includes(key);
  const selectedDeck: DeckName = FILTER_KNOWING_DECK;
  const [includeFiltered, setIncludeFiltered] = useState(false);
  const [includeNotFiltered, setIncludeNotFiltered] = useState(true);
  const [wordSearch, setWordSearch] = useState("");
  const [appliedWordSearch, setAppliedWordSearch] = useState<string | null>(null);
  const [rows, setRows] = useState<CardRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [busyCardId, setBusyCardId] = useState<number | null>(null);
  const [busyAction, setBusyAction] = useState<KnowledgeAction | null>(null);
  const [selectedCardIds, setSelectedCardIds] = useState<Set<number>>(() => new Set());
  const [isBulkRunning, setIsBulkRunning] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ completed: number; total: number } | null>(null);
  const selectAllRef = useRef<HTMLInputElement>(null);
  const selectVisibleRef = useRef<HTMLInputElement>(null);
  const [completedActions, setCompletedActions] = useState<
    Record<number, KnowledgeAction>
  >({});
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [scoreSort, setScoreSort] = useState<{
    key: ScoreSortKey;
    direction: "asc" | "desc";
  } | null>(null);
  const [isHardCardsOpen, setIsHardCardsOpen] = useState(false);
  const [hardCards, setHardCards] = useState<HardCardRow[]>([]);
  const [hardCardsLoading, setHardCardsLoading] = useState(false);
  const [hardCardsError, setHardCardsError] = useState<string | null>(null);
  const [hardCardsStatus, setHardCardsStatus] = useState<string | null>(null);
  const [hardCardBusyId, setHardCardBusyId] = useState<number | null>(null);
  const [bulkSuspendBusy, setBulkSuspendBusy] = useState(false);
  const [hardThreshold, setHardThreshold] = useState("100");
  const [appliedHardThreshold, setAppliedHardThreshold] = useState<number | null>(
    100,
  );
  const [hardSortDirection, setHardSortDirection] = useState<"asc" | "desc">(
    "asc",
  );

  const totalPages = Math.max(1, Math.ceil((rows?.length ?? 0) / pageSize));
  const sortedRows = useMemo(() => {
    if (!rows || !scoreSort) return rows;
    const direction = scoreSort.direction === "asc" ? 1 : -1;
    return [...rows].sort((left, right) => {
      const leftValue = scoreForSort(left, scoreSort.key);
      const rightValue = scoreForSort(right, scoreSort.key);
      if (leftValue === null && rightValue === null) return 0;
      if (leftValue === null) return 1;
      if (rightValue === null) return -1;
      return (leftValue - rightValue) * direction;
    });
  }, [rows, scoreSort]);
  const visibleRows = useMemo(
    () =>
      sortedRows?.slice(
        (currentPage - 1) * pageSize,
        currentPage * pageSize,
      ) ?? [],
    [currentPage, pageSize, sortedRows],
  );
  const selectableRows = useMemo(
    () => (rows ?? []).filter((row) => !row.tags.includes(AnkiTag.Filtered) && completedActions[row.cardId] === undefined),
    [completedActions, rows],
  );
  const allSelectableRowsSelected = selectableRows.length > 0 && selectableRows.every((row) => selectedCardIds.has(row.cardId));
  const someSelectableRowsSelected = selectableRows.some((row) => selectedCardIds.has(row.cardId));
  const selectedSelectableCount = selectableRows.filter((row) => selectedCardIds.has(row.cardId)).length;
  const visibleSelectableRows = visibleRows.filter((row) => !row.tags.includes(AnkiTag.Filtered) && completedActions[row.cardId] === undefined);
  const allVisibleRowsSelected = visibleSelectableRows.length > 0 && visibleSelectableRows.every((row) => selectedCardIds.has(row.cardId));
  const someVisibleRowsSelected = visibleSelectableRows.some((row) => selectedCardIds.has(row.cardId));
  const visibleHardCards = useMemo(() => {
    const filtered = hardCards.filter((row) => {
      if (appliedHardThreshold === null) return true;
      const average = scoreAverage(row, ["productive_target", "learning_depth"]);
      return average !== null && average <= appliedHardThreshold;
    });
    return filtered.sort((left, right) => {
      const leftValue = scoreAverage(left, ["productive_target", "learning_depth"]);
      const rightValue = scoreAverage(right, ["productive_target", "learning_depth"]);
      if (leftValue === null && rightValue === null) return 0;
      if (leftValue === null) return 1;
      if (rightValue === null) return -1;
      return (leftValue - rightValue) * (hardSortDirection === "asc" ? 1 : -1);
    });
  }, [appliedHardThreshold, hardCards, hardSortDirection]);

  async function loadCards(searchTerm?: string) {
    if (isLoading || busyCardId !== null) return;

    const normalizedSearch = searchTerm?.trim().toLocaleLowerCase("en-US") ?? "";
    if (searchTerm !== undefined && !normalizedSearch) {
      setError("Enter an English word to search.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setActionMessage(null);
    setCompletedActions({});
    setSelectedCardIds(new Set());
    setBulkProgress(null);
    setRows(null);
    setCurrentPage(1);
    setAppliedWordSearch(searchTerm === undefined ? null : searchTerm.trim());

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

      const loadedRows = cardIds.flatMap((cardId) => {
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
      });
      setRows(
        normalizedSearch
          ? loadedRows.filter((row) =>
              fieldValue(row, "base_form")
                .toLocaleLowerCase("en-US")
                .includes(normalizedSearch),
            )
          : loadedRows,
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

  async function loadHardCards() {
    if (hardCardsLoading || hardCardBusyId !== null || bulkSuspendBusy) return;

    setHardCardsLoading(true);
    setHardCardsError(null);
    setHardCardsStatus(null);
    try {
      const cardsResponse = await ankiOperations.findCards({
        query: `deck:${quoteAnkiSearchValue(HARD_CARDS_DECK)} card:${quoteAnkiSearchValue(HARD_CARDS_CARD)}`,
      });
      if (!cardsResponse.ok) throw new Error(cardsResponse.error);
      const cardIds = cardsResponse.result ?? [];
      if (!cardIds.length) {
        setHardCards([]);
        return;
      }

      const cardInfo: Array<{
        cardId: number;
        note: number;
        queue: number;
        type: number;
      }> = [];
      const suspendedByCardId = new Map<number, boolean>();
      for (const batch of chunkArray(cardIds, BATCH_SIZE)) {
        const [infoResponse, suspendedResponse] = await Promise.all([
          ankiOperations.cardsInfo({ cards: batch }),
          ankiOperations.areSuspended({ cards: batch }),
        ]);
        if (!infoResponse.ok) throw new Error(infoResponse.error);
        if (!suspendedResponse.ok) throw new Error(suspendedResponse.error);
        cardInfo.push(...(infoResponse.result ?? []));
        batch.forEach((cardId, index) => {
          suspendedByCardId.set(
            cardId,
            Boolean(suspendedResponse.result?.[index]),
          );
        });
      }

      const lastReviewsResponse = await getLastRevlogByCardIds(
        cardInfo.map((card) => card.cardId),
        BATCH_SIZE,
      );
      if (!lastReviewsResponse.ok) throw new Error(lastReviewsResponse.error);
      const eligibleCards = cardInfo.filter(
        (card) =>
          card.queue === 0 ||
          card.type === 0 ||
          lastReviewsResponse.value.get(card.cardId)?.ease === 1,
      );
      const noteIds = [...new Set(eligibleCards.map((card) => card.note))];
      const notesById = new Map<number, AnkiNotesInfo[number]>();
      for (const batch of chunkArray(noteIds, BATCH_SIZE)) {
        const notesResponse = await ankiOperations.notesInfo({ notes: batch });
        if (!notesResponse.ok) throw new Error(notesResponse.error);
        for (const note of notesResponse.result ?? []) {
          notesById.set(note.noteId, note);
        }
      }

      setHardCards(
        eligibleCards.flatMap((card) => {
          const note = notesById.get(card.note);
          return note
            ? [
                {
                  cardId: card.cardId,
                  noteId: note.noteId,
                  fields: note.fields,
                  tags: note.tags,
                  suspended: suspendedByCardId.get(card.cardId) ?? false,
                },
              ]
            : [];
        }),
      );
    } catch (caughtError) {
      setHardCardsError(
        caughtError instanceof Error
          ? caughtError.message
          : "بارگذاری کارت‌های سخت ناموفق بود.",
      );
    } finally {
      setHardCardsLoading(false);
    }
  }

  function applyHardCardsFilter() {
    const value = Number(hardThreshold);
    if (!hardThreshold.trim() || !Number.isFinite(value)) {
      setHardCardsError("یک عدد معتبر برای فیلتر وارد کنید.");
      return;
    }
    setHardCardsError(null);
    setAppliedHardThreshold(value);
  }

  async function setHardCardSuspended(row: HardCardRow, suspended: boolean) {
    if (hardCardBusyId !== null || bulkSuspendBusy) return;
    setHardCardBusyId(row.cardId);
    setHardCardsError(null);
    setHardCardsStatus(null);
    try {
      const response = suspended
        ? await ankiOperations.suspend({ cards: [row.cardId] })
        : await ankiOperations.unsuspend({ cards: [row.cardId] });
      if (!response.ok) throw new Error(response.error);
      setHardCards((current) =>
        current.map((item) =>
          item.cardId === row.cardId ? { ...item, suspended } : item,
        ),
      );
      setHardCardsStatus(
        `${fieldValue(row, "base_form") || row.cardId} ${
          suspended ? "suspended" : "unsuspended"
        }.`,
      );
    } catch (caughtError) {
      setHardCardsError(
        caughtError instanceof Error
          ? caughtError.message
          : "تغییر وضعیت کارت ناموفق بود.",
      );
    } finally {
      setHardCardBusyId(null);
    }
  }

  async function suspendFilteredHardCards() {
    if (bulkSuspendBusy || hardCardBusyId !== null) return;
    const cardIds = visibleHardCards
      .filter((row) => !row.suspended)
      .map((row) => row.cardId);
    if (!cardIds.length) {
      setHardCardsStatus("همهٔ کارت‌های نتیجهٔ فیلتر از قبل suspended هستند.");
      return;
    }

    setBulkSuspendBusy(true);
    setHardCardsError(null);
    setHardCardsStatus(null);
    try {
      for (const batch of chunkArray(cardIds, BATCH_SIZE)) {
        const response = await ankiOperations.suspend({ cards: batch });
        if (!response.ok) throw new Error(response.error);
      }
      const changedIds = new Set(cardIds);
      setHardCards((current) =>
        current.map((row) =>
          changedIds.has(row.cardId) ? { ...row, suspended: true } : row,
        ),
      );
      setHardCardsStatus(`${cardIds.length} کارت suspended شد.`);
    } catch (caughtError) {
      setHardCardsError(
        caughtError instanceof Error
          ? caughtError.message
          : "Suspend گروهی ناموفق بود.",
      );
    } finally {
      setBulkSuspendBusy(false);
    }
  }

  useEffect(() => {
    void loadCards();
    // The initial search intentionally runs only once when the page opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someSelectableRowsSelected && !allSelectableRowsSelected;
    }
    if (selectVisibleRef.current) {
      selectVisibleRef.current.indeterminate = someVisibleRowsSelected && !allVisibleRowsSelected;
    }
  }, [allSelectableRowsSelected, allVisibleRowsSelected, someSelectableRowsSelected, someVisibleRowsSelected]);

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

  async function postponeCardsFromEasyDue(cardIds: number[], deck: string, minDays: number, maxDays: number, cardLabel: string) {
    const infoResponse = await ankiOperations.cardsInfo({ cards: cardIds });
    if (!infoResponse.ok) throw new Error(infoResponse.error);
    if (
      !Array.isArray(infoResponse.result) ||
      infoResponse.result.length !== cardIds.length
    ) {
      throw new Error(`تاریخ حاصل از Easy برای کارت ${cardLabel} دریافت نشد.`);
    }

    const expectedDueByCardId = new Map<number, number>();
    for (const card of infoResponse.result) {
      if (
        card.deckName !== deck ||
        card.type !== 2 ||
        card.queue !== 2 ||
        !Number.isInteger(card.due)
      ) {
        throw new Error(
          `کارت ${cardLabel} شمارهٔ ${card.cardId} پس از Easy در صف مرور استاندارد قرار نگرفت.`,
        );
      }

      const nextDue = card.due + randomDueOffsetDays(minDays, maxDays);
      const updateResponse = await ankiOperations.setSpecificValueOfCard({
        card: card.cardId,
        keys: ["due"],
        newValues: [nextDue],
        warning_check: true,
      });
      if (
        !updateResponse.ok ||
        !Array.isArray(updateResponse.result) ||
        updateResponse.result.length !== 1 ||
        updateResponse.result[0] !== true
      ) {
        throw new Error(
          updateResponse.ok
            ? `تاریخ جدید کارت ${cardLabel} شمارهٔ ${card.cardId} ذخیره نشد.`
            : updateResponse.error,
        );
      }
      expectedDueByCardId.set(card.cardId, nextDue);
    }

    const confirmResponse = await ankiOperations.cardsInfo({ cards: cardIds });
    if (!confirmResponse.ok) throw new Error(confirmResponse.error);
    if (
      !Array.isArray(confirmResponse.result) ||
      confirmResponse.result.length !== cardIds.length ||
      confirmResponse.result.some(
        (card) => expectedDueByCardId.get(card.cardId) !== card.due,
      )
    ) {
      throw new Error(`ذخیرهٔ تاریخ جدید کارت ${cardLabel} تأیید نشد.`);
    }
  }

  async function applyKnowledgeAction(row: CardRow, action: (typeof ACTIONS)[number]) {
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
      const pronunciationCardIds = await findNoteCards(
        row.noteId,
        targets.pronunciation.cardType,
      );
      const reviewPronunciationCardIds = await findNoteCards(
        row.noteId,
        targets.reviewPronunciation.cardType,
      );
      const faToEnWithHelpCardIds = await findNoteCards(
        row.noteId,
        targets.faToEnWithHelp.cardType,
      );
      const cardIdsByTarget = {
        enToFa: enToFaCardIds,
        faToEn: faToEnCardIds,
        review: reviewCardIds,
        pronunciation: pronunciationCardIds,
        reviewPronunciation: reviewPronunciationCardIds,
        faToEnWithHelp: faToEnWithHelpCardIds,
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
        [targets.pronunciation, pronunciationCardIds],
        [targets.reviewPronunciation, reviewPronunciationCardIds],
        [targets.faToEnWithHelp, faToEnWithHelpCardIds],
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
        if (action.value === "good" || action.value === "easy") {
          const isEasyPronunciation = action.value === "easy" && instruction.target === "pronunciation";
          await postponeCardsFromEasyDue(
            answerCardIds,
            targets[instruction.target].deck,
            isEasyPronunciation ? PRONUNCIATION_DUE_OFFSET_MIN_DAYS : action.value === "good" ? GOOD_DUE_OFFSET_MIN_DAYS : EASY_DUE_OFFSET_MIN_DAYS,
            isEasyPronunciation ? PRONUNCIATION_DUE_OFFSET_MAX_DAYS : action.value === "good" ? GOOD_DUE_OFFSET_MAX_DAYS : EASY_DUE_OFFSET_MAX_DAYS,
            targets[instruction.target].cardType,
          );
        } else if (instruction.target === "pronunciation") {
          await postponeCardsFromEasyDue(answerCardIds, targets.pronunciation.deck, PRONUNCIATION_DUE_OFFSET_MIN_DAYS, PRONUNCIATION_DUE_OFFSET_MAX_DAYS, targets.pronunciation.cardType);
        }
      }
  }

  function markRowCompleted(row: CardRow, action: KnowledgeAction) {
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
        [row.cardId]: action,
      }));
      setSelectedCardIds((current) => {
        const next = new Set(current);
        next.delete(row.cardId);
        return next;
      });
  }

  async function runRowAction(row: CardRow, action: (typeof ACTIONS)[number]) {
    if (busyCardId !== null || isBulkRunning || completedActions[row.cardId]) return;

    setBusyCardId(row.cardId);
    setBusyAction(action.value);
    setError(null);
    setActionMessage(null);

    try {
      await applyKnowledgeAction(row, action);
      markRowCompleted(row, action.value);
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

  function toggleRowSelection(cardId: number, checked: boolean) {
    setSelectedCardIds((current) => {
      const next = new Set(current);
      if (checked) next.add(cardId);
      else next.delete(cardId);
      return next;
    });
  }

  function toggleAllSelectableRows(checked: boolean) {
    setSelectedCardIds((current) => {
      const next = new Set(current);
      for (const row of selectableRows) {
        if (checked) next.add(row.cardId);
        else next.delete(row.cardId);
      }
      return next;
    });
  }

  function toggleVisibleRows(checked: boolean) {
    setSelectedCardIds((current) => {
      const next = new Set(current);
      for (const row of visibleSelectableRows) {
        if (checked) next.add(row.cardId);
        else next.delete(row.cardId);
      }
      return next;
    });
  }

  async function runBulkAction(action: (typeof ACTIONS)[number]) {
    if (isBulkRunning || busyCardId !== null) return;
    const selectedRows = selectableRows.filter((row) => selectedCardIds.has(row.cardId));
    if (!selectedRows.length) return;

    setIsBulkRunning(true);
    setBusyAction(action.value);
    setBulkProgress({ completed: 0, total: selectedRows.length });
    setError(null);
    setActionMessage(null);

    let succeeded = 0;
    const failures: string[] = [];
    for (const row of selectedRows) {
      setBusyCardId(row.cardId);
      try {
        await applyKnowledgeAction(row, action);
        markRowCompleted(row, action.value);
        succeeded += 1;
      } catch (caughtError) {
        failures.push(`${fieldValue(row, "base_form") || row.noteId}: ${caughtError instanceof Error ? caughtError.message : "خطای نامشخص"}`);
      }
      setBulkProgress({ completed: succeeded + failures.length, total: selectedRows.length });
    }

    setBusyCardId(null);
    setBusyAction(null);
    setIsBulkRunning(false);
    setActionMessage(`${action.label}: ${succeeded.toLocaleString()} مورد با موفقیت انجام شد${failures.length ? ` و ${failures.length.toLocaleString()} مورد ناموفق ماند` : ""}.`);
    if (failures.length) {
      setError(`موارد ناموفق برای تلاش دوباره انتخاب‌شده باقی ماندند: ${failures.join(" | ")}`);
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

  function scoreSortButton(key: ScoreSortKey) {
    const active = scoreSort?.key === key;
    return (
      <button
        type="button"
        onClick={() => {
          setScoreSort((current) => ({
            key,
            direction:
              current?.key === key && current.direction === "asc"
                ? "desc"
                : "asc",
          }));
          setCurrentPage(1);
        }}
        className="inline-flex items-center gap-1 hover:text-foreground"
      >
        <AnkiScoreColumnIcon metric={key} />
        <span aria-hidden="true">
          {active ? (scoreSort.direction === "asc" ? "↑" : "↓") : "↕"}
        </span>
      </button>
    );
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
            subtitle="مدیریت کارت‌های متناظر هر کلمه در دک فیلتر شناخت"
          />
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setIsHardCardsOpen(true);
                if (!hardCards.length) void loadHardCards();
              }}
              className="h-10 rounded-xl border border-card bg-card px-3 text-sm font-semibold text-foreground shadow-elevated transition hover:bg-background"
            >
              Manage Difficult Cards
            </button>
            <button
              type="button"
              onClick={() => setIsHelpOpen(true)}
              aria-label="راهنمای اکشن‌ها"
              title="راهنمای اکشن‌ها"
              className="grid size-10 place-items-center rounded-full border border-card bg-card text-lg font-bold text-foreground shadow-elevated transition hover:bg-background"
            >
              ?
            </button>
          </div>
        </div>

        <PendingStudyWords user="behrang" />

        <section className="rounded-2xl border border-card bg-background p-4">
          <TableColumnSelector
            key={selectedColumns.join(",")}
            columns={TABLE_COLUMNS}
            selectedColumns={selectedColumns}
          />
        </section>

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

          <form
            className="mt-4 grid gap-3 border-t border-card pt-4 lg:grid-cols-[minmax(16rem,1fr)_auto] lg:items-end"
            onSubmit={(event) => {
              event.preventDefault();
              void loadCards(wordSearch);
            }}
          >
            <label className="grid gap-1">
              <span className="text-xs font-semibold text-muted">
                Search English word in this deck
              </span>
              <input
                dir="ltr"
                required
                value={wordSearch}
                onChange={(event) => setWordSearch(event.target.value)}
                placeholder="e.g. example"
                className="h-11 w-full rounded-xl border border-card bg-card px-3 text-sm text-foreground outline-none placeholder:text-muted focus:ring-2 focus:ring-[var(--ring)]"
              />
            </label>
            <button
              type="submit"
              disabled={isLoading}
              className="h-11 rounded-xl border border-card bg-card px-5 text-sm font-semibold text-foreground shadow-elevated transition hover:bg-background disabled:opacity-60"
            >
              {isLoading ? "Searching…" : "Search"}
            </button>
            <p className="text-xs text-muted lg:col-span-2">
              Searches <code>base_form</code> only among cards matching the selected deck and tag filters.
            </p>
          </form>
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
                {appliedWordSearch ? ` matching “${appliedWordSearch}”` : ""} · صفحه {currentPage} از {totalPages}
              </p>
              <p className="text-xs text-muted">
                اکشن‌های انجام‌شده در این بارگذاری دوباره اجرا نمی‌شوند.
              </p>
            </div>
            <div dir="rtl" className="mx-2 mb-2 flex flex-wrap items-center gap-2 rounded-xl border border-card bg-background p-3">
              <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-foreground">
                <input
                  ref={selectAllRef}
                  type="checkbox"
                  checked={allSelectableRowsSelected}
                  onChange={(event) => toggleAllSelectableRows(event.target.checked)}
                  disabled={selectableRows.length === 0 || busyCardId !== null || isBulkRunning}
                  className="size-4 accent-[var(--primary)] disabled:opacity-50"
                />
                انتخاب همهٔ نتایج
              </label>
              <span className="text-xs text-muted">{selectedSelectableCount.toLocaleString()} از {selectableRows.length.toLocaleString()} انتخاب شده</span>
              <div className="flex flex-wrap gap-1.5">
                {ACTIONS.map((action) => (
                  <button
                    key={action.value}
                    type="button"
                    onClick={() => void runBulkAction(action)}
                    disabled={selectedSelectableCount === 0 || busyCardId !== null || isBulkRunning}
                    className={`rounded-md border bg-card px-3 py-1.5 text-xs font-semibold transition hover:bg-background disabled:cursor-not-allowed disabled:opacity-50 ${action.className}`}
                  >
                    {isBulkRunning && busyAction === action.value ? "در حال انجام…" : `${action.label} برای انتخاب‌ها`}
                  </button>
                ))}
              </div>
              {bulkProgress ? <span className="text-xs font-semibold text-muted">پیشرفت: {bulkProgress.completed.toLocaleString()} از {bulkProgress.total.toLocaleString()}</span> : null}
            </div>
            {renderPaginationControls()}

            <div className="overflow-auto rounded-xl border border-card bg-background">
              <table className="w-full min-w-[1000px] border-collapse text-sm">
                <thead className="sticky top-0 bg-background">
                  <tr className="border-b border-card">
                    <th className="w-10 px-3 py-2 text-center font-semibold">
                      <input
                        ref={selectVisibleRef}
                        type="checkbox"
                        aria-label="انتخاب ردیف‌های صفحهٔ فعلی"
                        title="انتخاب ردیف‌های صفحهٔ فعلی"
                        checked={allVisibleRowsSelected}
                        onChange={(event) => toggleVisibleRows(event.target.checked)}
                        disabled={visibleSelectableRows.length === 0 || busyCardId !== null || isBulkRunning}
                        className="size-4 accent-[var(--primary)] disabled:opacity-40"
                      />
                    </th>
                    {hasColumn("index") ? <th className="px-3 py-2 text-left font-semibold">#</th> : null}
                    {hasColumn("word") ? <th className="px-3 py-2 text-left font-semibold">Word</th> : null}
                    {hasColumn("meaning") ? <th dir="rtl" className="w-48 px-3 py-2 text-right font-semibold">Meaning</th> : null}
                    {hasColumn("actions") ? <th className="px-3 py-2 text-right font-semibold">Actions</th> : null}
                    {hasColumn("sentence") ? <th className="px-3 py-2 text-left font-semibold">Sentence</th> : null}
                    {hasColumn("sentenceMeaning") ? <th dir="rtl" className="px-3 py-2 text-right font-semibold">Sentence Meaning</th> : null}
                    {hasColumn("learningDepth") ? <th className="px-3 py-2 text-center font-semibold">{scoreSortButton("learningDepth")}</th> : null}
                    {hasColumn("imageability") ? <th className="px-3 py-2 text-center font-semibold">{scoreSortButton("imageability")}</th> : null}
                    {hasColumn("productiveTarget") ? <th className="px-3 py-2 text-center font-semibold">{scoreSortButton("productiveTarget")}</th> : null}
                    {hasColumn("productiveLearningAverage") ? <th className="px-3 py-2 text-center font-semibold">{scoreSortButton("productiveLearningAverage")}</th> : null}
                    {hasColumn("threeFieldAverage") ? <th className="px-3 py-2 text-center font-semibold">{scoreSortButton("threeFieldAverage")}</th> : null}
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
                        <td className="px-3 py-3 text-center align-top">
                          <input
                            type="checkbox"
                            aria-label={`انتخاب ${word || row.cardId}`}
                            checked={selectedCardIds.has(row.cardId)}
                            onChange={(event) => toggleRowSelection(row.cardId, event.target.checked)}
                            disabled={row.tags.includes(AnkiTag.Filtered) || completedActions[row.cardId] !== undefined || busyCardId !== null || isBulkRunning}
                            className="size-4 accent-[var(--primary)] disabled:opacity-40"
                          />
                        </td>
                        {hasColumn("index") ? <td className="px-3 py-3 text-muted">{(currentPage - 1) * pageSize + index + 1}</td> : null}
                        {hasColumn("word") ? renderValue(word) : null}
                        {hasColumn("meaning") ? renderMeaning(meaning, "w-48 max-w-48") : null}
                        {hasColumn("actions") ? <td className="px-3 py-3 text-right align-top">
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
                                    isBulkRunning ||
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
                        </td> : null}
                        {hasColumn("sentence") ? renderValue(sentence) : null}
                        {hasColumn("sentenceMeaning") ? renderMeaning(sentenceMeaning) : null}
                        {hasColumn("learningDepth") ? <td className="px-3 py-3 text-center font-mono text-xs">{formatScore(numericField(row, "learning_depth"))}</td> : null}
                        {hasColumn("imageability") ? <td className="px-3 py-3 text-center font-mono text-xs">{formatScore(numericField(row, "imageability"))}</td> : null}
                        {hasColumn("productiveTarget") ? <td className="px-3 py-3 text-center font-mono text-xs">{formatScore(numericField(row, "productive_target"))}</td> : null}
                        {hasColumn("productiveLearningAverage") ? <td className="px-3 py-3 text-center font-mono text-xs">{formatScore(scoreAverage(row, ["productive_target", "learning_depth"]))}</td> : null}
                        {hasColumn("threeFieldAverage") ? <td className="px-3 py-3 text-center font-mono text-xs">{formatScore(scoreAverage(row, ["learning_depth", "imageability", "productive_target"]))}</td> : null}
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

        {isHardCardsOpen ? (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-card bg-card shadow-2xl">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-card p-5">
                <div>
                  <h2 className="text-lg font-bold text-foreground">Manage Difficult Cards</h2>
                  <p className="mt-1 text-xs text-muted">
                    New cards or cards whose latest answer was Again in {HARD_CARDS_DECK}
                  </p>
                </div>
                <button type="button" onClick={() => setIsHardCardsOpen(false)} aria-label="Close" className="grid size-10 place-items-center rounded-full border border-card bg-background text-xl text-muted hover:text-foreground">×</button>
              </div>

              <div className="flex flex-wrap items-end gap-2 border-b border-card p-4">
                <label className="grid gap-1">
                  <span className="text-xs font-semibold text-muted">⚖️ maximum</span>
                  <input
                    type="number"
                    value={hardThreshold}
                    onChange={(event) => setHardThreshold(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") applyHardCardsFilter();
                    }}
                    className="h-10 w-32 rounded-xl border border-card bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
                  />
                </label>
                <button type="button" onClick={applyHardCardsFilter} className="h-10 rounded-xl border border-card bg-background px-4 text-sm font-semibold hover:bg-accent">Filter</button>
                <button type="button" onClick={() => void loadHardCards()} disabled={hardCardsLoading || bulkSuspendBusy || hardCardBusyId !== null} className="h-10 rounded-xl border border-card bg-background px-4 text-sm font-semibold hover:bg-accent disabled:opacity-50">
                  {hardCardsLoading ? "Loading…" : "Reload"}
                </button>
                <button type="button" onClick={() => void suspendFilteredHardCards()} disabled={hardCardsLoading || bulkSuspendBusy || hardCardBusyId !== null || visibleHardCards.length === 0} className="h-10 rounded-xl bg-[var(--primary)] px-4 text-sm font-semibold text-[var(--primary-foreground)] disabled:opacity-50">
                  {bulkSuspendBusy ? "Suspending…" : "Suspend"}
                </button>
                <span className="text-xs text-muted">{visibleHardCards.length} of {hardCards.length} cards</span>
              </div>

              {hardCardsError ? <div className="m-4 mb-0 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-400">{hardCardsError}</div> : null}
              {hardCardsStatus ? <div className="mx-4 mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-400">{hardCardsStatus}</div> : null}

              <div className="min-h-0 flex-1 overflow-auto p-4">
                <table className="w-full min-w-[760px] border-collapse text-sm">
                  <thead className="sticky top-0 bg-card">
                    <tr className="border-b border-card">
                      <th className="px-3 py-2 text-left">Word</th>
                      <th className="px-3 py-2 text-right">Meaning</th>
                      <th className="px-3 py-2 text-right">Actions</th>
                      <th className="px-3 py-2 text-center">
                        <button type="button" onClick={() => setHardSortDirection((current) => current === "asc" ? "desc" : "asc")} className="inline-flex items-center gap-1">
                          <AnkiScoreColumnIcon metric="productiveLearningAverage" />
                          <span aria-hidden="true">{hardSortDirection === "asc" ? "↑" : "↓"}</span>
                        </button>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleHardCards.map((row) => (
                      <tr key={row.cardId} className="border-b border-card/70">
                        <td className="px-3 py-3 text-left">{fieldValue(row, "base_form") || "—"}</td>
                        <td dir="rtl" className="px-3 py-3 text-right">{fieldValue(row, "meaning_fa") || "—"}</td>
                        <td className="px-3 py-3 text-right">
                          <button type="button" onClick={() => void setHardCardSuspended(row, !row.suspended)} disabled={hardCardBusyId !== null || bulkSuspendBusy} className="rounded-lg border border-card bg-background px-3 py-1.5 text-xs font-semibold hover:bg-accent disabled:opacity-50">
                            {hardCardBusyId === row.cardId ? "Working…" : row.suspended ? "Unsuspend" : "Suspend"}
                          </button>
                        </td>
                        <td className="px-3 py-3 text-center font-mono text-xs">{formatScore(scoreAverage(row, ["productive_target", "learning_depth"]))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!hardCardsLoading && visibleHardCards.length === 0 ? <div className="p-8 text-center text-sm text-muted">No matching difficult cards.</div> : null}
              </div>
            </div>
          </div>
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
                        <li>برای اجرای گروهی، ردیف‌ها را تکی یا با «انتخاب همهٔ نتایج» انتخاب کن و سپس دکمهٔ گروهی را بزن.</li>
                        <li>کارت‌ها به دک مناسب منتقل می‌شوند و در صورت نیاز پاسخ Anki ثبت می‌شود.</li>
                        <li>برای دیدن وضعیت واقعی پس از عملیات، دوباره «Show Cards» را اجرا کن.</li>
                      </ol>
                    </div>
                    <p className="mt-3 text-muted">
                      هر ردیف یک کارت است، اما دکمه روی نوت همان ردیف اجرا می‌شود
                      و کارت‌های متناظر همان نوت را هم پیدا می‌کند. بنابراین ممکن
                      است یک کلیک روی هر شش کارتِ یک کلمه اثر بگذارد.
                    </p>
                    <p className="mt-2 text-muted">
                      شش کارت متناظر هر Note عبارت‌اند از{" "}
                      <span dir="ltr">EnToFa</span>،{" "}
                      <span dir="ltr">FaToEn</span> و{" "}
                      <span dir="ltr">{REVIEW_CARD}</span> و{" "}
                      <span dir="ltr">{PRONUNCIATION_CARD}</span> و{" "}
                      <span dir="ltr">{REVIEW_PRONUNCIATION_CARD}</span> و{" "}
                      <span dir="ltr">{FA_TO_EN_WITH_HELP_CARD}</span>. اپ این کارت‌ها را
                      برای همان Note پیدا می‌کند و به دک اصلی خودشان منتقل
                      می‌کند؛ سپس بسته به دکمه، پاسخ متفاوتی برای هر کارت اجرا
                      می‌شود.
                    </p>
                    <p className="mt-2 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-amber-800 dark:text-amber-300">
                      منظور از «کارت متناظر» کارت جدید یا کارت مخصوص فیلتر
                      نیست؛ منظور کارت همان Note با نوع EnToFa، FaToEn،{" "}
                      <span dir="ltr">{REVIEW_CARD}</span> یا{" "}
                      <span dir="ltr">{PRONUNCIATION_CARD}</span> یا{" "}
                      <span dir="ltr">{REVIEW_PRONUNCIATION_CARD}</span> یا{" "}
                      <span dir="ltr">{FA_TO_EN_WITH_HELP_CARD}</span> است. ردیف فعلی فقط
                      Note و کلمه را مشخص می‌کند؛ عملیات روی کارت‌های متناظر
                      انجام می‌شود، نه صرفاً روی کارت فیلتر نمایش‌داده‌شده.
                    </p>
                    <div className="mt-3 rounded-xl border border-card bg-card p-3">
                      <h4 className="font-semibold">قاعدهٔ کلی انتقال</h4>
                      <ul className="mt-2 list-inside list-disc space-y-1 text-muted">
                        <li>
                          هر کارت متناظر به دک خودش برمی‌گردد؛ مثلاً{" "}
                          <span dir="ltr">EnToFa</span> به{" "}
                          <span dir="ltr">{WordAnkiConstants.decks.EnToFa}</span>{" "}
                          و <span dir="ltr">FaToEn</span> به{" "}
                          <span dir="ltr">{WordAnkiConstants.decks.FaToEn}</span>{" "}
                          منتقل می‌شود.
                        </li>
                        <li>
                          پس از انتقال، نتیجهٔ هر کارت در فهرست همان دکمه ثبت
                          می‌شود.
                        </li>
                        <li>پاسخ و تغییر موعد هر کارت به دکمهٔ انتخاب‌شده وابسته است و جزئیات کامل آن در بخش‌های پایین آمده است.</li>
                        <li>
                          در شروع هر عملیات تگ{" "}
                          <span dir="ltr">{AnkiTag.Filtered}</span> روی Note اضافه
                          می‌شود و باقی می‌ماند؛ این تگ در انتقال کارت‌ها نقشی ندارد.
                        </li>
                      </ul>
                    </div>
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
                      <ul className="mt-2 list-inside list-disc text-sm leading-7">
                        {item.results.map((result) => (
                          <li key={result} dir="ltr" className="text-left">
                            {result}
                          </li>
                        ))}
                      </ul>
                    </section>
                  ))}

                  <section className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm leading-7 text-amber-800 dark:text-amber-300">
                    <h3 className="font-bold">نکات مهم</h3>
                    <ul className="mt-2 list-inside list-disc">
                      <li>در هر چهار دکمه، شش کارت متناظر همان Note به دک‌های اصلی منتقل می‌شوند.</li>
                      <li>در «بلدم»، هر شش کارت دقیقاً یک بار Easy می‌گیرند و برای هر کارت یک عدد تصادفی مستقل بین ۲۰ تا ۴۰ روز به تاریخ حاصل از Easy اضافه می‌شود.</li>
                      <li>در «عالی»، هر شش کارت دقیقاً یک بار Easy می‌گیرند؛ بازهٔ {PRONUNCIATION_CARD} برابر ۶۰ تا ۱۲۰ روز و بازهٔ پنج نوع دیگر برابر ۸۰ تا ۱۶۰ روز است.</li>
                      <li>«انتخاب همهٔ نتایج» همهٔ ردیف‌های قابل‌اقدام در نتیجهٔ فیلتر را، حتی در صفحه‌های دیگر، انتخاب می‌کند؛ انتخاب تکی نیز مستقل باقی می‌ماند.</li>
                      <li>چک‌باکس بالای ستون انتخاب فقط ردیف‌های قابل‌اقدامِ صفحهٔ فعلی را انتخاب یا لغو انتخاب می‌کند.</li>
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
