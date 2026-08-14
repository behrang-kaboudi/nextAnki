import Link from "next/link";
import type { Prisma } from "@prisma/client";

import { PageHeader } from "@/components/page-header";
import { TableColumnIndicators, type TableColumnIndicator } from "@/components/table-column-indicators";
import { TableColumnSelector } from "@/components/table-column-selector";
import TableFieldMaintenance from "@/components/table-field-maintenance/TableFieldMaintenance.client";
import { BulkReviewStatusActions } from "@/components/review-status/BulkReviewStatusActions.client";
import { getPendingPersianWordAudioIds } from "@/lib/audio/wordAudioPending.server";
import { countDeletablePersianWords } from "@/lib/persian/unreferencedPersianWordMaintenance.server";
import { prisma } from "@/lib/prisma";
import { getPersianWordColumnEmptyCounts } from "@/lib/words/tableColumnEmptyCounts.server";

import OpenPersianWordEditorModal from "./OpenPersianWordEditorModal.client";
import BatchWordFieldVoiceGenerate from "../../hints/BatchWordFieldVoiceGenerate.client";
import PersianWordAudioControls from "./PersianWordAudioControls.client";
import PersianWordMeaningIpaPhase2 from "./PersianWordMeaningIpaPhase2.client";
import PersianWordMeaningIpaConfirmedToggle from "./PersianWordMeaningIpaConfirmedToggle.client";
import AddPersianWordModal from "./AddPersianWordModal.client";
import DeletePersianWordButton from "./DeletePersianWordButton.client";
import DeleteUnreferencedPersianWords from "./DeleteUnreferencedPersianWords.client";

export const metadata = { title: "Words — PersianWord Table" };
export const runtime = "nodejs";

function parsePositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

const SORT_FIELDS = ["id", "canonical_text", "normalized_text", "meaning_fa_IPA", "meaning_fa_IPA_normalize", "meaning_fa_IPA_confirmed", "audio_file_name", "audio_source_text", "createdAt", "updatedAt"] as const;
type SortField = (typeof SORT_FIELDS)[number];

const TABLE_COLUMNS = [
  { key: "id", label: "id", required: true },
  { key: "canonical_text", label: "canonical_text" },
  { key: "normalized_text", label: "normalized_text" },
  { key: "not_normalized_texts", label: "not_normalized_texts" },
  { key: "meaning_fa_IPA", label: "meaning_fa_IPA" },
  { key: "meaning_fa_IPA_normalize", label: "meaning_fa_IPA_normalize" },
  { key: "meaning_fa_IPA_confirmed", label: "meaning_fa_IPA_confirmed" },
  { key: "audio_file_name", label: "audio_file_name" },
  { key: "audio_source_text", label: "audio_source_text" },
  { key: "createdAt", label: "createdAt" },
  { key: "updatedAt", label: "updatedAt" },
  { key: "actions", label: "actions" },
] as const;

type TableColumnKey = (typeof TABLE_COLUMNS)[number]["key"];
const DEFAULT_TABLE_COLUMNS: TableColumnKey[] = ["id", "canonical_text", "normalized_text", "meaning_fa_IPA", "meaning_fa_IPA_confirmed", "audio_file_name", "audio_source_text", "updatedAt", "actions"];

