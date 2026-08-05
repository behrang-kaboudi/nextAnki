import Link from "next/link";
import type { Prisma } from "@prisma/client";

import { PageHeader } from "@/components/page-header";
import {
  TableColumnIndicators,
  type TableColumnIndicator,
} from "@/components/table-column-indicators";
import { TableColumnSelector } from "@/components/table-column-selector";
import { prisma } from "@/lib/prisma";
import { WORD_ENGLISH_FIELDS_SELECT } from "@/lib/english/wordEnglishFields.server";

import OpenWordEditorModal from "../../editor/OpenWordEditorModal.client";
import BackfillWordSentenceIds from "./BackfillWordSentenceIds.client";
import WordRelationPopover, {
  type RelationPopoverField,
} from "./WordRelationPopover.client";

export const metadata = { title: "Words — Word Table" };
export const runtime = "nodejs";

function parsePositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

const SORT_FIELDS = [
  "id",
  "englishId",
  "meaningId",
  "sentenceId",
  "otherMeaningIds",
  "pos",
  "anki_link_id",
  "updatedAt",
] as const;
type SortField = (typeof SORT_FIELDS)[number];

const TABLE_COLUMNS = [
  { key: "id", label: "id", required: true },
  { key: "englishId", label: "englishId" },
  { key: "meaningId", label: "meaningId" },
  { key: "sentenceId", label: "sentenceId" },
  { key: "otherMeaningIds", label: "otherMeaningIds" },
  { key: "pos", label: "pos" },
  { key: "concept_explained_fa", label: "concept_explained_fa" },
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
const DEFAULT_TABLE_COLUMNS: TableColumnKey[] = [
  "id",
  "englishId",
  "meaningId",
  "sentenceId",
  "otherMeaningIds",
  "pos",
  "anki_link_id",
  "updatedAt",
  "actions",
];

const COLUMN_INDICATORS: Partial<
  Record<TableColumnKey, readonly TableColumnIndicator[]>
> = {
  id: [
    { kind: "primary-key", text: "Primary key: Word.id" },
    { kind: "unique", text: "Unique: Word.id (enforced by the primary key)" },
  ],
  englishId: [
    {
      kind: "foreign-key",
      text: "Foreign key: Word.englishId → EnglishWord.id",
    },
    { kind: "index", text: "Index: Word_englishId_idx" },
  ],
  meaningId: [
    {
      kind: "foreign-key",
      text: "Foreign key: Word.meaningId → PersianWord.id",
    },
    { kind: "index", text: "Index: Word_meaningId_idx" },
  ],
  sentenceId: [
    {
      kind: "foreign-key",
      text: "Foreign key: Word.sentenceId → Sentence.id",
    },
    { kind: "index", text: "Index: Word_sentenceId_idx" },
  ],
  anki_link_id: [
    { kind: "unique", text: "Unique index: Word_anki_link_id_key" },
  ],
};

function parseColumns(value: string | string[] | undefined): TableColumnKey[] {
  const requested = Array.isArray(value) ? value : value ? [value] : [];
  return requested.length
    ? TABLE_COLUMNS.map((column) => column.key).filter(
        (key) => key === "id" || requested.includes(key),
      )
    : DEFAULT_TABLE_COLUMNS;
}

function parseSortField(value: string | undefined): SortField {
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
  mentionedWordsJson: Prisma.JsonValue | null;
  items: Prisma.JsonValue | null;
}): RelationPopoverField[] {
  return [
    { label: "id", value: String(sentence.id), code: true },
    { label: "sentence_en", value: sentence.sentence_en, dir: "ltr" },
    {
      label: "sentence_en_meaning_fa",
      value: sentence.sentence_en_meaning_fa ?? "—",
      dir: "rtl",
    },
    {
      label: "mentionedWordsJson",
      value: sentence.mentionedWordsJson
        ? JSON.stringify(sentence.mentionedWordsJson, null, 2)
        : "—",
      code: true,
      multiline: true,
    },
    {
      label: "items",
      value: sentence.items ? JSON.stringify(sentence.items, null, 2) : "—",
      code: true,
      multiline: true,
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
  const where: Prisma.WordWhereInput | undefined = q
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
  const primaryOrderBy: Record<SortField, Prisma.WordOrderByWithRelationInput> =
    {
      id: { id: dir },
      englishId: { englishId: dir },
      meaningId: { meaningId: dir },
      sentenceId: { sentenceId: dir },
      otherMeaningIds: { otherMeaningIds: dir },
      pos: { pos: dir },
      anki_link_id: { anki_link_id: dir },
      updatedAt: { updatedAt: dir },
    };
  const [total, rawRows] = await Promise.all([
    prisma.word.count({ where }),
    prisma.word.findMany({
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
        english: { select: { id: true, ...WORD_ENGLISH_FIELDS_SELECT } },
        meaningId: true,
        sentenceId: true,
        sentence: {
          select: {
            id: true,
            sentence_en: true,
            sentence_en_meaning_fa: true,
            mentionedWordsJson: true,
            items: true,
          },
        },
        otherMeaningIds: true,
        pos: true,
        concept_explained_fa: true,
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
  ]);
  const rows = rawRows;
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
        title="Word Table"
        subtitle="Browse Word records and open any row in the detailed editor."
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
          {q ? (
            <Link
              href={clearHref}
              className="rounded border px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/5"
            >
              Clear
            </Link>
          ) : null}
        </form>
      </section>

      <section className="mt-4 rounded border p-3">
        <BackfillWordSentenceIds />
      </section>

      <section className="mt-4 rounded border p-3">
        <TableColumnSelector
          key={columns.join(",")}
          columns={TABLE_COLUMNS}
          selectedColumns={columns}
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
                {hasColumn("sentenceId") ? (
                  <SortHeader
                    href={sortHref("sentenceId")}
                    label="sentenceId"
                    active={sort === "sentenceId"}
                    direction={dir}
                    indicators={COLUMN_INDICATORS.sentenceId}
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
                {hasColumn("pos") ? (
                  <SortHeader
                    href={sortHref("pos")}
                    label="pos"
                    active={sort === "pos"}
                    direction={dir}
                  />
                ) : null}
                {hasColumn("concept_explained_fa") ? (
                  <th className="px-3 py-2">concept_explained_fa</th>
                ) : null}
                {hasColumn("learning_depth") ? (
                  <th className="px-3 py-2">learning_depth</th>
                ) : null}
                {hasColumn("other_meanings_en") ? (
                  <th className="px-3 py-2">other_meanings_en</th>
                ) : null}
                {hasColumn("category") ? (
                  <th className="px-3 py-2">category</th>
                ) : null}
                {hasColumn("hint_to_select") ? (
                  <th className="px-3 py-2">hint_to_select</th>
                ) : null}
                {hasColumn("imageability") ? (
                  <th className="px-3 py-2">imageability</th>
                ) : null}
                {hasColumn("productive_target") ? (
                  <th className="px-3 py-2">productive_target</th>
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
                  <th className="px-3 py-2">createdAt</th>
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
                  {hasColumn("id") ? (
                    <td className="whitespace-nowrap px-3 py-2 font-mono">
                      {row.id}
                    </td>
                  ) : null}
                  {hasColumn("englishId") ? (
                    <td className="max-w-64 px-3 py-2 font-mono">
                      <WordRelationPopover
                        label={`EnglishWord ${row.englishId}`}
                        details={englishWordDetails(row.english)}
                      >
                        {row.englishId} — {row.english.base_form}
                      </WordRelationPopover>
                    </td>
                  ) : null}
                  {hasColumn("meaningId") ? (
                    <td className="max-w-52 px-3 py-2 font-mono">
                      {row.meaningId
                        ? (() => {
                            const meaning = meaningsById.get(row.meaningId);
                            return meaning ? (
                              <WordRelationPopover
                                label={`PersianWord ${meaning.id}`}
                                details={persianWordDetails(meaning)}
                              >
                                {meaning.id} — {meaning.canonical_text}
                              </WordRelationPopover>
                            ) : (
                              <span className="block truncate">
                                {row.meaningId} — missing
                              </span>
                            );
                          })()
                        : "—"}
                    </td>
                  ) : null}
                  {hasColumn("sentenceId") ? (
                    <td className="max-w-64 px-3 py-2 font-mono">
                      {row.sentenceId ? (
                        row.sentence ? (
                          <WordRelationPopover
                            label={`Sentence ${row.sentence.id}`}
                            details={sentenceDetails(row.sentence)}
                          >
                            {row.sentence.id} — {row.sentence.sentence_en}
                          </WordRelationPopover>
                        ) : (
                          <span className="block truncate">
                            {row.sentenceId} — missing
                          </span>
                        )
                      ) : (
                        "—"
                      )}
                    </td>
                  ) : null}
                  {hasColumn("otherMeaningIds") ? (
                    <td className="max-w-64 px-3 py-2 font-mono">
                      {meaningIds(row.otherMeaningIds).length ? (
                        <div className="flex flex-wrap gap-x-2 gap-y-1">
                          {meaningIds(row.otherMeaningIds).map((id) => {
                            const meaning = meaningsById.get(id);
                            return meaning ? (
                              <WordRelationPopover
                                key={id}
                                label={`PersianWord ${meaning.id}`}
                                details={persianWordDetails(meaning)}
                              >
                                {meaning.id} — {meaning.canonical_text}
                              </WordRelationPopover>
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
                      <OpenWordEditorModal
                        id={row.id}
                        label={row.english.base_form}
                      />
                    </td>
                  ) : null}
                </tr>
              ))}
              {!rows.length ? (
                <tr>
                  <td
                    colSpan={columns.length}
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
