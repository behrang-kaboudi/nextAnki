import Link from "next/link";
import type { Prisma } from "@prisma/client";

import { PageHeader } from "@/components/page-header";
import { TableColumnIndicators, type TableColumnIndicator } from "@/components/table-column-indicators";
import { TableColumnSelector } from "@/components/table-column-selector";
import { prisma } from "@/lib/prisma";

import AddEnglishWordModal from "./AddEnglishWordModal.client";
import BatchEnglishWordAudioGenerate from "./BatchEnglishWordAudioGenerate.client";
import BatchEnglishWordJsonHintGenerate from "./BatchEnglishWordJsonHintGenerate.client";
import DictionaryApiUsImport from "./DictionaryApiUsImport.client";
import EnglishWordAudioControls from "./EnglishWordAudioControls.client";
import EnglishWordJsonHintControls from "./EnglishWordJsonHintControls.client";
import EnglishWordRowActions from "./EnglishWordRowActions.client";
import TemporaryEnglishWordScripts from "./TemporaryEnglishWordScripts.client";
import TemporaryWordImport from "./TemporaryWordImport.client";

export const metadata = { title: "Words — EnglishWord Table" };
export const runtime = "nodejs";

const SORT_FIELDS = ["id", "normalized_text", "phonetic_us", "phonetic_us_normalized", "audio_file_name", "createdAt", "updatedAt"] as const;
type SortField = (typeof SORT_FIELDS)[number];
const TABLE_COLUMNS = [
  { key: "id", label: "id", required: true },
  { key: "normalized_text", label: "normalized_text" },
  { key: "phonetic_us", label: "phonetic_us" },
  { key: "phonetic_us_normalized", label: "phonetic_us_normalized" },
  { key: "json_hint", label: "json_hint" },
  { key: "audio", label: "audio" },
  { key: "createdAt", label: "createdAt" },
  { key: "updatedAt", label: "updatedAt" },
  { key: "actions", label: "actions" },
] as const;
type TableColumnKey = (typeof TABLE_COLUMNS)[number]["key"];
const DEFAULT_COLUMNS: TableColumnKey[] = ["id", "normalized_text", "phonetic_us", "phonetic_us_normalized", "audio", "updatedAt", "actions"];
const COLUMN_INDICATORS: Partial<Record<TableColumnKey, readonly TableColumnIndicator[]>> = {
  id: [{ kind: "primary-key", text: "Primary key: EnglishWord.id" }],
  normalized_text: [{ kind: "unique", text: "Unique normalized English text" }],
  phonetic_us_normalized: [{ kind: "index", text: "Index: EnglishWord_phonetic_us_normalized_idx; duplicate values are allowed" }],
};

function positiveInt(value: string | undefined, fallback: number) {
  const result = Number(value);
  return Number.isFinite(result) && result > 0 ? Math.floor(result) : fallback;
}

function parseColumns(value: string | string[] | undefined): TableColumnKey[] {
  const requested = Array.isArray(value) ? value : value ? [value] : [];
  return requested.length ? TABLE_COLUMNS.map((column) => column.key).filter((key) => key === "id" || requested.includes(key)) : DEFAULT_COLUMNS;
}

function SortHeader({ href, label, active, direction, indicators }: { href: string; label: string; active: boolean; direction: "asc" | "desc"; indicators?: readonly TableColumnIndicator[] }) {
  return <th className="whitespace-nowrap px-3 py-2"><Link href={href} className="inline-flex items-center gap-1 hover:underline"><TableColumnIndicators indicators={indicators} /><span>{label} <span className={active ? "opacity-100" : "opacity-40"}>{active && direction === "asc" ? "↑" : "↓"}</span></span></Link></th>;
}

