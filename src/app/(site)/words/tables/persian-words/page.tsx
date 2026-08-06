import Link from "next/link";
import type { Prisma } from "@prisma/client";

import { PageHeader } from "@/components/page-header";
import { TableColumnIndicators, type TableColumnIndicator } from "@/components/table-column-indicators";
import { TableColumnSelector } from "@/components/table-column-selector";
import { prisma } from "@/lib/prisma";

import OpenPersianWordEditorModal from "./OpenPersianWordEditorModal.client";
import BatchPersianWordAudioGenerate from "./BatchPersianWordAudioGenerate.client";
import PersianWordAudioControls from "./PersianWordAudioControls.client";
import PersianWordMeaningIpaPhase2 from "./PersianWordMeaningIpaPhase2.client";
import AddPersianWordModal from "./AddPersianWordModal.client";
import DeletePersianWordButton from "./DeletePersianWordButton.client";

export const metadata = { title: "Words — PersianWord Table" };
export const runtime = "nodejs";

function parsePositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

const SORT_FIELDS = ["id", "canonical_text", "normalized_text", "meaning_fa_IPA", "meaning_fa_IPA_normalize", "audio_file_name", "createdAt", "updatedAt"] as const;
type SortField = (typeof SORT_FIELDS)[number];

const TABLE_COLUMNS = [
  { key: "id", label: "id", required: true },
  { key: "canonical_text", label: "canonical_text" },
  { key: "normalized_text", label: "normalized_text" },
  { key: "not_normalized_texts", label: "not_normalized_texts" },
  { key: "meaning_fa_IPA", label: "meaning_fa_IPA" },
  { key: "meaning_fa_IPA_normalize", label: "meaning_fa_IPA_normalize" },
  { key: "audio_file_name", label: "audio_file_name" },
  { key: "createdAt", label: "createdAt" },
  { key: "updatedAt", label: "updatedAt" },
  { key: "actions", label: "actions" },
] as const;

type TableColumnKey = (typeof TABLE_COLUMNS)[number]["key"];
const DEFAULT_TABLE_COLUMNS: TableColumnKey[] = ["id", "canonical_text", "normalized_text", "meaning_fa_IPA", "audio_file_name", "updatedAt", "actions"];

