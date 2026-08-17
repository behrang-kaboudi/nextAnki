import Link from "next/link";
import { MeaningReviewStatus, type Prisma } from "@prisma/client";

import { PageHeader } from "@/components/page-header";
import {
  TableColumnIndicators,
  type TableColumnIndicator,
} from "@/components/table-column-indicators";
import { TableColumnSelector } from "@/components/table-column-selector";
import {
  getPendingWordAudioTaskCounts,
  getPendingWordSenseConceptAudioIds,
} from "@/lib/audio/wordAudioPending.server";
import { prisma } from "@/lib/prisma";
import { WORD_SENSE_ENGLISH_FIELDS_SELECT } from "@/lib/english/wordSenseEnglishFields.server";
import { getWordColumnEmptyCounts } from "@/lib/words/tableColumnEmptyCounts.server";
import { hydrateWordsWithPrimarySentence } from "@/lib/words/primarySentences.server";
import { primarySentenceId } from "@/lib/words/sentenceIds";
import { getPendingWordSenseConceptMergeStats } from "@/lib/words/wordSenseConceptMerge.server";
import { getPendingWordSenseInflectionMergeStats } from "@/lib/words/wordSenseInflectionMerge.server";
import { getPendingWordSenseMeaningComparisonStats } from "@/lib/words/wordSenseMeaningComparison.server";
import { getMeaningReviewEligibilitySummary } from "@/lib/words/meaningReviewWorkflow.server";
import { getCustomExtractionPendingSummary } from "@/lib/word-extraction/customExtraction.server";

import OpenWordSenseEditorModal from "../../editor/OpenWordSenseEditorModal.client";
import WordSenseRelationPopover, {
  type RelationPopoverField,
} from "./WordSenseRelationPopover.client";
import WordSenseArrayRelationModal, {
  type WordArrayRelationEntry,
} from "./WordSenseArrayRelationModal.client";
import WordSenseMeaningsReview from "./WordSenseMeaningsReview.client";
import WordSenseConceptMerge from "./WordSenseConceptMerge.client";
import WordSenseInflectionMerge from "./WordSenseInflectionMerge.client";
import WordSenseMeaningComparison from "./WordSenseMeaningComparison.client";
import DeleteWordSenseModalButton from "./DeleteWordSenseModalButton.client";
import WordFieldVoiceCell from "../../hints/WordFieldVoiceCell.client";
import BatchWordFieldVoiceGenerateAllFields from "../../hints/BatchWordFieldVoiceGenerateAllFields.client";
import BatchEnglishWordJsonHintGenerate from "../../hints/BatchEnglishWordJsonHintGenerate.client";
import PersianWordMeaningIpaPhase2 from "../persian-words/PersianWordMeaningIpaPhase2.client";
import EnglishWordPhoneticUsPrompt from "../english-words/EnglishWordPhoneticUsPrompt.client";
import TableFieldMaintenance from "@/components/table-field-maintenance/TableFieldMaintenance.client";
import WordSenseSelectVisibleRows from "./WordSenseSelectVisibleRows.client";
import PersianMeaningIpaReview from "./PersianMeaningIpaReview.client";
import WordSenseLearningScores from "./WordSenseLearningScores.client";

export const metadata = { title: "Words — WordSense Table" };
export const runtime = "nodejs";

function parsePositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

const SORT_FIELDS = [
  "id",
  "englishId",
  "meaningId",
  "sentenceIds",
  "conceptMergeReviewed",
  "inflectionMergeReviewed",
  "otherMeaningIds",
  "comparedMeaningWordIds",
  "synonymIds",
  "meaningReviewStatus",
  "pos",
  "concept_explained_fa",
  "concept_explained_fa_audio_file_name",
  "concept_explained_fa_audio_source_text",
  "learning_depth",
  "other_meanings_en",
  "category",
  "hint_to_select",
  "imageability",
  "productive_target",
  "anki_link_id",
  "createdAt",
  "updatedAt",
] as const;
type SortField = (typeof SORT_FIELDS)[number];

const TABLE_COLUMNS = [
  { key: "id", label: "id", required: true },
  { key: "englishId", label: "englishId" },
  { key: "meaningId", label: "meaningId" },
  { key: "sentenceIds", label: "sentenceIds" },
  { key: "conceptMergeReviewed", label: "conceptMergeReviewed" },
  { key: "inflectionMergeReviewed", label: "inflectionMergeReviewed" },
  { key: "otherMeaningIds", label: "otherMeaningIds" },
  { key: "comparedMeaningWordIds", label: "comparedMeaningWordIds" },
  { key: "synonymIds", label: "synonymIds" },
  { key: "meaningReviewStatus", label: "Meaning review status" },
  { key: "pos", label: "pos" },
  { key: "concept_explained_fa", label: "concept_explained_fa" },
  { key: "concept_explained_fa_audio_file_name", label: "concept audio" },
  { key: "concept_explained_fa_audio_source_text", label: "concept audio source text" },
  { key: "learning_depth", label: "learning_depth" },
  { key: "other_meanings_en", label: "other_meanings_en" },
  { key: "category", label: "category" },
  { key: "hint_to_select", label: "hint_to_select" },
  { key: "imageability", label: "imageability" },
  { key: "productive_target", label: "productive_target" },
  { key: "anki_link_id", label: "anki_link_id" },
  { key: "createdAt", label: "createdAt" },
  { key: "updatedAt", label: "updatedAt" },
  { key: "actions", label: "actions" },
] as const;

