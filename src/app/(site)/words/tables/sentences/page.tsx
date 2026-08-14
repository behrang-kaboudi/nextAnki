import Link from "next/link";
import type { Prisma } from "@prisma/client";

import SentenceEditorModal, { type SentenceEditorItem } from "@/app/(site)/sentences/editor/SentenceEditorModal.client";
import { PageHeader } from "@/components/page-header";
import { TableColumnIndicators, type TableColumnIndicator } from "@/components/table-column-indicators";
import { TableColumnSelector } from "@/components/table-column-selector";
import TableFieldMaintenance from "@/components/table-field-maintenance/TableFieldMaintenance.client";
import { getPendingSentenceAudioIds } from "@/lib/audio/wordAudioPending.server";
import { prisma } from "@/lib/prisma";
import { getSentenceColumnEmptyCounts } from "@/lib/words/tableColumnEmptyCounts.server";
import WordFieldVoiceCell from "@/app/(site)/words/hints/WordFieldVoiceCell.client";
import BatchWordFieldVoiceGenerate from "@/app/(site)/words/hints/BatchWordFieldVoiceGenerate.client";
import DeleteUnreferencedSentences from "./DeleteUnreferencedSentences.client";
import { countUnreferencedSentences } from "@/lib/sentences/unreferencedSentenceMaintenance.server";
import {
  sentenceIdsForActiveWordSenseMaintenancePreview,
  sentenceIdsForWordSenseMaintenanceOperation,
} from "@/lib/words/wordSenseFieldMaintenance.server";

export const metadata = { title: "Words — Sentence Table" };
export const runtime = "nodejs";

const SORT_FIELDS = ["id", "sentence_en", "sentence_en_meaning_fa", "sentence_en_audio_file_name", "sentence_en_audio_source_text", "sentence_en_meaning_fa_audio_file_name", "sentence_en_meaning_fa_audio_source_text", "createdAt", "updatedAt"] as const;
type SortField = (typeof SORT_FIELDS)[number];
const TABLE_COLUMNS = [
  { key: "id", label: "id", required: true },
  { key: "sentence_en", label: "sentence_en" },
  { key: "sentence_en_meaning_fa", label: "sentence_en_meaning_fa" },
  { key: "sentence_en_audio_file_name", label: "sentence_en_audio_file_name" },
  { key: "sentence_en_audio_source_text", label: "sentence_en_audio_source_text" },
  { key: "sentence_en_meaning_fa_audio_file_name", label: "sentence_en_meaning_fa_audio_file_name" },
  { key: "sentence_en_meaning_fa_audio_source_text", label: "sentence_en_meaning_fa_audio_source_text" },
  { key: "createdAt", label: "createdAt" },
  { key: "updatedAt", label: "updatedAt" },
  { key: "actions", label: "actions" },
] as const;
type TableColumnKey = (typeof TABLE_COLUMNS)[number]["key"];
const DEFAULT_COLUMNS: TableColumnKey[] = ["id", "sentence_en", "sentence_en_audio_file_name", "sentence_en_audio_source_text", "sentence_en_meaning_fa", "sentence_en_meaning_fa_audio_file_name", "sentence_en_meaning_fa_audio_source_text", "updatedAt", "actions"];
const COLUMN_INDICATORS: Partial<Record<TableColumnKey, readonly TableColumnIndicator[]>> = {
  id: [{ kind: "primary-key", text: "Primary key: Sentence.id" }],
  sentence_en: [{ kind: "unique", text: "Unique sentence text: Sentence.sentence_en" }],
};

function positiveInt(value: string | undefined, fallback: number) {
  const result = Number(value);
  return Number.isFinite(result) && result > 0 ? Math.floor(result) : fallback;
}

function parseColumns(value: string | string[] | undefined): TableColumnKey[] {
  const requested = Array.isArray(value) ? value : value ? [value] : [];
  return requested.length
    ? TABLE_COLUMNS.map((column) => column.key).filter((key) => key === "id" || requested.includes(key))
    : DEFAULT_COLUMNS;
}

function SortHeader({ href, label, active, direction, indicators }: { href: string; label: string; active: boolean; direction: "asc" | "desc"; indicators?: readonly TableColumnIndicator[] }) {
  return <th className="whitespace-nowrap px-3 py-2"><Link href={href} className="inline-flex items-center gap-1 hover:underline"><TableColumnIndicators indicators={indicators} /><span>{label} <span className={active ? "opacity-100" : "opacity-40"}>{active && direction === "asc" ? "↑" : "↓"}</span></span></Link></th>;
}

