import Link from "next/link";
import type { Prisma } from "@prisma/client";

import { PageHeader } from "@/components/page-header";
import { TableColumnIndicators, type TableColumnIndicator } from "@/components/table-column-indicators";
import { TableColumnSelector } from "@/components/table-column-selector";
import { prisma } from "@/lib/prisma";

import OpenWordEditorModal from "../../editor/OpenWordEditorModal.client";

export const metadata = { title: "Words — Word Table" };
export const runtime = "nodejs";

function parsePositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

const SORT_FIELDS = ["id", "base_form", "meaningId", "otherMeaningIds", "pos", "typeOfWordInDb", "anki_link_id", "updatedAt"] as const;
type SortField = (typeof SORT_FIELDS)[number];

const TABLE_COLUMNS = [
  { key: "id", label: "id", required: true },
  { key: "base_form", label: "base_form" },
  { key: "phonetic_us", label: "phonetic_us" },
  { key: "phonetic_us_normalized", label: "phonetic_us_normalized" },
  { key: "meaningId", label: "meaningId" },
  { key: "otherMeaningIds", label: "otherMeaningIds" },
  { key: "pos", label: "pos" },
  { key: "concept_explained", label: "concept_explained" },
  { key: "concept_explained_fa", label: "concept_explained_fa" },
  { key: "word_hint_story", label: "word_hint_story" },
  { key: "explanation_for_sentence_meaning", label: "explanation_for_sentence_meaning" },
  { key: "learning_depth", label: "learning_depth" },
  { key: "mixed_sentence", label: "mixed_sentence" },
  { key: "other_meanings_en", label: "other_meanings_en" },
  { key: "category", label: "category" },
  { key: "typeOfWordInDb", label: "type" },
  { key: "hint_sentence", label: "hint_sentence" },
  { key: "first_letter_en_hint", label: "first_letter_en_hint" },
  { key: "first_letter_fa_hint", label: "first_letter_fa_hint" },
  { key: "hint_to_select", label: "hint_to_select" },
  { key: "json_hint", label: "json_hint" },
  { key: "word_note", label: "word_note" },
  { key: "common_error", label: "common_error" },
  { key: "imageability", label: "imageability" },
  { key: "productive_target", label: "productive_target" },
  { key: "anki_link_id", label: "anki_link_id" },
  { key: "createdAt", label: "createdAt" },
  { key: "updatedAt", label: "updatedAt" },
  { key: "actions", label: "actions" },
] as const;

type TableColumnKey = (typeof TABLE_COLUMNS)[number]["key"];
const DEFAULT_TABLE_COLUMNS: TableColumnKey[] = ["id", "base_form", "meaningId", "otherMeaningIds", "pos", "typeOfWordInDb", "anki_link_id", "updatedAt", "actions"];

const COLUMN_INDICATORS: Partial<Record<TableColumnKey, readonly TableColumnIndicator[]>> = {
  id: [
    { kind: "primary-key", text: "Primary key: Word.id" },
    { kind: "unique", text: "Unique: Word.id (enforced by the primary key)" },
  ],
  base_form: [{ kind: "index", text: "Index: Word_base_form_idx" }],
  meaningId: [
    { kind: "foreign-key", text: "Foreign key: Word.meaningId → PersianWord.id" },
    { kind: "index", text: "Index: Word_meaningId_idx" },
  ],
  typeOfWordInDb: [{ kind: "index", text: "Index: Word_typeOfWordInDb_idx" }],
  anki_link_id: [{ kind: "unique", text: "Unique index: Word_anki_link_id_key" }],
};

function parseColumns(value: string | string[] | undefined): TableColumnKey[] {
  const requested = Array.isArray(value) ? value : value ? [value] : [];
  return requested.length
    ? TABLE_COLUMNS.map((column) => column.key).filter((key) => key === "id" || requested.includes(key))
    : DEFAULT_TABLE_COLUMNS;
}

function parseSortField(value: string | undefined): SortField {
  return SORT_FIELDS.includes(value as SortField) ? (value as SortField) : "updatedAt";
}