type TableColumnKey = (typeof TABLE_COLUMNS)[number]["key"];
type MeaningReviewFilter = "all" | "pending" | "reviewed";
const DEFAULT_TABLE_COLUMNS: TableColumnKey[] = [
  "id",
  "englishId",
  "meaningId",
  "sentenceIds",
  "conceptMergeReviewed",
  "inflectionMergeReviewed",
  "otherMeaningIds",
  "comparedMeaningWordIds",
  "synonymIds",
  "meaningReviewStatus",
  "pos",
  "concept_explained_fa",
  "concept_explained_fa_audio_file_name",
  "concept_explained_fa_audio_source_text",
  "anki_link_id",
  "updatedAt",
  "actions",
];

const COLUMN_INDICATORS: Partial<
  Record<TableColumnKey, readonly TableColumnIndicator[]>
> = {
  id: [
    { kind: "primary-key", text: "Primary key: WordSense.id" },
    { kind: "unique", text: "Unique: WordSense.id (enforced by the primary key)" },
  ],
  englishId: [
    {
      kind: "foreign-key",
      text: "Foreign key: WordSense.englishId → EnglishWord.id",
    },
    { kind: "index", text: "Index: WordSense_englishId_idx" },
  ],
  meaningId: [
    {
      kind: "foreign-key",
      text: "Foreign key: WordSense.meaningId → PersianWord.id",
    },
    { kind: "index", text: "Index: WordSense_meaningId_idx" },
  ],
  anki_link_id: [
    { kind: "unique", text: "Unique index: WordSense_anki_link_id_key" },
  ],
};

function parseColumns(value: string | string[] | undefined): TableColumnKey[] {
  const raw = Array.isArray(value) ? value : value ? [value] : [];
  const requested = raw.map((key) => key === "meanings_confirmed" ? "meaningReviewStatus" : key);
  return requested.length
    ? TABLE_COLUMNS.map((column) => column.key).filter(
        (key) => key === "id" || requested.includes(key),
      )
    : DEFAULT_TABLE_COLUMNS;
}

function parseSortField(value: string | undefined): SortField {
  if (value === "meanings_confirmed") return "meaningReviewStatus";
  return SORT_FIELDS.includes(value as SortField)
    ? (value as SortField)
    : "updatedAt";
}

function meaningIds(value: Prisma.JsonValue | null) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const id =
      typeof item === "number"
        ? item
        : typeof item === "string"
          ? Number(item)
          : Number.NaN;
    return Number.isInteger(id) && id > 0 ? [id] : [];
  });
}

function prettyJson(value: string | null) {
  if (!value) return "—";
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}

function englishWordDetails(word: {
  id: number;
  base_form: string;
  phonetic_us: string | null;
  phonetic_us_normalized: string | null;
  json_hint: string | null;
}): RelationPopoverField[] {
  return [
    { label: "id", value: String(word.id), code: true },
    { label: "base_form", value: word.base_form, dir: "ltr" },
    { label: "phonetic_us", value: word.phonetic_us ?? "—", dir: "ltr" },
    {
      label: "phonetic_us_normalized",
      value: word.phonetic_us_normalized ?? "—",
      dir: "ltr",
    },
    {
      label: "json_hint",
      value: prettyJson(word.json_hint),
      code: true,
      multiline: true,
    },
  ];
}

function persianWordDetails(word: {
  id: number;
  canonical_text: string;
  normalized_text: string;
  meaning_fa_IPA: string | null;
  meaning_fa_IPA_normalize: string | null;
}): RelationPopoverField[] {
  return [
    { label: "id", value: String(word.id), code: true },
    { label: "canonical_text", value: word.canonical_text, dir: "rtl" },
    { label: "normalized_text", value: word.normalized_text, dir: "rtl" },
    { label: "meaning_fa_IPA", value: word.meaning_fa_IPA ?? "—", dir: "rtl" },
    {
      label: "meaning_fa_IPA_normalize",
      value: word.meaning_fa_IPA_normalize ?? "—",
      dir: "rtl",
    },
  ];
}

function sentenceDetails(sentence: {
  id: number;
  sentence_en: string;
  sentence_en_meaning_fa: string | null;
}): RelationPopoverField[] {
  return [
    { label: "id", value: String(sentence.id), code: true },
    { label: "sentence_en", value: sentence.sentence_en, dir: "ltr" },
    {
      label: "sentence_en_meaning_fa",
      value: sentence.sentence_en_meaning_fa ?? "—",
      dir: "rtl",
    },
  ];
}

function ValueCell({ value, dir }: { value: unknown; dir?: "rtl" }) {
  const text =
    value === null || value === undefined
      ? "—"
      : value instanceof Date
        ? value.toISOString()
        : typeof value === "object"
          ? JSON.stringify(value)
          : String(value);
  return (
    <td className="max-w-64 px-3 py-2" dir={dir}>
      <span className="block truncate" title={text}>
        {text}
      </span>
    </td>
  );
}