const COLUMN_INDICATORS: Partial<Record<TableColumnKey, readonly TableColumnIndicator[]>> = {
  id: [
    { kind: "primary-key", text: "Primary key: PersianWord.id" },
    { kind: "unique", text: "Unique: PersianWord.id (enforced by the primary key)" },
  ],
  canonical_text: [{ kind: "index", text: "Index: PersianWord_canonical_text_idx" }],
  normalized_text: [{ kind: "index", text: "Index: PersianWord_normalized_text_idx" }],
  not_normalized_texts: [{ kind: "unique", text: "Unique items: duplicate values are not allowed within this row's not_normalized_texts array" }],
  meaning_fa_IPA: [{ kind: "unique", text: "Unique index: persian_word_meaning_fa_IPA_unique (non-empty IPA values only)" }],
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

function parseSortDirection(value: string | undefined) {
  return value === "asc" ? "asc" : "desc";
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

export default async function PersianWordsTablePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; pageSize?: string; sort?: string; dir?: string; missingAudio?: string; columns?: string | string[] }>;
}) {
  const params = await searchParams;
  const q = String(params.q ?? "").trim();
  const page = parsePositiveInt(params.page, 1);
  const showAll = params.pageSize === "all";
  const pageSize = Math.min(Math.max(parsePositiveInt(params.pageSize, 100), 10), 1000);
  const sort = parseSortField(params.sort);
  const dir = parseSortDirection(params.dir);
  const missingAudioOnly = params.missingAudio === "1";
  const columns = parseColumns(params.columns);
  const hasColumn = (column: TableColumnKey) => columns.includes(column);
  const primaryOrderBy: Record<SortField, Prisma.PersianWordOrderByWithRelationInput> = {
    id: { id: dir },
    canonical_text: { canonical_text: dir },
    normalized_text: { normalized_text: dir },
    meaning_fa_IPA: { meaning_fa_IPA: dir },
    meaning_fa_IPA_normalize: { meaning_fa_IPA_normalize: dir },
    audio_file_name: { audio_file_name: dir },
    createdAt: { createdAt: dir },
    updatedAt: { updatedAt: dir },
  };
  const filters: Prisma.PersianWordWhereInput[] = [];
  if (q) filters.push({ OR: [{ canonical_text: { contains: q } }, { normalized_text: { contains: q } }, { meaning_fa_IPA: { contains: q } }, { meaning_fa_IPA_normalize: { contains: q } }] });
  if (missingAudioOnly) filters.push({ OR: [{ audio_file_name: null }, { audio_file_name: "" }] });
  const where = filters.length ? { AND: filters } : undefined;
  const [total, rows] = await Promise.all([
    prisma.persianWord.count({ where }),
    prisma.persianWord.findMany({
      where,
      orderBy: [primaryOrderBy[sort], ...(sort === "id" ? [] : [{ id: "desc" as const }])],
      skip: showAll ? 0 : (page - 1) * pageSize,
      take: showAll ? undefined : pageSize,
      select: {
        id: true,
        canonical_text: true,
        normalized_text: true,
        not_normalized_texts: true,
        meaning_fa_IPA: true,
        meaning_fa_IPA_normalize: true,
        audio_file_name: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
  ]);
  const totalPages = showAll ? 1 : Math.max(1, Math.ceil(total / pageSize));
  const pageHref = (nextPage: number) => {
    const query = new URLSearchParams({ page: String(nextPage), pageSize: showAll ? "all" : String(pageSize), sort, dir });
    if (q) query.set("q", q);
    if (missingAudioOnly) query.set("missingAudio", "1");
    columns.forEach((column) => query.append("columns", column));
    return `/words/tables/persian-words?${query.toString()}`;
  };
  const sortHref = (field: SortField) => {
    const nextDir = field === sort && dir === "asc" ? "desc" : "asc";
    const query = new URLSearchParams({ page: "1", pageSize: showAll ? "all" : String(pageSize), sort: field, dir: nextDir });
    if (q) query.set("q", q);
    if (missingAudioOnly) query.set("missingAudio", "1");
    columns.forEach((column) => query.append("columns", column));
    return `/words/tables/persian-words?${query.toString()}`;
  };
  const clearHref = (() => {
    const query = new URLSearchParams({ page: "1", pageSize: showAll ? "all" : String(pageSize), sort, dir });
    if (missingAudioOnly) query.set("missingAudio", "1");
    columns.forEach((column) => query.append("columns", column));
    return `/words/tables/persian-words?${query.toString()}`;
  })();

  return (
    <main className="mx-auto w-full max-w-7xl p-4">
      <PageHeader
        title="PersianWord Table"
        subtitle="Browse Persian word records, play linked audio, and open any row for editing."
      />

      <section className="mt-4 overflow-hidden rounded border">
        <div className="p-3">
          <form className="flex flex-wrap items-center gap-2">
            <input
              name="q"
              defaultValue={q}
              placeholder="Search Persian text or IPA…"
              className="w-full rounded border px-3 py-2 text-sm sm:w-72"
            />
            <label className="flex items-center gap-1 text-sm">
              Rows
              <select name="pageSize" defaultValue={showAll ? "all" : String(pageSize)} className="rounded border px-2 py-2">
                <option value="100">100</option>
                <option value="250">250</option>
                <option value="500">500</option>
                <option value="1000">1000</option>
                <option value="all">All ({total})</option>
              </select>
            </label>
            <input type="hidden" name="sort" value={sort} />
            <input type="hidden" name="dir" value={dir} />
            <label className="flex items-center gap-1 text-sm"><input name="missingAudio" type="checkbox" value="1" defaultChecked={missingAudioOnly} /> Only without audio</label>
            {columns.map((column) => <input key={column} type="hidden" name="columns" value={column} />)}
            <button type="submit" className="rounded border px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/5">
              Search
            </button>
            {q ? <Link href={clearHref} className="rounded border px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/5">Clear</Link> : null}
          </form>
          <div className="mt-3 grid gap-3 border-t pt-3 lg:grid-cols-2">
            <div className="flex flex-wrap items-center gap-2">
            <AddPersianWordModal />
            <PersianWordMeaningIpaPhase2 />
            </div>
            <div className="border-t pt-3 lg:border-l lg:border-t-0 lg:pl-3 lg:pt-0">
              <BatchPersianWordAudioGenerate />
            </div>
          </div>
        </div>
      </section>

      <section className="mt-4 rounded border p-3">
        <TableColumnSelector key={columns.join(",")} columns={TABLE_COLUMNS} selectedColumns={columns} />
      </section>

      <div className="mt-4 flex items-center justify-between gap-3 text-sm">
        <span className="opacity-80">Total: <strong>{total}</strong> • Page <strong>{page}/{totalPages}</strong></span>
        <div className="flex gap-2">
          <Link href={pageHref(Math.max(1, page - 1))} aria-disabled={page <= 1} className="rounded border px-3 py-2 hover:bg-black/5 aria-disabled:pointer-events-none aria-disabled:opacity-50 dark:hover:bg-white/5">Prev</Link>
          <Link href={pageHref(Math.min(totalPages, page + 1))} aria-disabled={page >= totalPages} className="rounded border px-3 py-2 hover:bg-black/5 aria-disabled:pointer-events-none aria-disabled:opacity-50 dark:hover:bg-white/5">Next</Link>
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded border">
        <div className="overflow-auto">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-background"><tr className="border-b">
              {hasColumn("id") ? <SortHeader href={sortHref("id")} label="id" active={sort === "id"} direction={dir} indicators={COLUMN_INDICATORS.id} /> : null}
              {hasColumn("canonical_text") ? <SortHeader href={sortHref("canonical_text")} label="canonical_text" active={sort === "canonical_text"} direction={dir} indicators={COLUMN_INDICATORS.canonical_text} /> : null}
              {hasColumn("normalized_text") ? <SortHeader href={sortHref("normalized_text")} label="normalized_text" active={sort === "normalized_text"} direction={dir} indicators={COLUMN_INDICATORS.normalized_text} /> : null}
              {hasColumn("not_normalized_texts") ? <th className="px-3 py-2"><div className="flex items-center gap-1"><TableColumnIndicators indicators={COLUMN_INDICATORS.not_normalized_texts} /><span>not_normalized_texts</span></div></th> : null}
              {hasColumn("meaning_fa_IPA") ? <SortHeader href={sortHref("meaning_fa_IPA")} label="meaning_fa_IPA" active={sort === "meaning_fa_IPA"} direction={dir} indicators={COLUMN_INDICATORS.meaning_fa_IPA} /> : null}
              {hasColumn("meaning_fa_IPA_normalize") ? <SortHeader href={sortHref("meaning_fa_IPA_normalize")} label="meaning_fa_IPA_normalize" active={sort === "meaning_fa_IPA_normalize"} direction={dir} /> : null}
              {hasColumn("audio_file_name") ? <SortHeader href={sortHref("audio_file_name")} label="audio" active={sort === "audio_file_name"} direction={dir} /> : null}
              {hasColumn("createdAt") ? <SortHeader href={sortHref("createdAt")} label="createdAt" active={sort === "createdAt"} direction={dir} /> : null}
              {hasColumn("updatedAt") ? <SortHeader href={sortHref("updatedAt")} label="updatedAt" active={sort === "updatedAt"} direction={dir} /> : null}
              {hasColumn("actions") ? <th className="px-3 py-2">actions</th> : null}
            </tr></thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b align-middle">
                  {hasColumn("id") ? <td className="whitespace-nowrap px-3 py-2 font-mono">{row.id}</td> : null}
                  {hasColumn("canonical_text") ? <td className="max-w-52 px-3 py-2 text-base" dir="rtl"><span className="block truncate" title={row.canonical_text}>{row.canonical_text}</span></td> : null}
                  {hasColumn("normalized_text") ? <td className="max-w-52 px-3 py-2" dir="rtl"><span className="block truncate" title={row.normalized_text}>{row.normalized_text}</span></td> : null}
                  {hasColumn("not_normalized_texts") ? <td className="max-w-64 px-3 py-2 font-mono"><span className="block truncate" title={JSON.stringify(row.not_normalized_texts)}>{JSON.stringify(row.not_normalized_texts)}</span></td> : null}
                  {hasColumn("meaning_fa_IPA") ? <td className="max-w-52 px-3 py-2"><span className="block truncate" title={row.meaning_fa_IPA ?? ""}>{row.meaning_fa_IPA ?? "—"}</span></td> : null}
                  {hasColumn("meaning_fa_IPA_normalize") ? <td className="max-w-52 px-3 py-2"><span className="block truncate" title={row.meaning_fa_IPA_normalize ?? ""}>{row.meaning_fa_IPA_normalize ?? "—"}</span></td> : null}
                  {hasColumn("audio_file_name") ? <td className="px-3 py-2"><PersianWordAudioControls id={row.id} filename={row.audio_file_name} /></td> : null}
                  {hasColumn("createdAt") ? <td className="whitespace-nowrap px-3 py-2 font-mono">{row.createdAt.toISOString()}</td> : null}
                  {hasColumn("updatedAt") ? <td className="whitespace-nowrap px-3 py-2 font-mono">{row.updatedAt.toISOString()}</td> : null}
                  {hasColumn("actions") ? <td className="px-3 py-2"><div className="flex flex-wrap gap-1"><OpenPersianWordEditorModal id={row.id} label={row.canonical_text} /><DeletePersianWordButton id={row.id} label={row.canonical_text} /></div></td> : null}
                </tr>
              ))}
              {!rows.length ? <tr><td colSpan={columns.length} className="px-3 py-6 text-center text-sm opacity-70">No rows.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