function meaningIds(value: Prisma.JsonValue | null) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const id = typeof item === "number" ? item : typeof item === "string" ? Number(item) : Number.NaN;
    return Number.isInteger(id) && id > 0 ? [id] : [];
  });
}

function persianWordLabel(word: { id: number; canonical_text: string; normalized_text: string; meaning_fa_IPA: string | null; meaning_fa_IPA_normalize: string | null }) {
  return [
    `id: ${word.id}`,
    `canonical_text: ${word.canonical_text}`,
    `normalized_text: ${word.normalized_text}`,
    `meaning_fa_IPA: ${word.meaning_fa_IPA ?? "—"}`,
    `meaning_fa_IPA_normalize: ${word.meaning_fa_IPA_normalize ?? "—"}`,
  ].join("\n");
}

function ValueCell({ value, dir }: { value: unknown; dir?: "rtl" }) {
  const text = value === null || value === undefined ? "—" : value instanceof Date ? value.toISOString() : typeof value === "object" ? JSON.stringify(value) : String(value);
  return <td className="max-w-64 px-3 py-2" dir={dir}><span className="block truncate" title={text}>{text}</span></td>;
}

function SortHeader({ href, label, active, direction, indicators }: { href: string; label: string; active: boolean; direction: "asc" | "desc"; indicators?: readonly TableColumnIndicator[] }) {
  return (
    <th className="whitespace-nowrap px-3 py-2">
      <Link href={href} className="inline-flex items-center gap-1 hover:underline">
        <TableColumnIndicators indicators={indicators} />
        <span>{label} <span className={active ? "opacity-100" : "opacity-40"}>{active && direction === "asc" ? "↑" : "↓"}</span></span>
      </Link>
    </th>
  );
}