function SortHeader({
  href,
  label,
  active,
  direction,
  indicators,
}: {
  href: string;
  label: string;
  active: boolean;
  direction: "asc" | "desc";
  indicators?: readonly TableColumnIndicator[];
}) {
  return (
    <th className="whitespace-nowrap px-3 py-2">
      <Link
        href={href}
        className="inline-flex items-center gap-1 hover:underline"
      >
        <TableColumnIndicators indicators={indicators} />
        <span>
          {label}{" "}
          <span className={active ? "opacity-100" : "opacity-40"}>
            {active && direction === "asc" ? "↑" : "↓"}
          </span>
        </span>
      </Link>
    </th>
  );
}

export default async function WordsTablePage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    page?: string;
    pageSize?: string;
    sort?: string;
    dir?: string;
    columns?: string | string[];
    review?: string;
    missingConceptAudio?: string;
  }>;
}) {
  const params = await searchParams;
  const q = String(params.q ?? "").trim();
  const page = parsePositiveInt(params.page, 1);
  const showAll = params.pageSize === "all";
  const pageSize = Math.min(
    Math.max(parsePositiveInt(params.pageSize, 100), 10),
    1000,
  );
  const sort = parseSortField(params.sort);
  const dir = params.dir === "asc" ? "asc" : "desc";
  const review: MeaningReviewFilter =
    params.review === "pending" || params.review === "reviewed"
      ? params.review
      : "all";
  const missingConceptAudioOnly = params.missingConceptAudio === "1";
  const columns = parseColumns(params.columns);
  const hasColumn = (column: TableColumnKey) => columns.includes(column);
  const matchingPersianIds = q
    ? (
        await prisma.persianWord.findMany({
          where: {
            OR: [
              { canonical_text: { contains: q } },
              { meaning_fa_IPA: { contains: q } },
              { meaning_fa_IPA_normalize: { contains: q } },
            ],
          },
          select: { id: true },
        })
      ).map((row) => row.id)
    : [];
  const searchWhere: Prisma.WordSenseWhereInput | undefined = q
    ? {
        OR: [
          { english: { is: { base_form: { contains: q } } } },
          { anki_link_id: { contains: q } },
          { meaning: { is: { id: { in: matchingPersianIds } } } },
          ...matchingPersianIds.map((id) => ({
            otherMeaningIds: { array_contains: id },
          })),
        ],
      }
    : undefined;
  const reviewWhere: Prisma.WordSenseWhereInput | undefined =
    review === "pending"
      ? { meaningReviewStatus: MeaningReviewStatus.PENDING }
      : review === "reviewed"
        ? { meaningReviewStatus: MeaningReviewStatus.CONFIRMED }
        : undefined;
  const audioWhere: Prisma.WordSenseWhereInput | undefined = missingConceptAudioOnly
    ? { id: { in: await getPendingWordSenseConceptAudioIds() } }
    : undefined;
  const where: Prisma.WordSenseWhereInput | undefined =
    searchWhere || reviewWhere || audioWhere
      ? {
          AND: [searchWhere, reviewWhere, audioWhere].filter(
            Boolean,
          ) as Prisma.WordSenseWhereInput[],
        }
      : undefined;
  const pendingReviewWhere: Prisma.WordSenseWhereInput = searchWhere
    ? { AND: [searchWhere, { meaningReviewStatus: MeaningReviewStatus.PENDING }] }
    : { meaningReviewStatus: MeaningReviewStatus.PENDING };
  const primaryOrderBy: Record<SortField, Prisma.WordSenseOrderByWithRelationInput> =
    {
      id: { id: dir },
      englishId: { englishId: dir },
      meaningId: { meaningId: dir },
      sentenceIds: { sentenceIds: dir },
      conceptMergeReviewed: { conceptMergeReviewed: dir },
      inflectionMergeReviewed: { inflectionMergeReviewed: dir },
      otherMeaningIds: { otherMeaningIds: dir },
      comparedMeaningWordIds: { comparedMeaningWordIds: dir },
      synonymIds: { synonymIds: dir },
      meaningReviewStatus: { meaningReviewStatus: dir },
      pos: { pos: dir },
      concept_explained_fa: { concept_explained_fa: dir },
      concept_explained_fa_audio_file_name: {
        concept_explained_fa_audio_file_name: dir,
      },
      concept_explained_fa_audio_source_text: {
        concept_explained_fa_audio_source_text: dir,
      },
      learning_depth: { learning_depth: dir },
      other_meanings_en: { other_meanings_en: dir },
      category: { category: dir },
      hint_to_select: { hint_to_select: dir },
      imageability: { imageability: dir },
      productive_target: { productive_target: dir },
      anki_link_id: { anki_link_id: dir },
      createdAt: { createdAt: dir },
      updatedAt: { updatedAt: dir },
    };
  const [
    total,
    pendingReviewCount,
    rawRows,
    emptyCounts,
    meaningReviewSummary,
    conceptMergeRemainingStats,
    inflectionMergeRemainingStats,
    meaningComparisonRemainingStats,
    learningScoreSummary,
    audioRemainingCounts,
    jsonHintRemainingCount,
    jsonHintTotalCount,
    missingMeaningIpaCount,
    pendingMeaningIpaReviewCount,
    phoneticCreateRemainingCount,
  ] = await Promise.all([
    prisma.wordSense.count({ where }),
    prisma.wordSense.count({ where: pendingReviewWhere }),
    prisma.wordSense.findMany({
      where,
      orderBy: [
        primaryOrderBy[sort],
        ...(sort === "id" ? [] : [{ id: "desc" as const }]),
      ],
      skip: showAll ? 0 : (page - 1) * pageSize,
      take: showAll ? undefined : pageSize,
      select: {
        id: true,
        anki_link_id: true,
        englishId: true,
        english: { select: { id: true, ...WORD_SENSE_ENGLISH_FIELDS_SELECT } },
        meaningId: true,
        sentenceIds: true,
        conceptMergeReviewed: true,
        inflectionMergeReviewed: true,
        otherMeaningIds: true,
        comparedMeaningWordIds: true,
        synonymIds: true,
        meaningReviewStatus: true,
        pos: true,
        concept_explained_fa: true,
        concept_explained_fa_audio_file_name: true,
        concept_explained_fa_audio_source_text: true,
        learning_depth: true,
        other_meanings_en: true,
        category: true,
        hint_to_select: true,
        imageability: true,
        productive_target: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    getWordColumnEmptyCounts(),
    getMeaningReviewEligibilitySummary(),
    getPendingWordSenseConceptMergeStats(),
    getPendingWordSenseInflectionMergeStats(),
    getPendingWordSenseMeaningComparisonStats(),
    getCustomExtractionPendingSummary(["imageability", "learning_depth", "productive_target"]),
    getPendingWordAudioTaskCounts(),
    prisma.englishWord.count({
      where: { OR: [{ json_hint: null }, { json_hint: "" }] },
    }),
    prisma.englishWord.count(),
    prisma.persianWord.count({
      where: { OR: [{ meaning_fa_IPA: null }, { meaning_fa_IPA: "" }] },
    }),
    prisma.persianWord.count({
      where: {
        meaning_fa_IPA_confirmed: false,
        AND: [{ meaning_fa_IPA: { not: null } }, { meaning_fa_IPA: { not: "" } }],
      },
    }),
    prisma.englishWord.count({
      where: { OR: [{ phonetic_us: null }, { phonetic_us: "" }] },
    }),
  ]);
  const rows = await hydrateWordsWithPrimarySentence(rawRows);
  const referencedMeaningIds = Array.from(
    new Set(
      rows.flatMap((row) =>
        [row.meaningId, ...meaningIds(row.otherMeaningIds)].filter(
          (id): id is number => id !== null,
        ),
      ),
    ),
  );
  const referencedMeanings = referencedMeaningIds.length
    ? await prisma.persianWord.findMany({
        where: { id: { in: referencedMeaningIds } },
        select: {
          id: true,
          canonical_text: true,
          normalized_text: true,
          meaning_fa_IPA: true,
          meaning_fa_IPA_normalize: true,
        },
      })
    : [];
  const meaningsById = new Map(
    referencedMeanings.map((meaning) => [meaning.id, meaning]),
  );
  const referencedWordIds = Array.from(
    new Set(
      rows.flatMap((row) => [
        ...meaningIds(row.comparedMeaningWordIds),
        ...meaningIds(row.synonymIds),
      ]),
    ),
  );
  const referencedWords = referencedWordIds.length
    ? await prisma.wordSense.findMany({
        where: { id: { in: referencedWordIds } },
        select: {
          id: true,
          pos: true,
          concept_explained_fa: true,
          english: { select: { base_form: true } },
          meaning: { select: { canonical_text: true } },
        },
      })
    : [];
  const referencedWordsById = new Map(
    referencedWords.map((word) => [word.id, word]),
  );
  const wordArrayEntries = (
    value: Prisma.JsonValue | null,
  ): WordArrayRelationEntry[] =>
    meaningIds(value).map((id) => {
      const word = referencedWordsById.get(id);
      return {
        id,
        baseForm: word?.english.base_form ?? null,
        meaning: word?.meaning?.canonical_text ?? null,
        pos: word?.pos ?? null,
        conceptExplainedFa: word?.concept_explained_fa ?? null,
      };
    });
  const totalPages = showAll ? 1 : Math.max(1, Math.ceil(total / pageSize));
  const hrefFor = (
    next: Partial<{ page: number; sort: SortField; dir: "asc" | "desc" }>,
  ) => {
    const query = new URLSearchParams({
      page: String(next.page ?? page),
      pageSize: showAll ? "all" : String(pageSize),
      sort: next.sort ?? sort,
      dir: next.dir ?? dir,
    });
    if (q) query.set("q", q);
    if (review !== "all") query.set("review", review);
    if (missingConceptAudioOnly) query.set("missingConceptAudio", "1");
    columns.forEach((column) => query.append("columns", column));
    return `/words/tables/words?${query.toString()}`;
  };
  const sortHref = (field: SortField) =>
    hrefFor({
      page: 1,
      sort: field,
      dir: field === sort && dir === "asc" ? "desc" : "asc",
    });
  const clearHref = (() => {
    const query = new URLSearchParams({
      page: "1",
      pageSize: showAll ? "all" : String(pageSize),
      sort,
      dir,
    });
    columns.forEach((column) => query.append("columns", column));
    return `/words/tables/words?${query.toString()}`;
  })();

  return (
    <main className="mx-auto w-full max-w-7xl p-4">
      <PageHeader
        title="WordSense Table"
        subtitle={`Browse WordSense records (${total.toLocaleString()} total) and open any row in the detailed editor.`}
      />

      <section className="mt-4 overflow-hidden rounded border">
        <form className="flex flex-wrap items-center gap-2 p-3">
          <input
            name="q"
            defaultValue={q}
            placeholder="Search base_form / meaning_fa / anki_link_id…"
            className="w-full rounded border px-3 py-2 text-sm sm:w-96"
          />
          <label className="flex items-center gap-1 text-sm">
            Rows
            <select
              name="pageSize"
              defaultValue={showAll ? "all" : String(pageSize)}
              className="rounded border px-2 py-2"
            >
              <option value="100">100</option>
              <option value="250">250</option>
              <option value="500">500</option>
              <option value="1000">1000</option>
              <option value="all">All ({total})</option>
            </select>
          </label>
          <label className="flex items-center gap-1 text-sm">
            <input
              name="missingConceptAudio"
              type="checkbox"
              value="1"
              defaultChecked={missingConceptAudioOnly}
            />
            Needs concept audio generation
          </label>
          <label className="flex items-center gap-1 text-sm">
            AI review
            <select
              name="review"
              defaultValue={review}
              className="rounded border px-2 py-2"
            >
              <option value="all">All statuses</option>
              <option value="pending">Needs AI review</option>
              <option value="reviewed">AI reviewed</option>
            </select>
          </label>
          <input type="hidden" name="sort" value={sort} />
          <input type="hidden" name="dir" value={dir} />
          {columns.map((column) => (
            <input key={column} type="hidden" name="columns" value={column} />
          ))}
          <button
            type="submit"
            className="rounded border px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/5"
          >
            Search
          </button>
          {q || review !== "all" || missingConceptAudioOnly ? (
            <Link
              href={clearHref}
              className="rounded border px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/5"
            >
              Reset filters
            </Link>
          ) : null}
        </form>
      </section>

      <section className="mt-4 overflow-hidden rounded border">
        <div className="grid gap-3 p-3 lg:grid-cols-2">
          <div>
            <div className="flex flex-wrap gap-2">
              <WordSenseMeaningsReview
                pendingCount={meaningReviewSummary.totalEligible}
                statusPendingCount={meaningReviewSummary.pendingReview}
                initialSummary={meaningReviewSummary}
              />
              <WordSenseConceptMerge
                remainingGroupCount={conceptMergeRemainingStats.groupCount}
                remainingRecordCount={conceptMergeRemainingStats.recordCount}
              />
              <WordSenseInflectionMerge
                remainingGroupCount={inflectionMergeRemainingStats.groupCount}
                remainingRecordCount={inflectionMergeRemainingStats.recordCount}
              />
              <WordSenseMeaningComparison
                remainingGroupCount={meaningComparisonRemainingStats.groupCount}
                remainingRecordCount={meaningComparisonRemainingStats.recordCount}
              />
              <WordSenseLearningScores
                initialRemainingCount={learningScoreSummary.total}
                initialFieldCounts={{
                  imageability: learningScoreSummary.fieldCounts.imageability ?? 0,
                  learning_depth: learningScoreSummary.fieldCounts.learning_depth ?? 0,
                  productive_target: learningScoreSummary.fieldCounts.productive_target ?? 0,
                }}
              />
              <div className="inline-flex flex-wrap items-start gap-2 rounded-xl border border-card bg-background p-1.5">
                <PersianWordMeaningIpaPhase2
                  initialMissingCount={missingMeaningIpaCount}
                />
                <PersianMeaningIpaReview pendingCount={pendingMeaningIpaReviewCount} />
              </div>
              <EnglishWordPhoneticUsPrompt
                initialRemainingCount={phoneticCreateRemainingCount}
              />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-full bg-amber-500/10 px-3 py-1 font-semibold text-amber-700">
                {pendingReviewCount.toLocaleString()} need AI review
              </span>
              <span className="text-muted">
                An empty otherMeaningIds value is complete only when meaningReviewStatus is CONFIRMED.
              </span>
            </div>
            <div className="mt-3 border-t pt-3">
              <div className="mb-2">
                <div className="text-sm font-semibold">Data maintenance</div>
                <div className="text-xs opacity-70">
                  Preview and clear supported WordSense fields with dependency-aware recovery snapshots.
                </div>
              </div>
              <TableFieldMaintenance
                modelLabel="WordSense"
                apiBase="/api/words/field-maintenance"
                scopeContext={{
                  filter: { q, review, missingConceptAudio: missingConceptAudioOnly },
                  filteredCount: total,
                }}
              />
            </div>
          </div>
          <div className="space-y-3 border-t pt-3 lg:border-l lg:border-t-0 lg:pl-3 lg:pt-0">
            <section className="flex flex-col gap-2">
              <div>
                <div className="text-sm font-semibold">All audio fields</div>
                <div className="text-xs opacity-70">
                  Generates only missing audio for base_form, canonical_text, concept_explained_fa, sentence_en, and sentence_en_meaning_fa.
                </div>
              </div>
              <BatchWordFieldVoiceGenerateAllFields
                remainingCount={audioRemainingCounts.total}
                missingFileCount={audioRemainingCounts.missingFile}
                changedTextCount={audioRemainingCounts.changedText}
              />
            </section>
            <div className="border-t pt-3">
              <BatchEnglishWordJsonHintGenerate
                initialRemainingCount={jsonHintRemainingCount}
                initialTotalCount={jsonHintTotalCount}
              />
            </div>
          </div>
        </div>
      </section>
      <section className="mt-4 rounded border p-3">
        <TableColumnSelector
          key={columns.join(",")}
          columns={TABLE_COLUMNS}
          selectedColumns={columns}
          emptyCounts={emptyCounts}
        />
      </section>

      <div className="mt-4 flex items-center justify-between gap-3 text-sm">
        <span className="opacity-80">
          Total: <strong>{total}</strong> • Page{" "}
          <strong>
            {page}/{totalPages}
          </strong>
        </span>
        <div className="flex gap-2">
          <Link
            href={hrefFor({ page: Math.max(1, page - 1) })}
            aria-disabled={page <= 1}
            className="rounded border px-3 py-2 hover:bg-black/5 aria-disabled:pointer-events-none aria-disabled:opacity-50 dark:hover:bg-white/5"
          >
            Prev
          </Link>
          <Link
            href={hrefFor({ page: Math.min(totalPages, page + 1) })}
            aria-disabled={page >= totalPages}
            className="rounded border px-3 py-2 hover:bg-black/5 aria-disabled:pointer-events-none aria-disabled:opacity-50 dark:hover:bg-white/5"
          >
            Next
          </Link>
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded border">
        <div className="overflow-auto">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-background">
              <tr className="border-b">
                <th className="whitespace-nowrap px-3 py-2"><WordSenseSelectVisibleRows /></th>
                {hasColumn("id") ? (
                  <SortHeader
                    href={sortHref("id")}
                    label="id"
                    active={sort === "id"}
                    direction={dir}
                    indicators={COLUMN_INDICATORS.id}
                  />
                ) : null}
                {hasColumn("englishId") ? (
                  <SortHeader
                    href={sortHref("englishId")}
                    label="englishId"
                    active={sort === "englishId"}
                    direction={dir}
                    indicators={COLUMN_INDICATORS.englishId}
                  />
                ) : null}
                {hasColumn("meaningId") ? (
                  <SortHeader
                    href={sortHref("meaningId")}
                    label="meaningId"
                    active={sort === "meaningId"}
                    direction={dir}
                    indicators={COLUMN_INDICATORS.meaningId}
                  />
                ) : null}
                {hasColumn("sentenceIds") ? (
                  <SortHeader
                    href={sortHref("sentenceIds")}
                    label="sentenceIds"
                    active={sort === "sentenceIds"}
                    direction={dir}
                  />
                ) : null}
                {hasColumn("conceptMergeReviewed") ? (
                  <SortHeader
                    href={sortHref("conceptMergeReviewed")}
                    label="conceptMergeReviewed"
                    active={sort === "conceptMergeReviewed"}
                    direction={dir}
                  />
                ) : null}
                {hasColumn("inflectionMergeReviewed") ? (
                  <SortHeader
                    href={sortHref("inflectionMergeReviewed")}
                    label="inflectionMergeReviewed"
                    active={sort === "inflectionMergeReviewed"}
                    direction={dir}
                  />
                ) : null}
                {hasColumn("otherMeaningIds") ? (
                  <SortHeader
                    href={sortHref("otherMeaningIds")}
                    label="otherMeaningIds"
                    active={sort === "otherMeaningIds"}
                    direction={dir}
                  />
                ) : null}
                {hasColumn("comparedMeaningWordIds") ? (
                  <SortHeader
                    href={sortHref("comparedMeaningWordIds")}
                    label="comparedMeaningWordIds"
                    active={sort === "comparedMeaningWordIds"}
                    direction={dir}
                  />
                ) : null}
                {hasColumn("synonymIds") ? (
                  <SortHeader
                    href={sortHref("synonymIds")}
                    label="synonymIds"
                    active={sort === "synonymIds"}
                    direction={dir}
                  />
                ) : null}
                {hasColumn("meaningReviewStatus") ? (
                  <SortHeader
                    href={sortHref("meaningReviewStatus")}
                    label="AI meaning review"
                    active={sort === "meaningReviewStatus"}
                    direction={dir}
                  />
                ) : null}
                {hasColumn("pos") ? (
                  <SortHeader
                    href={sortHref("pos")}
                    label="pos"
                    active={sort === "pos"}
                    direction={dir}
                  />
                ) : null}
                {hasColumn("concept_explained_fa") ? (
                  <SortHeader
                    href={sortHref("concept_explained_fa")}
                    label="concept_explained_fa"
                    active={sort === "concept_explained_fa"}
                    direction={dir}
                  />
                ) : null}
                {hasColumn("concept_explained_fa_audio_file_name") ? (
                  <SortHeader
                    href={sortHref("concept_explained_fa_audio_file_name")}
                    label="concept audio"
                    active={sort === "concept_explained_fa_audio_file_name"}
                    direction={dir}
                  />
                ) : null}
                {hasColumn("concept_explained_fa_audio_source_text") ? (
                  <SortHeader
                    href={sortHref("concept_explained_fa_audio_source_text")}
                    label="concept audio source text"
                    active={sort === "concept_explained_fa_audio_source_text"}
                    direction={dir}
                  />
                ) : null}
                {hasColumn("learning_depth") ? (
                  <SortHeader
                    href={sortHref("learning_depth")}
                    label="learning_depth"
                    active={sort === "learning_depth"}
                    direction={dir}
                  />
                ) : null}
                {hasColumn("other_meanings_en") ? (
                  <SortHeader
                    href={sortHref("other_meanings_en")}
                    label="other_meanings_en"
                    active={sort === "other_meanings_en"}
                    direction={dir}
                  />
                ) : null}
                {hasColumn("category") ? (
                  <SortHeader
                    href={sortHref("category")}
                    label="category"
                    active={sort === "category"}
                    direction={dir}
                  />
                ) : null}
                {hasColumn("hint_to_select") ? (
                  <SortHeader
                    href={sortHref("hint_to_select")}
                    label="hint_to_select"
                    active={sort === "hint_to_select"}
                    direction={dir}
                  />
                ) : null}
                {hasColumn("imageability") ? (
                  <SortHeader
                    href={sortHref("imageability")}
                    label="imageability"
                    active={sort === "imageability"}
                    direction={dir}
                  />
                ) : null}
                {hasColumn("productive_target") ? (
                  <SortHeader
                    href={sortHref("productive_target")}
                    label="productive_target"
                    active={sort === "productive_target"}
                    direction={dir}
                  />
                ) : null}
                {hasColumn("anki_link_id") ? (
                  <SortHeader
                    href={sortHref("anki_link_id")}
                    label="anki_link_id"
                    active={sort === "anki_link_id"}
                    direction={dir}
                    indicators={COLUMN_INDICATORS.anki_link_id}
                  />
                ) : null}
                {hasColumn("createdAt") ? (
                  <SortHeader
                    href={sortHref("createdAt")}
                    label="createdAt"
                    active={sort === "createdAt"}
                    direction={dir}
                  />
                ) : null}
                {hasColumn("updatedAt") ? (
                  <SortHeader
                    href={sortHref("updatedAt")}
                    label="updatedAt"
                    active={sort === "updatedAt"}
                    direction={dir}
                  />
                ) : null}
                {hasColumn("actions") ? (
                  <th className="px-3 py-2">actions</th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b align-middle">
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      value={row.id}
                      data-word-sense-maintenance-row
                      aria-label={`Select WordSense ${row.id}`}
                    />
                  </td>
                  {hasColumn("id") ? (
                    <td className="whitespace-nowrap px-3 py-2 font-mono">
                      {row.id}
                    </td>
                  ) : null}
                  {hasColumn("englishId") ? (
                    <td className="max-w-64 px-3 py-2 font-mono">
                      <WordSenseRelationPopover
                        label={`EnglishWord ${row.englishId}`}
                        details={englishWordDetails(row.english)}
                      >
                        {row.englishId} — {row.english.base_form}
                      </WordSenseRelationPopover>
                    </td>
                  ) : null}
                  {hasColumn("meaningId") ? (
                    <td className="max-w-52 px-3 py-2 font-mono">
                      {row.meaningId
                        ? (() => {
                            const meaning = meaningsById.get(row.meaningId);
                            return meaning ? (
                              <WordSenseRelationPopover
                                label={`PersianWord ${meaning.id}`}
                                details={persianWordDetails(meaning)}
                              >
                                {meaning.id} — {meaning.canonical_text}
                              </WordSenseRelationPopover>
                            ) : (
                              <span className="block truncate">
                                {row.meaningId} — missing
                              </span>
                            );
                          })()
                        : "—"}
                    </td>
                  ) : null}
                  {hasColumn("sentenceIds") ? (
                    <td className="max-w-72 px-3 py-2 font-mono">
                      {row.sentence ? (
                        <WordSenseRelationPopover
                          label={`Primary Sentence ${row.sentence.id}`}
                          details={sentenceDetails(row.sentence)}
                        >
                          [{meaningIds(row.sentenceIds).join(", ")}] · {row.sentence.sentence_en}
                        </WordSenseRelationPopover>
                      ) : primarySentenceId(row.sentenceIds) ? (
                        <span>[{meaningIds(row.sentenceIds).join(", ")}] · primary missing</span>
                      ) : "—"}
                    </td>
                  ) : null}
                  {hasColumn("conceptMergeReviewed") ? (
                    <td className="px-3 py-2">{row.conceptMergeReviewed ? "true" : "false"}</td>
                  ) : null}
                  {hasColumn("inflectionMergeReviewed") ? (
                    <td className="px-3 py-2">{row.inflectionMergeReviewed ? "true" : "false"}</td>
                  ) : null}
                  {hasColumn("otherMeaningIds") ? (
                    <td className="max-w-64 px-3 py-2 font-mono">
                      {meaningIds(row.otherMeaningIds).length ? (
                        <div className="flex flex-wrap gap-x-2 gap-y-1">
                          {meaningIds(row.otherMeaningIds).map((id) => {
                            const meaning = meaningsById.get(id);
                            return meaning ? (
                              <WordSenseRelationPopover
                                key={id}
                                label={`PersianWord ${meaning.id}`}
                                details={persianWordDetails(meaning)}
                              >
                                {meaning.id} — {meaning.canonical_text}
                              </WordSenseRelationPopover>
                            ) : (
                              <span key={id}>{id} — missing</span>
                            );
                          })}
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>
                  ) : null}
                  {hasColumn("comparedMeaningWordIds") ? (
                    <td className="max-w-64 px-3 py-2 font-mono">
                      {meaningIds(row.comparedMeaningWordIds).length ? (
                        <WordSenseArrayRelationModal
                          label={`comparedMeaningWordIds for WordSense ${row.id}`}
                          entries={wordArrayEntries(row.comparedMeaningWordIds)}
                        >
                          [{meaningIds(row.comparedMeaningWordIds).join(", ")}]
                        </WordSenseArrayRelationModal>
                      ) : (
                        "—"
                      )}
                    </td>
                  ) : null}
                  {hasColumn("synonymIds") ? (
                    <td className="max-w-64 px-3 py-2 font-mono">
                      {meaningIds(row.synonymIds).length ? (
                        <WordSenseArrayRelationModal
                          label={`synonymIds for WordSense ${row.id}`}
                          entries={wordArrayEntries(row.synonymIds)}
                        >
                          [{meaningIds(row.synonymIds).join(", ")}]
                        </WordSenseArrayRelationModal>
                      ) : (
                        "—"
                      )}
                    </td>
                  ) : null}
                  {hasColumn("meaningReviewStatus") ? (
                    <td className="whitespace-nowrap px-3 py-2">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                          row.meaningReviewStatus === MeaningReviewStatus.CONFIRMED
                            ? "bg-emerald-500/10 text-emerald-700"
                            : row.meaningReviewStatus === MeaningReviewStatus.PENDING
                              ? "bg-amber-500/10 text-amber-700"
                              : "bg-red-500/10 text-red-700"
                        }`}
                      >
                        {row.meaningReviewStatus === MeaningReviewStatus.CONFIRMED
                          ? "AI Reviewed"
                          : row.meaningReviewStatus === MeaningReviewStatus.PENDING
                            ? "Pending AI Review"
                            : "Needs Your Action"}
                      </span>
                    </td>
                  ) : null}
                  {hasColumn("pos") ? (
                    <td className="max-w-32 px-3 py-2">
                      <span className="block truncate" title={row.pos ?? ""}>
                        {row.pos ?? "—"}
                      </span>
                    </td>
                  ) : null}
                  {hasColumn("concept_explained_fa") ? (
                    <ValueCell value={row.concept_explained_fa} dir="rtl" />
                  ) : null}
                  {hasColumn("concept_explained_fa_audio_file_name") ? (
                    <td className="px-3 py-2">
                      <WordFieldVoiceCell
                        field="concept_explained_fa"
                        audioKey={String(row.id)}
                        text={row.concept_explained_fa}
                      />
                    </td>
                  ) : null}
                  {hasColumn("concept_explained_fa_audio_source_text") ? (
                    <ValueCell value={row.concept_explained_fa_audio_source_text} dir="rtl" />
                  ) : null}
                  {hasColumn("learning_depth") ? (
                    <ValueCell value={row.learning_depth} />
                  ) : null}
                  {hasColumn("other_meanings_en") ? (
                    <ValueCell value={row.other_meanings_en} />
                  ) : null}
                  {hasColumn("category") ? (
                    <ValueCell value={row.category} />
                  ) : null}
                  {hasColumn("hint_to_select") ? (
                    <ValueCell value={row.hint_to_select} />
                  ) : null}
                  {hasColumn("imageability") ? (
                    <ValueCell value={row.imageability} />
                  ) : null}
                  {hasColumn("productive_target") ? (
                    <ValueCell value={row.productive_target} />
                  ) : null}
                  {hasColumn("anki_link_id") ? (
                    <td className="max-w-52 px-3 py-2 font-mono">
                      <span className="block truncate" title={row.anki_link_id}>
                        {row.anki_link_id}
                      </span>
                    </td>
                  ) : null}
                  {hasColumn("createdAt") ? (
                    <ValueCell value={row.createdAt} />
                  ) : null}
                  {hasColumn("updatedAt") ? (
                    <td className="whitespace-nowrap px-3 py-2 font-mono">
                      {row.updatedAt.toISOString()}
                    </td>
                  ) : null}
                  {hasColumn("actions") ? (
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        <OpenWordSenseEditorModal
                          id={row.id}
                          label={row.english.base_form}
                        />
                        <DeleteWordSenseModalButton
                          id={row.id}
                          label={row.english.base_form}
                        />
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))}
              {!rows.length ? (
                <tr>
                  <td
                    colSpan={columns.length + 1}
                    className="px-3 py-6 text-center text-sm opacity-70"
                  >
                    No rows.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