export default async function EnglishWordsTablePage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string; sort?: string; dir?: string; missingAudio?: string; columns?: string | string[] }> }) {
  const params = await searchParams;
  const q = String(params.q ?? "").trim();
  const page = positiveInt(params.page, 1);
  const sort = SORT_FIELDS.includes(params.sort as SortField) ? (params.sort as SortField) : "updatedAt";
  const dir = params.dir === "asc" ? "asc" : "desc";
  const missingAudio = params.missingAudio === "1";
  const columns = parseColumns(params.columns);
  const hasColumn = (key: TableColumnKey) => columns.includes(key);
  const where: Prisma.EnglishWordWhereInput | undefined = q || missingAudio ? { AND: [
    ...(q ? [{ OR: [{ normalized_text: { contains: q } }, { phonetic_us: { contains: q } }, { phonetic_us_normalized: { contains: q } }] }] : []),
    ...(missingAudio ? [{ OR: [{ audio_file_name: null }, { audio_file_name: "" }] }] : []),
  ] } : undefined;
  const orderBy: Prisma.EnglishWordOrderByWithRelationInput[] = [{ [sort]: dir } as Prisma.EnglishWordOrderByWithRelationInput, ...(sort === "id" ? [] : [{ id: "desc" as const }])];
  const [total, rows] = await Promise.all([
    prisma.englishWord.count({ where }),
    prisma.englishWord.findMany({ where, orderBy, skip: (page - 1) * 100, take: 100 }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / 100));
  const href = (nextPage: number, nextSort = sort, nextDir = dir) => {
    const query = new URLSearchParams({ page: String(nextPage), sort: nextSort, dir: nextDir });
    if (q) query.set("q", q);
    if (missingAudio) query.set("missingAudio", "1");
    columns.forEach((column) => query.append("columns", column));
    return `/words/tables/english-words?${query}`;
  };
  const clearQuery = new URLSearchParams({ page: "1", sort, dir });
  columns.forEach((column) => clearQuery.append("columns", column));

  return <main className="mx-auto w-full max-w-7xl p-4">
    <PageHeader title="EnglishWord Table" subtitle="Canonical English words and phrases with US pronunciation, JSON hints, and one audio file." />
    <section className="mt-4 overflow-hidden rounded border">
      <div className="p-3">
      <form className="flex flex-wrap items-center gap-2"><input name="q" defaultValue={q} placeholder="Search text or IPA…" className="w-full rounded border px-3 py-2 text-sm sm:w-80" /><input type="hidden" name="sort" value={sort} /><input type="hidden" name="dir" value={dir} /><label className="flex items-center gap-1 text-sm"><input name="missingAudio" value="1" type="checkbox" defaultChecked={missingAudio} /> Only without audio</label>{columns.map((column) => <input key={column} type="hidden" name="columns" value={column} />)}<button type="submit" className="rounded border px-3 py-2 text-sm">Search</button>{q || missingAudio ? <Link href={`/words/tables/english-words?${clearQuery}`} className="rounded border px-3 py-2 text-sm">Clear</Link> : null}</form>
        <div className="mt-3 grid gap-3 border-t pt-3 lg:grid-cols-2">
          <div className="flex flex-wrap items-center gap-2"><AddEnglishWordModal /></div>
          <div className="space-y-3 border-t pt-3 lg:border-l lg:border-t-0 lg:pl-3 lg:pt-0"><BatchEnglishWordAudioGenerate /><div className="border-t pt-3"><BatchEnglishWordJsonHintGenerate /></div></div>
        </div>
      </div>
    </section>
    <DictionaryApiUsImport />
    <TemporaryWordImport />
    <TemporaryEnglishWordScripts />
    <section className="mt-4 rounded border p-3"><TableColumnSelector key={columns.join(",")} columns={TABLE_COLUMNS} selectedColumns={columns} /></section>
    <div className="mt-4 flex items-center justify-between text-sm"><span>Total: <strong>{total}</strong> · Page <strong>{page}/{totalPages}</strong></span><div className="flex gap-2"><Link href={href(Math.max(1, page - 1))} aria-disabled={page <= 1} className="rounded border px-3 py-2 aria-disabled:pointer-events-none aria-disabled:opacity-50">Prev</Link><Link href={href(Math.min(totalPages, page + 1))} aria-disabled={page >= totalPages} className="rounded border px-3 py-2 aria-disabled:pointer-events-none aria-disabled:opacity-50">Next</Link></div></div>
    <div className="mt-4 overflow-auto rounded border"><table className="w-full text-left text-xs"><thead className="bg-background"><tr className="border-b">
      {hasColumn("id") ? <SortHeader href={href(1, "id", sort === "id" && dir === "asc" ? "desc" : "asc")} label="id" active={sort === "id"} direction={dir} indicators={COLUMN_INDICATORS.id} /> : null}
      {hasColumn("normalized_text") ? <SortHeader href={href(1, "normalized_text", sort === "normalized_text" && dir === "asc" ? "desc" : "asc")} label="normalized_text" active={sort === "normalized_text"} direction={dir} indicators={COLUMN_INDICATORS.normalized_text} /> : null}
      {hasColumn("phonetic_us") ? <SortHeader href={href(1, "phonetic_us", sort === "phonetic_us" && dir === "asc" ? "desc" : "asc")} label="phonetic_us" active={sort === "phonetic_us"} direction={dir} /> : null}
      {hasColumn("phonetic_us_normalized") ? <SortHeader href={href(1, "phonetic_us_normalized", sort === "phonetic_us_normalized" && dir === "asc" ? "desc" : "asc")} label="phonetic_us_normalized" active={sort === "phonetic_us_normalized"} direction={dir} indicators={COLUMN_INDICATORS.phonetic_us_normalized} /> : null}
      {hasColumn("json_hint") ? <th className="px-3 py-2">json_hint</th> : null}
      {hasColumn("audio") ? <SortHeader href={href(1, "audio_file_name", sort === "audio_file_name" && dir === "asc" ? "desc" : "asc")} label="audio" active={sort === "audio_file_name"} direction={dir} /> : null}
      {hasColumn("createdAt") ? <SortHeader href={href(1, "createdAt", sort === "createdAt" && dir === "asc" ? "desc" : "asc")} label="createdAt" active={sort === "createdAt"} direction={dir} /> : null}{hasColumn("updatedAt") ? <SortHeader href={href(1, "updatedAt", sort === "updatedAt" && dir === "asc" ? "desc" : "asc")} label="updatedAt" active={sort === "updatedAt"} direction={dir} /> : null}{hasColumn("actions") ? <th className="px-3 py-2">actions</th> : null}
    </tr></thead><tbody>{rows.map((item) => <tr key={item.id} className="border-b align-top">
      {hasColumn("id") ? <td className="px-3 py-2 font-mono">{item.id}</td> : null}{hasColumn("normalized_text") ? <td className="max-w-60 px-3 py-2 text-sm">{item.normalized_text}</td> : null}{hasColumn("phonetic_us") ? <td className="max-w-60 px-3 py-2 font-mono">{item.phonetic_us ?? "—"}</td> : null}{hasColumn("phonetic_us_normalized") ? <td className="max-w-60 px-3 py-2 font-mono">{item.phonetic_us_normalized ?? "—"}</td> : null}{hasColumn("json_hint") ? <td className="max-w-48 px-3 py-2 font-mono"><EnglishWordJsonHintControls id={item.id} jsonHint={item.json_hint} /></td> : null}{hasColumn("audio") ? <td className="min-w-48 px-3 py-2"><EnglishWordAudioControls id={item.id} filename={item.audio_file_name} /></td> : null}{hasColumn("createdAt") ? <td className="whitespace-nowrap px-3 py-2 font-mono">{item.createdAt.toISOString()}</td> : null}{hasColumn("updatedAt") ? <td className="whitespace-nowrap px-3 py-2 font-mono">{item.updatedAt.toISOString()}</td> : null}{hasColumn("actions") ? <td className="px-3 py-2"><EnglishWordRowActions item={item} showAudio={false} /></td> : null}
    </tr>)}{!rows.length ? <tr><td colSpan={columns.length} className="px-3 py-8 text-center text-sm opacity-70">No rows.</td></tr> : null}</tbody></table></div>
  </main>;
}