const COLUMN_INDICATORS: Partial<Record<TableColumnKey, readonly TableColumnIndicator[]>> = {
  id: [
    { kind: "primary-key", text: "Primary key: PersianWord.id" },
    { kind: "unique", text: "Unique: PersianWord.id (enforced by the primary key)" },
  ],
  canonical_text: [{ kind: "index", text: "Index: PersianWord_canonical_text_idx" }],
  normalized_text: [{ kind: "index", text: "Index: PersianWord_normalized_text_idx" }],
  not_normalized_texts: [{ kind: "unique", text: "Unique items: duplicate values are not allowed within this row's not_normalized_texts array" }],
  meaning_fa_IPA: [{ kind: "unique", text: "Composite unique: normalized_text + meaning_fa_IPA" }],
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
  searchParams: Promise<{ q?: string; page?: string; pageSize?: string; sort?: string; dir?: string; missingAudio?: string; ipaConfirmed?: string; columns?: string | string[] }>;
}) {
  const params = await searchParams;
  const q = String(params.q ?? "").trim();
  const page = parsePositiveInt(params.page, 1);
  const showAll = params.pageSize === "all";
  const pageSize = Math.min(Math.max(parsePositiveInt(params.pageSize, 100), 10), 1000);
  const sort = parseSortField(params.sort);
  const dir = parseSortDirection(params.dir);
  const missingAudioOnly = params.missingAudio === "1";
  const ipaConfirmed = params.ipaConfirmed === "true" || params.ipaConfirmed === "false" ? params.ipaConfirmed : "all";
  const columns = parseColumns(params.columns);
  const hasColumn = (column: TableColumnKey) => columns.includes(column);
  const primaryOrderBy: Record<SortField, Prisma.PersianWordOrderByWithRelationInput> = {
    id: { id: dir },
    canonical_text: { canonical_text: dir },
    normalized_text: { normalized_text: dir },
    meaning_fa_IPA: { meaning_fa_IPA: dir },
    meaning_fa_IPA_normalize: { meaning_fa_IPA_normalize: dir },
    meaning_fa_IPA_confirmed: { meaning_fa_IPA_confirmed: dir },
    audio_file_name: { audio_file_name: dir },
    audio_source_text: { audio_source_text: dir },
    createdAt: { createdAt: dir },
    updatedAt: { updatedAt: dir },
  };
  const filters: Prisma.PersianWordWhereInput[] = [];
  if (q) filters.push({ OR: [{ canonical_text: { contains: q } }, { normalized_text: { contains: q } }, { meaning_fa_IPA: { contains: q } }, { meaning_fa_IPA_normalize: { contains: q } }, { audio_source_text: { contains: q } }] });
  if (missingAudioOnly) filters.push({ id: { in: await getPendingPersianWordAudioIds() } });
  if (ipaConfirmed !== "all") filters.push({ meaning_fa_IPA_confirmed: ipaConfirmed === "true" });
  const where = filters.length ? { AND: filters } : undefined;
  const [total, rows, emptyCounts, missingMeaningIpaCount, pendingMeaningIpaConfirmationCount, deletablePersianWordCount] = await Promise.all([
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
        meaning_fa_IPA_confirmed: true,
        audio_file_name: true,
        audio_source_text: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    getPersianWordColumnEmptyCounts(),
    prisma.persianWord.count({ where: { OR: [{ meaning_fa_IPA: null }, { meaning_fa_IPA: "" }] } }),
    prisma.persianWord.count({
      where: {
        meaning_fa_IPA_confirmed: false,
        AND: [{ meaning_fa_IPA: { not: null } }, { meaning_fa_IPA: { not: "" } }],
      },
    }),
    countDeletablePersianWords(),
  ]);
  const totalPages = showAll ? 1 : Math.max(1, Math.ceil(total / pageSize));
  const pageHref = (nextPage: number) => {
    const query = new URLSearchParams({ page: String(nextPage), pageSize: showAll ? "all" : String(pageSize), sort, dir });
    if (q) query.set("q", q);
    if (missingAudioOnly) query.set("missingAudio", "1");
    if (ipaConfirmed !== "all") query.set("ipaConfirmed", ipaConfirmed);
    columns.forEach((column) => query.append("columns", column));
    return `/words/tables/persian-words?${query.toString()}`;
  };
  const sortHref = (field: SortField) => {
    const nextDir = field === sort && dir === "asc" ? "desc" : "asc";
    const query = new URLSearchParams({ page: "1", pageSize: showAll ? "all" : String(pageSize), sort: field, dir: nextDir });
    if (q) query.set("q", q);
    if (missingAudioOnly) query.set("missingAudio", "1");
    if (ipaConfirmed !== "all") query.set("ipaConfirmed", ipaConfirmed);
    columns.forEach((column) => query.append("columns", column));
    return `/words/tables/persian-words?${query.toString()}`;
  };
  const clearHref = (() => {
    const query = new URLSearchParams({ page: "1", pageSize: showAll ? "all" : String(pageSize), sort, dir });
    if (missingAudioOnly) query.set("missingAudio", "1");
    if (ipaConfirmed !== "all") query.set("ipaConfirmed", ipaConfirmed);
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
            <label className="flex items-center gap-1 text-sm"><input name="missingAudio" type="checkbox" value="1" defaultChecked={missingAudioOnly} /> Needs audio generation</label>
            <label className="flex items-center gap-1 text-sm">
              Persian IPA review
              <select name="ipaConfirmed" defaultValue={ipaConfirmed} className="rounded border px-2 py-2">
                <option value="all">All</option>
                <option value="false">Unconfirmed</option>
                <option value="true">Confirmed</option>
              </select>
            </label>
            {columns.map((column) => <input key={column} type="hidden" name="columns" value={column} />)}
            <button type="submit" className="rounded border px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/5">
              Search
            </button>
            {q ? <Link href={clearHref} className="rounded border px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/5">Clear</Link> : null}
          </form>
          <div className="mt-3 grid gap-3 border-t pt-3 lg:grid-cols-2">
            <div className="flex flex-wrap items-center gap-2">
            <AddPersianWordModal />
            <DeleteUnreferencedPersianWords initialCount={deletablePersianWordCount} />
            <PersianWordMeaningIpaPhase2 initialMissingCount={missingMeaningIpaCount} />
            <BulkReviewStatusActions
              pendingCount={pendingMeaningIpaConfirmationCount}
              pendingUnit="تلفظ فارسی"
              confirmEndpoint="/api/words/persian-words/meaning-fa-ipa-confirmed/confirm-all"
              resetEndpoint="/api/words/persian-words/meaning-fa-ipa-confirmed/reset-confirmed"
              confirmSubject="تلفظ‌های فارسیِ دارای IPA"
              confirmWarning="فقط رکوردهایی که IPA دارند true می‌شوند؛ رکوردهای بدون IPA دست‌نخورده می‌مانند."
              resetSubject="وضعیت‌های تأیید تلفظ فارسی"
              resetWarning="همهٔ وضعیت‌های true این فیلد دوباره false می‌شوند و خود مقدار IPA تغییر نمی‌کند."
              resetHelpLabel="راهنمای بازنشانی تأیید IPA فارسی"
              resetHelpText="RESET فقط meaning_fa_IPA_confirmed را false می‌کند؛ مقدار IPA و نسخهٔ normalizeشده باقی می‌مانند."
            />
            <TableFieldMaintenance modelLabel="PersianWord" apiBase="/api/table-field-maintenance/PersianWord" />
            </div>
            <div className="border-t pt-3 lg:border-l lg:border-t-0 lg:pl-3 lg:pt-0">
              <BatchWordFieldVoiceGenerate field="canonical_text" />
            </div>
          </div>
        </div>
      </section>

      <section className="mt-4 rounded border p-3">
        <TableColumnSelector key={columns.join(",")} columns={TABLE_COLUMNS} selectedColumns={columns} emptyCounts={emptyCounts} />
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
              {hasColumn("meaning_fa_IPA_confirmed") ? <SortHeader href={sortHref("meaning_fa_IPA_confirmed")} label="meaning_fa_IPA_confirmed" active={sort === "meaning_fa_IPA_confirmed"} direction={dir} /> : null}
              {hasColumn("audio_file_name") ? <SortHeader href={sortHref("audio_file_name")} label="audio" active={sort === "audio_file_name"} direction={dir} /> : null}
              {hasColumn("audio_source_text") ? <SortHeader href={sortHref("audio_source_text")} label="audio_source_text" active={sort === "audio_source_text"} direction={dir} /> : null}
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
                  {hasColumn("meaning_fa_IPA_confirmed") ? <td className="px-3 py-2"><PersianWordMeaningIpaConfirmedToggle id={row.id} confirmed={row.meaning_fa_IPA_confirmed} hasMeaningIpa={Boolean(row.meaning_fa_IPA?.trim())} /></td> : null}
                  {hasColumn("audio_file_name") ? <td className="px-3 py-2"><PersianWordAudioControls id={row.id} filename={row.audio_file_name} /></td> : null}
                  {hasColumn("audio_source_text") ? <td className="max-w-52 px-3 py-2" dir="rtl"><span className="block truncate" title={row.audio_source_text ?? ""}>{row.audio_source_text ?? "—"}</span></td> : null}
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