export default async function SentencesTablePage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string; pageSize?: string; sort?: string; dir?: string; columns?: string | string[]; missingAudio?: string; ids?: string; maintenanceOperationId?: string; maintenancePreviewId?: string }> }) {
  const params = await searchParams;
  const q = String(params.q ?? "").trim();
  const page = positiveInt(params.page, 1);
  const pageSize = Math.min(Math.max(positiveInt(params.pageSize, 50), 10), 200);
  const sort = SORT_FIELDS.includes(params.sort as SortField) ? (params.sort as SortField) : "updatedAt";
  const dir = params.dir === "asc" ? "asc" : "desc";
  const columns = parseColumns(params.columns);
  const missingAudio = ["sentence_en", "sentence_en_meaning_fa", "any"].includes(String(params.missingAudio)) ? String(params.missingAudio) : "";
  const directIds = String(params.ids ?? "").split(",").map(Number).filter((id) => Number.isSafeInteger(id) && id > 0);
  const operationIds = params.maintenanceOperationId
    ? await sentenceIdsForWordSenseMaintenanceOperation(params.maintenanceOperationId)
    : [];
  const previewIds = params.maintenancePreviewId
    ? sentenceIdsForActiveWordSenseMaintenancePreview(params.maintenancePreviewId)
    : [];
  const inspectedIds = [...new Set([...directIds, ...operationIds, ...previewIds])];
  const hasInspectionScope = Boolean(params.ids || params.maintenanceOperationId || params.maintenancePreviewId);
  const hasColumn = (key: TableColumnKey) => columns.includes(key);
  const filters: Prisma.SentenceWhereInput[] = [];
  if (q) filters.push({ OR: [{ sentence_en: { contains: q } }, { sentence_en_meaning_fa: { contains: q } }, { sentence_en_audio_source_text: { contains: q } }, { sentence_en_meaning_fa_audio_source_text: { contains: q } }] });
  if (hasInspectionScope) filters.push({ id: { in: inspectedIds } });
  if (missingAudio) {
    const [sentenceIds, meaningIds] = await Promise.all([
      missingAudio === "sentence_en" || missingAudio === "any"
        ? getPendingSentenceAudioIds("sentence_en")
        : Promise.resolve([]),
      missingAudio === "sentence_en_meaning_fa" || missingAudio === "any"
        ? getPendingSentenceAudioIds("sentence_en_meaning_fa")
        : Promise.resolve([]),
    ]);
    filters.push({ id: { in: [...new Set([...sentenceIds, ...meaningIds])] } });
  }
  const where: Prisma.SentenceWhereInput | undefined = filters.length ? { AND: filters } : undefined;
  const primaryOrderBy: Prisma.SentenceOrderByWithRelationInput = sort === "sentence_en_meaning_fa"
    ? { [sort]: { sort: dir, nulls: dir === "asc" ? "first" : "last" } } as Prisma.SentenceOrderByWithRelationInput
    : { [sort]: dir } as Prisma.SentenceOrderByWithRelationInput;
  const orderBy: Prisma.SentenceOrderByWithRelationInput[] = [primaryOrderBy, ...(sort === "id" ? [] : [{ id: "desc" as const }])];
  const [total, rows, emptyCounts, unreferencedSentenceCount] = await Promise.all([
    prisma.sentence.count({ where }),
    prisma.sentence.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    getSentenceColumnEmptyCounts(),
    countUnreferencedSentences(),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const href = (nextPage: number, nextSort = sort, nextDir = dir) => {
    const query = new URLSearchParams({ page: String(nextPage), pageSize: String(pageSize), sort: nextSort, dir: nextDir });
    if (q) query.set("q", q);
    if (missingAudio) query.set("missingAudio", missingAudio);
    if (params.ids) query.set("ids", params.ids);
    if (params.maintenanceOperationId) query.set("maintenanceOperationId", params.maintenanceOperationId);
    if (params.maintenancePreviewId) query.set("maintenancePreviewId", params.maintenancePreviewId);
    columns.forEach((column) => query.append("columns", column));
    return `/words/tables/sentences?${query.toString()}`;
  };
  const clearHref = (() => {
    const query = new URLSearchParams({ page: "1", pageSize: String(pageSize), sort, dir });
    columns.forEach((column) => query.append("columns", column));
    return `/words/tables/sentences?${query.toString()}`;
  })();

  return <main className="mx-auto w-full max-w-7xl p-4">
    <PageHeader title="Sentence Table" subtitle="Browse unique sentence records and manage their owned English and Persian audio files." />
    {hasInspectionScope ? <div className="mt-4 rounded border border-blue-500/30 bg-blue-500/5 p-3 text-sm">{inspectedIds.length ? "Showing Sentence records affected by the selected WordSense maintenance preview or operation. Deleted rows appear again here after Undo." : "No current Sentence rows are available for this maintenance preview or operation; the preview may have expired or the rows may have been deleted."}</div> : null}
    <section className="mt-4 overflow-hidden rounded border"><div className="p-3">
      <form className="flex flex-wrap items-center gap-2"><input name="q" defaultValue={q} placeholder="Search sentence or Persian meaning…" className="w-full rounded border px-3 py-2 text-sm sm:w-96" /><label className="flex items-center gap-1 text-sm">Missing audio <select name="missingAudio" defaultValue={missingAudio} className="rounded border px-2 py-2"><option value="">All</option><option value="any">Either field</option><option value="sentence_en">sentence_en</option><option value="sentence_en_meaning_fa">sentence_en_meaning_fa</option></select></label><label className="flex items-center gap-1 text-sm">Rows <select name="pageSize" defaultValue={String(pageSize)} className="rounded border px-2 py-2"><option value="10">10</option><option value="25">25</option><option value="50">50</option><option value="100">100</option><option value="200">200</option></select></label><input type="hidden" name="sort" value={sort} /><input type="hidden" name="dir" value={dir} />{columns.map((column) => <input key={column} type="hidden" name="columns" value={column} />)}<button type="submit" className="rounded border px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/5">Search</button>{q || missingAudio ? <Link href={clearHref} className="rounded border px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/5">Clear</Link> : null}</form>
      <div className="mt-3 grid gap-4 border-t pt-3 lg:grid-cols-[minmax(240px,0.7fr)_minmax(0,1.3fr)]">
        <div className="flex flex-col items-start gap-2">
          <TableFieldMaintenance modelLabel="Sentence" apiBase="/api/table-field-maintenance/Sentence" />
          <DeleteUnreferencedSentences initialCount={unreferencedSentenceCount} />
          <p className="max-w-md text-sm leading-relaxed opacity-70">Clear database fields safely with dependency previews, audio quarantine, and Undo.</p>
        </div>
        <div className="grid min-w-0 gap-3 xl:grid-cols-2">
          <div className="min-w-0 rounded-lg border bg-black/[0.015] p-3 dark:bg-white/[0.025]"><BatchWordFieldVoiceGenerate field="sentence_en" /></div>
          <div className="min-w-0 rounded-lg border bg-black/[0.015] p-3 dark:bg-white/[0.025]"><BatchWordFieldVoiceGenerate field="sentence_en_meaning_fa" /></div>
        </div>
      </div>
    </div></section>
    <section className="mt-4 rounded border p-3"><TableColumnSelector key={columns.join(",")} columns={TABLE_COLUMNS} selectedColumns={columns} emptyCounts={emptyCounts} /></section>
    <div className="mt-4 flex items-center justify-between gap-3 text-sm"><span className="opacity-80">Total: <strong>{total}</strong> • Page <strong>{page}/{totalPages}</strong></span><div className="flex gap-2"><Link href={href(Math.max(1, page - 1))} aria-disabled={page <= 1} className="rounded border px-3 py-2 hover:bg-black/5 aria-disabled:pointer-events-none aria-disabled:opacity-50 dark:hover:bg-white/5">Prev</Link><Link href={href(Math.min(totalPages, page + 1))} aria-disabled={page >= totalPages} className="rounded border px-3 py-2 hover:bg-black/5 aria-disabled:pointer-events-none aria-disabled:opacity-50 dark:hover:bg-white/5">Next</Link></div></div>
    <div className="mt-4 overflow-auto rounded border"><table className="w-full text-left text-xs"><thead className="bg-background"><tr className="border-b">
      {hasColumn("id") ? <SortHeader href={href(1, "id", sort === "id" && dir === "asc" ? "desc" : "asc")} label="id" active={sort === "id"} direction={dir} indicators={COLUMN_INDICATORS.id} /> : null}
      {hasColumn("sentence_en") ? <SortHeader href={href(1, "sentence_en", sort === "sentence_en" && dir === "asc" ? "desc" : "asc")} label="sentence_en" active={sort === "sentence_en"} direction={dir} indicators={COLUMN_INDICATORS.sentence_en} /> : null}
      {hasColumn("sentence_en_audio_file_name") ? <SortHeader href={href(1, "sentence_en_audio_file_name", sort === "sentence_en_audio_file_name" && dir === "asc" ? "desc" : "asc")} label="sentence_en audio" active={sort === "sentence_en_audio_file_name"} direction={dir} /> : null}
      {hasColumn("sentence_en_audio_source_text") ? <SortHeader href={href(1, "sentence_en_audio_source_text", sort === "sentence_en_audio_source_text" && dir === "asc" ? "desc" : "asc")} label="sentence_en audio source" active={sort === "sentence_en_audio_source_text"} direction={dir} /> : null}
      {hasColumn("sentence_en_meaning_fa") ? <SortHeader href={href(1, "sentence_en_meaning_fa", sort === "sentence_en_meaning_fa" && dir === "asc" ? "desc" : "asc")} label="sentence_en_meaning_fa" active={sort === "sentence_en_meaning_fa"} direction={dir} /> : null}
      {hasColumn("sentence_en_meaning_fa_audio_file_name") ? <SortHeader href={href(1, "sentence_en_meaning_fa_audio_file_name", sort === "sentence_en_meaning_fa_audio_file_name" && dir === "asc" ? "desc" : "asc")} label="meaning audio" active={sort === "sentence_en_meaning_fa_audio_file_name"} direction={dir} /> : null}
      {hasColumn("sentence_en_meaning_fa_audio_source_text") ? <SortHeader href={href(1, "sentence_en_meaning_fa_audio_source_text", sort === "sentence_en_meaning_fa_audio_source_text" && dir === "asc" ? "desc" : "asc")} label="meaning audio source" active={sort === "sentence_en_meaning_fa_audio_source_text"} direction={dir} /> : null}
      {hasColumn("createdAt") ? <SortHeader href={href(1, "createdAt", sort === "createdAt" && dir === "asc" ? "desc" : "asc")} label="createdAt" active={sort === "createdAt"} direction={dir} /> : null}{hasColumn("updatedAt") ? <SortHeader href={href(1, "updatedAt", sort === "updatedAt" && dir === "asc" ? "desc" : "asc")} label="updatedAt" active={sort === "updatedAt"} direction={dir} /> : null}{hasColumn("actions") ? <th className="px-3 py-2">actions</th> : null}
    </tr></thead><tbody>{rows.map((row) => {
      const item: SentenceEditorItem = { id: row.id, sentence_en: row.sentence_en, sentence_en_meaning_fa: row.sentence_en_meaning_fa, sentence_en_audio_file_name: row.sentence_en_audio_file_name, sentence_en_meaning_fa_audio_file_name: row.sentence_en_meaning_fa_audio_file_name, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() };
      return <tr key={row.id} className="border-b align-top">{hasColumn("id") ? <td className="px-3 py-2 font-mono">{row.id}</td> : null}{hasColumn("sentence_en") ? <td className="max-w-80 px-3 py-2 text-sm"><span className="block truncate" title={row.sentence_en}>{row.sentence_en}</span></td> : null}{hasColumn("sentence_en_audio_file_name") ? <td className="max-w-64 px-3 py-2"><span className="mb-1 block truncate font-mono text-[10px] opacity-70" title={row.sentence_en_audio_file_name ?? ""}>{row.sentence_en_audio_file_name ?? "—"}</span><WordFieldVoiceCell field="sentence_en" audioKey={String(row.id)} text={row.sentence_en} /></td> : null}{hasColumn("sentence_en_audio_source_text") ? <td className="max-w-80 px-3 py-2"><span className="block truncate" title={row.sentence_en_audio_source_text ?? ""}>{row.sentence_en_audio_source_text ?? "—"}</span></td> : null}{hasColumn("sentence_en_meaning_fa") ? <td className="max-w-80 px-3 py-2" dir="rtl"><span className="block truncate" title={row.sentence_en_meaning_fa ?? ""}>{row.sentence_en_meaning_fa ?? "—"}</span></td> : null}{hasColumn("sentence_en_meaning_fa_audio_file_name") ? <td className="max-w-64 px-3 py-2"><span className="mb-1 block truncate font-mono text-[10px] opacity-70" title={row.sentence_en_meaning_fa_audio_file_name ?? ""}>{row.sentence_en_meaning_fa_audio_file_name ?? "—"}</span><WordFieldVoiceCell field="sentence_en_meaning_fa" audioKey={String(row.id)} text={row.sentence_en_meaning_fa} /></td> : null}{hasColumn("sentence_en_meaning_fa_audio_source_text") ? <td className="max-w-80 px-3 py-2" dir="rtl"><span className="block truncate" title={row.sentence_en_meaning_fa_audio_source_text ?? ""}>{row.sentence_en_meaning_fa_audio_source_text ?? "—"}</span></td> : null}{hasColumn("createdAt") ? <td className="whitespace-nowrap px-3 py-2 font-mono">{item.createdAt}</td> : null}{hasColumn("updatedAt") ? <td className="whitespace-nowrap px-3 py-2 font-mono">{item.updatedAt}</td> : null}{hasColumn("actions") ? <td className="px-3 py-2"><SentenceEditorModal item={item} compact /></td> : null}</tr>;
    })}{!rows.length ? <tr><td colSpan={columns.length} className="px-3 py-8 text-center text-sm opacity-70">No rows.</td></tr> : null}</tbody></table></div>
  </main>;
}