export default async function WordsTablePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; pageSize?: string; sort?: string; dir?: string; columns?: string | string[] }>;
}) {
  const params = await searchParams;
  const q = String(params.q ?? "").trim();
  const page = parsePositiveInt(params.page, 1);
  const showAll = params.pageSize === "all";
  const pageSize = Math.min(Math.max(parsePositiveInt(params.pageSize, 100), 10), 1000);
  const sort = parseSortField(params.sort);
  const dir = params.dir === "asc" ? "asc" : "desc";
  const columns = parseColumns(params.columns);
  const hasColumn = (column: TableColumnKey) => columns.includes(column);
  const matchingPersianIds = q
    ? (await prisma.persianWord.findMany({ where: { OR: [{ canonical_text: { contains: q } }, { meaning_fa_IPA: { contains: q } }, { meaning_fa_IPA_normalize: { contains: q } }] }, select: { id: true } })).map((row) => row.id)
    : [];
  const where: Prisma.WordWhereInput | undefined = q
    ? { OR: [
      { base_form: { contains: q } },
      { anki_link_id: { contains: q } },
      { meaning: { is: { id: { in: matchingPersianIds } } } },
      ...matchingPersianIds.map((id) => ({ otherMeaningIds: { array_contains: id } })),
    ] }
    : undefined;
  const primaryOrderBy: Record<SortField, Prisma.WordOrderByWithRelationInput> = {
    id: { id: dir },
    base_form: { base_form: dir },
    meaningId: { meaningId: dir },
    otherMeaningIds: { otherMeaningIds: dir },
    pos: { pos: dir },
    typeOfWordInDb: { typeOfWordInDb: dir },
    anki_link_id: { anki_link_id: dir },
    updatedAt: { updatedAt: dir },
  };
  const [total, rows] = await Promise.all([
    prisma.word.count({ where }),
    prisma.word.findMany({
      where,
      orderBy: [primaryOrderBy[sort], ...(sort === "id" ? [] : [{ id: "desc" as const }])],
      skip: showAll ? 0 : (page - 1) * pageSize,
      take: showAll ? undefined : pageSize,
      select: {
        id: true, anki_link_id: true, base_form: true, phonetic_us: true, phonetic_us_normalized: true,
        meaningId: true, otherMeaningIds: true, pos: true, concept_explained: true, concept_explained_fa: true,
        word_hint_story: true, explanation_for_sentence_meaning: true, learning_depth: true, mixed_sentence: true,
        other_meanings_en: true, category: true, typeOfWordInDb: true, hint_sentence: true, first_letter_en_hint: true,
        first_letter_fa_hint: true, hint_to_select: true, json_hint: true, word_note: true, common_error: true,
        imageability: true, productive_target: true, createdAt: true, updatedAt: true,
      },
    }),
  ]);
  const referencedMeaningIds = Array.from(new Set(rows.flatMap((row) => [row.meaningId, ...meaningIds(row.otherMeaningIds)].filter((id): id is number => id !== null))));
  const referencedMeanings = referencedMeaningIds.length
    ? await prisma.persianWord.findMany({
        where: { id: { in: referencedMeaningIds } },
        select: { id: true, canonical_text: true, normalized_text: true, meaning_fa_IPA: true, meaning_fa_IPA_normalize: true },
      })
    : [];
  const meaningsById = new Map(referencedMeanings.map((meaning) => [meaning.id, meaning]));
  const totalPages = showAll ? 1 : Math.max(1, Math.ceil(total / pageSize));
  const hrefFor = (next: Partial<{ page: number; sort: SortField; dir: "asc" | "desc" }>) => {
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
  const sortHref = (field: SortField) => hrefFor({ page: 1, sort: field, dir: field === sort && dir === "asc" ? "desc" : "asc" });
  const clearHref = (() => {
    const query = new URLSearchParams({ page: "1", pageSize: showAll ? "all" : String(pageSize), sort, dir });
    columns.forEach((column) => query.append("columns", column));
    return `/words/tables/words?${query.toString()}`;
  })();

  return (
    <main className="mx-auto w-full max-w-7xl p-4">
      <PageHeader title="Word Table" subtitle="Browse Word records and open any row in the detailed editor." />

      <section className="mt-4 overflow-hidden rounded border">
        <form className="flex flex-wrap items-center gap-2 p-3">
          <input name="q" defaultValue={q} placeholder="Search base_form / meaning_fa / anki_link_id…" className="w-full rounded border px-3 py-2 text-sm sm:w-96" />
          <label className="flex items-center gap-1 text-sm">
            Rows
            <select name="pageSize" defaultValue={showAll ? "all" : String(pageSize)} className="rounded border px-2 py-2">
              <option value="100">100</option><option value="250">250</option><option value="500">500</option><option value="1000">1000</option><option value="all">All ({total})</option>
            </select>
          </label>
          <input type="hidden" name="sort" value={sort} />
          <input type="hidden" name="dir" value={dir} />
          {columns.map((column) => <input key={column} type="hidden" name="columns" value={column} />)}
          <button type="submit" className="rounded border px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/5">Search</button>
          {q ? <Link href={clearHref} className="rounded border px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/5">Clear</Link> : null}
        </form>
      </section>

      <section className="mt-4 rounded border p-3">
        <TableColumnSelector key={columns.join(",")} columns={TABLE_COLUMNS} selectedColumns={columns} />
      </section>

      <div className="mt-4 flex items-center justify-between gap-3 text-sm">
        <span className="opacity-80">Total: <strong>{total}</strong> • Page <strong>{page}/{totalPages}</strong></span>
        <div className="flex gap-2">
          <Link href={hrefFor({ page: Math.max(1, page - 1) })} aria-disabled={page <= 1} className="rounded border px-3 py-2 hover:bg-black/5 aria-disabled:pointer-events-none aria-disabled:opacity-50 dark:hover:bg-white/5">Prev</Link>
          <Link href={hrefFor({ page: Math.min(totalPages, page + 1) })} aria-disabled={page >= totalPages} className="rounded border px-3 py-2 hover:bg-black/5 aria-disabled:pointer-events-none aria-disabled:opacity-50 dark:hover:bg-white/5">Next</Link>
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded border"><div className="overflow-auto"><table className="w-full text-left text-xs">
        <thead className="sticky top-0 bg-background"><tr className="border-b">
          {hasColumn("id") ? <SortHeader href={sortHref("id")} label="id" active={sort === "id"} direction={dir} indicators={COLUMN_INDICATORS.id} /> : null}
          {hasColumn("base_form") ? <SortHeader href={sortHref("base_form")} label="base_form" active={sort === "base_form"} direction={dir} indicators={COLUMN_INDICATORS.base_form} /> : null}
          {hasColumn("phonetic_us") ? <th className="px-3 py-2">phonetic_us</th> : null}
          {hasColumn("phonetic_us_normalized") ? <th className="px-3 py-2">phonetic_us_normalized</th> : null}
          {hasColumn("meaningId") ? <SortHeader href={sortHref("meaningId")} label="meaningId" active={sort === "meaningId"} direction={dir} indicators={COLUMN_INDICATORS.meaningId} /> : null}
          {hasColumn("otherMeaningIds") ? <SortHeader href={sortHref("otherMeaningIds")} label="otherMeaningIds" active={sort === "otherMeaningIds"} direction={dir} /> : null}
          {hasColumn("pos") ? <SortHeader href={sortHref("pos")} label="pos" active={sort === "pos"} direction={dir} /> : null}
          {hasColumn("concept_explained") ? <th className="px-3 py-2">concept_explained</th> : null}
          {hasColumn("concept_explained_fa") ? <th className="px-3 py-2">concept_explained_fa</th> : null}
          {hasColumn("word_hint_story") ? <th className="px-3 py-2">word_hint_story</th> : null}
          {hasColumn("explanation_for_sentence_meaning") ? <th className="px-3 py-2">explanation_for_sentence_meaning</th> : null}
          {hasColumn("learning_depth") ? <th className="px-3 py-2">learning_depth</th> : null}
          {hasColumn("mixed_sentence") ? <th className="px-3 py-2">mixed_sentence</th> : null}
          {hasColumn("other_meanings_en") ? <th className="px-3 py-2">other_meanings_en</th> : null}
          {hasColumn("category") ? <th className="px-3 py-2">category</th> : null}
          {hasColumn("typeOfWordInDb") ? <SortHeader href={sortHref("typeOfWordInDb")} label="type" active={sort === "typeOfWordInDb"} direction={dir} indicators={COLUMN_INDICATORS.typeOfWordInDb} /> : null}
          {hasColumn("hint_sentence") ? <th className="px-3 py-2">hint_sentence</th> : null}
          {hasColumn("first_letter_en_hint") ? <th className="px-3 py-2">first_letter_en_hint</th> : null}
          {hasColumn("first_letter_fa_hint") ? <th className="px-3 py-2">first_letter_fa_hint</th> : null}
          {hasColumn("hint_to_select") ? <th className="px-3 py-2">hint_to_select</th> : null}
          {hasColumn("json_hint") ? <th className="px-3 py-2">json_hint</th> : null}
          {hasColumn("word_note") ? <th className="px-3 py-2">word_note</th> : null}
          {hasColumn("common_error") ? <th className="px-3 py-2">common_error</th> : null}
          {hasColumn("imageability") ? <th className="px-3 py-2">imageability</th> : null}
          {hasColumn("productive_target") ? <th className="px-3 py-2">productive_target</th> : null}
          {hasColumn("anki_link_id") ? <SortHeader href={sortHref("anki_link_id")} label="anki_link_id" active={sort === "anki_link_id"} direction={dir} indicators={COLUMN_INDICATORS.anki_link_id} /> : null}
          {hasColumn("createdAt") ? <th className="px-3 py-2">createdAt</th> : null}
          {hasColumn("updatedAt") ? <SortHeader href={sortHref("updatedAt")} label="updatedAt" active={sort === "updatedAt"} direction={dir} /> : null}
          {hasColumn("actions") ? <th className="px-3 py-2">actions</th> : null}
        </tr></thead>
        <tbody>
          {rows.map((row) => <tr key={row.id} className="border-b align-middle">
            {hasColumn("id") ? <td className="whitespace-nowrap px-3 py-2 font-mono">{row.id}</td> : null}
            {hasColumn("base_form") ? <td className="max-w-52 px-3 py-2"><span className="block truncate" title={row.base_form}>{row.base_form}</span></td> : null}
            {hasColumn("phonetic_us") ? <ValueCell value={row.phonetic_us} /> : null}
            {hasColumn("phonetic_us_normalized") ? <ValueCell value={row.phonetic_us_normalized} /> : null}
            {hasColumn("meaningId") ? <td className="max-w-52 px-3 py-2 font-mono">{row.meaningId ? <span className="block truncate underline decoration-dotted underline-offset-4" title={meaningsById.get(row.meaningId) ? persianWordLabel(meaningsById.get(row.meaningId)!) : "Referenced PersianWord was not found."}>{row.meaningId} — {meaningsById.get(row.meaningId)?.canonical_text ?? "missing"}</span> : "—"}</td> : null}
            {hasColumn("otherMeaningIds") ? <td className="max-w-64 px-3 py-2 font-mono">{meaningIds(row.otherMeaningIds).length ? <span className="block truncate underline decoration-dotted underline-offset-4" title={meaningIds(row.otherMeaningIds).map((id) => { const meaning = meaningsById.get(id); return meaning ? persianWordLabel(meaning) : `id: ${id}\nReferenced PersianWord was not found.`; }).join("\n\n")}>{meaningIds(row.otherMeaningIds).map((id) => `${id} — ${meaningsById.get(id)?.canonical_text ?? "missing"}`).join("; ")}</span> : "—"}</td> : null}
            {hasColumn("pos") ? <td className="max-w-32 px-3 py-2"><span className="block truncate" title={row.pos ?? ""}>{row.pos ?? "—"}</span></td> : null}
            {hasColumn("concept_explained") ? <ValueCell value={row.concept_explained} /> : null}
            {hasColumn("concept_explained_fa") ? <ValueCell value={row.concept_explained_fa} dir="rtl" /> : null}
            {hasColumn("word_hint_story") ? <ValueCell value={row.word_hint_story} /> : null}
            {hasColumn("explanation_for_sentence_meaning") ? <ValueCell value={row.explanation_for_sentence_meaning} /> : null}
            {hasColumn("learning_depth") ? <ValueCell value={row.learning_depth} /> : null}
            {hasColumn("mixed_sentence") ? <ValueCell value={row.mixed_sentence} /> : null}
            {hasColumn("other_meanings_en") ? <ValueCell value={row.other_meanings_en} /> : null}
            {hasColumn("category") ? <ValueCell value={row.category} /> : null}
            {hasColumn("typeOfWordInDb") ? <td className="px-3 py-2">{row.typeOfWordInDb}</td> : null}
            {hasColumn("hint_sentence") ? <ValueCell value={row.hint_sentence} /> : null}
            {hasColumn("first_letter_en_hint") ? <ValueCell value={row.first_letter_en_hint} /> : null}
            {hasColumn("first_letter_fa_hint") ? <ValueCell value={row.first_letter_fa_hint} dir="rtl" /> : null}
            {hasColumn("hint_to_select") ? <ValueCell value={row.hint_to_select} /> : null}
            {hasColumn("json_hint") ? <ValueCell value={row.json_hint} /> : null}
            {hasColumn("word_note") ? <ValueCell value={row.word_note} /> : null}
            {hasColumn("common_error") ? <ValueCell value={row.common_error} /> : null}
            {hasColumn("imageability") ? <ValueCell value={row.imageability} /> : null}
            {hasColumn("productive_target") ? <ValueCell value={row.productive_target} /> : null}
            {hasColumn("anki_link_id") ? <td className="max-w-52 px-3 py-2 font-mono"><span className="block truncate" title={row.anki_link_id}>{row.anki_link_id}</span></td> : null}
            {hasColumn("createdAt") ? <ValueCell value={row.createdAt} /> : null}
            {hasColumn("updatedAt") ? <td className="whitespace-nowrap px-3 py-2 font-mono">{row.updatedAt.toISOString()}</td> : null}
            {hasColumn("actions") ? <td className="px-3 py-2"><OpenWordEditorModal id={row.id} label={row.base_form} /></td> : null}
          </tr>)}
          {!rows.length ? <tr><td colSpan={columns.length} className="px-3 py-6 text-center text-sm opacity-70">No rows.</td></tr> : null}
        </tbody>
      </table></div></div>
    </main>
  );
}
