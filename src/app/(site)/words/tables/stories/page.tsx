import Link from "next/link";
import { Prisma } from "@prisma/client";

import { PageHeader } from "@/components/page-header";
import { TableColumnIndicators, type TableColumnIndicator } from "@/components/table-column-indicators";
import { TableColumnSelector } from "@/components/table-column-selector";
import { getPendingWordSenseStoryAudioIds } from "@/lib/audio/wordAudioPending.server";
import { prisma } from "@/lib/prisma";
import BatchWordFieldVoiceGenerate from "@/app/(site)/words/hints/BatchWordFieldVoiceGenerate.client";

import StoryAudioControls from "./StoryAudioControls.client";

export const runtime = "nodejs";

const PAGE_SIZE = 100;
const TABLE_COLUMNS = [
  { key: "id", label: "id", required: true },
  { key: "wordSenseId", label: "wordSenseId" },
  { key: "english_word", label: "English word" },
  { key: "meaning_fa", label: "Persian meaning" },
  { key: "version", label: "version" },
  { key: "status", label: "status" },
  { key: "selectedSymbols", label: "selected symbols" },
  { key: "storyText", label: "story" },
  { key: "sentence", label: "sentence anchor" },
  { key: "audio", label: "audio" },
  { key: "audio_source_text", label: "audio source text" },
  { key: "promptVersion", label: "prompt version" },
  { key: "createdAt", label: "createdAt" },
  { key: "updatedAt", label: "updatedAt" },
] as const;
type TableColumnKey = (typeof TABLE_COLUMNS)[number]["key"];
const DEFAULT_COLUMNS: TableColumnKey[] = ["id", "wordSenseId", "english_word", "meaning_fa", "status", "selectedSymbols", "storyText", "sentence", "audio", "updatedAt"];
const SORT_FIELDS = ["id", "wordSenseId", "version", "isActive", "audio_file_name", "createdAt", "updatedAt"] as const;
type SortField = (typeof SORT_FIELDS)[number];

const COLUMN_INDICATORS: Partial<Record<TableColumnKey, readonly TableColumnIndicator[]>> = {
  id: [{ kind: "primary-key", text: "Primary key: WordSenseStory.id" }],
  wordSenseId: [{ kind: "foreign-key", text: "Foreign key to WordSense.id; indexed with isActive" }],
  version: [{ kind: "unique", text: "Unique together with wordSenseId" }],
  status: [{ kind: "index", text: "Index: WordSenseStory_wordSenseId_isActive_idx" }],
};

function positiveInt(value: unknown, fallback: number) {
  const n = Number(value);
  return Number.isSafeInteger(n) && n > 0 ? n : fallback;
}

function parseColumns(value: string | string[] | undefined): TableColumnKey[] {
  const requested = Array.isArray(value) ? value : value ? [value] : [];
  const allowed = new Set(TABLE_COLUMNS.map((column) => column.key));
  const selected = requested.filter((column): column is TableColumnKey => allowed.has(column as TableColumnKey));
  return [...new Set(["id" as const, ...(selected.length ? selected : DEFAULT_COLUMNS)])];
}

function SortHeader({ href, label, active, direction, indicators }: { href: string; label: string; active: boolean; direction: "asc" | "desc"; indicators?: readonly TableColumnIndicator[] }) {
  return <th className="whitespace-nowrap px-3 py-2"><Link href={href} className="inline-flex items-center gap-1 hover:underline"><TableColumnIndicators indicators={indicators} /><span>{label} <span className={active ? "opacity-100" : "opacity-40"}>{active && direction === "asc" ? "↑" : "↓"}</span></span></Link></th>;
}

function symbolTokens(value: Prisma.JsonValue) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => item && typeof item === "object" && !Array.isArray(item) && typeof item.token === "string" ? [item.token] : []);
}

export default async function WordSenseStoryTablePage({ searchParams }: { searchParams: Promise<{ q?: string; searchField?: string; page?: string; sort?: string; dir?: string; activeOnly?: string; missingAudio?: string; columns?: string | string[] }> }) {
  const params = await searchParams;
  const q = String(params.q ?? "").trim();
  const searchField = ["all", "id", "wordSenseId", "english_word", "storyText"].includes(String(params.searchField)) ? String(params.searchField) : "all";
  const page = positiveInt(params.page, 1);
  const sort = SORT_FIELDS.includes(params.sort as SortField) ? params.sort as SortField : "updatedAt";
  const dir = params.dir === "asc" ? "asc" : "desc";
  const activeOnly = params.activeOnly !== "0";
  const missingAudio = params.missingAudio === "1";
  const columns = parseColumns(params.columns);
  const hasColumn = (key: TableColumnKey) => columns.includes(key);
  const numericQuery = Number(q);
  const exactId = Number.isSafeInteger(numericQuery) && numericQuery > 0 ? numericQuery : -1;
  const pendingAudioIds = missingAudio ? await getPendingWordSenseStoryAudioIds() : [];
  const searchWhere: Prisma.WordSenseStoryWhereInput | undefined = q
    ? searchField === "id" ? { id: exactId }
      : searchField === "wordSenseId" ? { wordSenseId: exactId }
        : searchField === "english_word" ? { wordSense: { english: { base_form: { contains: q } } } }
          : searchField === "storyText" ? { storyText: { contains: q } }
            : { OR: [
              { storyText: { contains: q } },
              { wordSense: { english: { base_form: { contains: q } } } },
              { wordSense: { meaning: { canonical_text: { contains: q } } } },
              { id: exactId },
              { wordSenseId: exactId },
            ] }
    : undefined;
  const where: Prisma.WordSenseStoryWhereInput = { AND: [
    ...(activeOnly ? [{ isActive: true }] : []),
    ...(missingAudio ? [{ id: { in: pendingAudioIds } }] : []),
    ...(searchWhere ? [searchWhere] : []),
  ] };
  const orderBy: Prisma.WordSenseStoryOrderByWithRelationInput[] = [{ [sort]: dir } as Prisma.WordSenseStoryOrderByWithRelationInput, ...(sort === "id" ? [] : [{ id: "desc" as const }])];
  const [total, rows] = await Promise.all([
    prisma.wordSenseStory.count({ where }),
    prisma.wordSenseStory.findMany({
      where, orderBy, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE,
      include: {
        wordSense: { include: { english: { select: { base_form: true } }, meaning: { select: { canonical_text: true } } } },
        sentence: { select: { sentence_en: true, sentence_en_meaning_fa: true } },
      },
    }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const href = (nextPage: number, nextSort = sort, nextDir = dir) => {
    const query = new URLSearchParams({ page: String(nextPage), sort: nextSort, dir: nextDir, searchField, activeOnly: activeOnly ? "1" : "0" });
    if (q) query.set("q", q);
    if (missingAudio) query.set("missingAudio", "1");
    columns.forEach((column) => query.append("columns", column));
    return `/words/tables/stories?${query}`;
  };

  return <main className="mx-auto w-full max-w-7xl p-4">
    <PageHeader title="WordSenseStory Table" subtitle="Reviewed mnemonic stories tied to exact WordSense, sentence, and pronunciation-symbol sources." />
    <section className="mt-4 overflow-hidden rounded border">
      <div className="p-3">
        <form className="flex flex-wrap items-center gap-2">
          <input name="q" defaultValue={q} placeholder="Search story, English word, meaning, or id…" className="w-full rounded border px-3 py-2 text-sm sm:w-96" />
          <input type="hidden" name="sort" value={sort} /><input type="hidden" name="dir" value={dir} />
          {columns.map((column) => <input key={column} type="hidden" name="columns" value={column} />)}
          <select name="searchField" defaultValue={searchField} className="rounded border px-3 py-2 text-sm" aria-label="Search field"><option value="all">All fields</option><option value="id">Story id</option><option value="wordSenseId">WordSense id</option><option value="english_word">English word</option><option value="storyText">Story text</option></select>
          <select name="activeOnly" defaultValue={activeOnly ? "1" : "0"} className="rounded border px-3 py-2 text-sm" aria-label="Story version filter"><option value="1">Active versions only</option><option value="0">All versions</option></select>
          <label className="flex items-center gap-1 text-sm"><input name="missingAudio" value="1" type="checkbox" defaultChecked={missingAudio} /> Needs audio generation</label>
          <button type="submit" className="rounded border px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/5">Search</button>
          <Link href="/words/tables/stories" className="rounded border px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/5">Clear</Link>
        </form>
        <div className="mt-3 grid gap-3 border-t pt-3 lg:grid-cols-2">
          <div className="flex flex-wrap items-start gap-2"><Link href="/words/tables/words" className="rounded border px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/5">Generate stories from WordSense Table</Link><p className="max-w-xl text-xs leading-5 text-muted">A changed or cleared json_hint deletes dependent stories. Replacement always requires a separate prompt run, QA review, and Apply.</p></div>
          <div className="border-t pt-3 lg:border-l lg:border-t-0 lg:pl-3 lg:pt-0"><BatchWordFieldVoiceGenerate field="story_text" /></div>
        </div>
      </div>
    </section>
    <section className="mt-4 rounded border p-3"><TableColumnSelector key={columns.join(",")} columns={TABLE_COLUMNS} selectedColumns={columns} /></section>
    <div className="mt-4 flex items-center justify-between text-sm"><span>Total: <strong>{total}</strong> · Page <strong>{page}/{totalPages}</strong></span><div className="flex gap-2"><Link href={href(Math.max(1, page - 1))} aria-disabled={page <= 1} className="rounded border px-3 py-2 aria-disabled:pointer-events-none aria-disabled:opacity-50">Prev</Link><Link href={href(Math.min(totalPages, page + 1))} aria-disabled={page >= totalPages} className="rounded border px-3 py-2 aria-disabled:pointer-events-none aria-disabled:opacity-50">Next</Link></div></div>
    <div className="mt-4 overflow-auto rounded border"><table className="w-full text-left text-xs"><thead className="bg-background"><tr className="border-b">
      {hasColumn("id") ? <SortHeader href={href(1, "id", sort === "id" && dir === "asc" ? "desc" : "asc")} label="id" active={sort === "id"} direction={dir} indicators={COLUMN_INDICATORS.id} /> : null}
      {hasColumn("wordSenseId") ? <SortHeader href={href(1, "wordSenseId", sort === "wordSenseId" && dir === "asc" ? "desc" : "asc")} label="wordSenseId" active={sort === "wordSenseId"} direction={dir} indicators={COLUMN_INDICATORS.wordSenseId} /> : null}
      {hasColumn("english_word") ? <th className="px-3 py-2">English word</th> : null}{hasColumn("meaning_fa") ? <th className="px-3 py-2">Persian meaning</th> : null}
      {hasColumn("version") ? <SortHeader href={href(1, "version", sort === "version" && dir === "asc" ? "desc" : "asc")} label="version" active={sort === "version"} direction={dir} indicators={COLUMN_INDICATORS.version} /> : null}
      {hasColumn("status") ? <SortHeader href={href(1, "isActive", sort === "isActive" && dir === "asc" ? "desc" : "asc")} label="status" active={sort === "isActive"} direction={dir} indicators={COLUMN_INDICATORS.status} /> : null}
      {hasColumn("selectedSymbols") ? <th className="px-3 py-2">selected symbols</th> : null}{hasColumn("storyText") ? <th className="px-3 py-2">story</th> : null}{hasColumn("sentence") ? <th className="px-3 py-2">sentence anchor</th> : null}
      {hasColumn("audio") ? <SortHeader href={href(1, "audio_file_name", sort === "audio_file_name" && dir === "asc" ? "desc" : "asc")} label="audio" active={sort === "audio_file_name"} direction={dir} /> : null}
      {hasColumn("audio_source_text") ? <th className="px-3 py-2">audio source text</th> : null}{hasColumn("promptVersion") ? <th className="px-3 py-2">prompt version</th> : null}
      {hasColumn("createdAt") ? <SortHeader href={href(1, "createdAt", sort === "createdAt" && dir === "asc" ? "desc" : "asc")} label="createdAt" active={sort === "createdAt"} direction={dir} /> : null}{hasColumn("updatedAt") ? <SortHeader href={href(1, "updatedAt", sort === "updatedAt" && dir === "asc" ? "desc" : "asc")} label="updatedAt" active={sort === "updatedAt"} direction={dir} /> : null}
    </tr></thead><tbody>{rows.map((item) => <tr key={item.id} className="border-b align-top">
      {hasColumn("id") ? <td className="px-3 py-2 font-mono">{item.id}</td> : null}
      {hasColumn("wordSenseId") ? <td className="px-3 py-2 font-mono"><Link className="underline" href={`/words/tables/words?q=${item.wordSenseId}&searchField=id`}>{item.wordSenseId}</Link></td> : null}
      {hasColumn("english_word") ? <td className="px-3 py-2 text-sm font-semibold">{item.wordSense.english.base_form}</td> : null}
      {hasColumn("meaning_fa") ? <td className="max-w-48 px-3 py-2"><div dir="rtl" className="text-right">{item.wordSense.meaning?.canonical_text ?? "—"}</div></td> : null}
      {hasColumn("version") ? <td className="px-3 py-2 font-mono">{item.version}</td> : null}
      {hasColumn("status") ? <td className="px-3 py-2"><span className={item.isActive ? "rounded-full bg-emerald-100 px-2 py-1 text-emerald-800" : "rounded-full bg-slate-100 px-2 py-1 text-slate-700"}>{item.isActive ? "Active" : "History"}</span></td> : null}
      {hasColumn("selectedSymbols") ? <td className="max-w-48 px-3 py-2"><div className="flex flex-wrap gap-1">{symbolTokens(item.selectedSymbols).map((token, index) => <code key={`${token}-${index}`} className="rounded bg-black/5 px-1.5 py-0.5 dark:bg-white/10">{token}</code>)}</div></td> : null}
      {hasColumn("storyText") ? <td className="min-w-80 max-w-xl px-3 py-2"><div dir="rtl" className="text-right text-sm leading-7">{item.storyText}</div></td> : null}
      {hasColumn("sentence") ? <td className="min-w-72 max-w-md px-3 py-2"><div>{item.sentence?.sentence_en ?? "—"}</div>{item.sentence?.sentence_en_meaning_fa ? <div dir="rtl" className="mt-1 text-right text-muted">{item.sentence.sentence_en_meaning_fa}</div> : null}</td> : null}
      {hasColumn("audio") ? <td className="px-3 py-2"><StoryAudioControls id={item.id} filename={item.audio_file_name} /></td> : null}
      {hasColumn("audio_source_text") ? <td className="max-w-64 px-3 py-2"><div dir="rtl" className="line-clamp-3 text-right" title={item.audio_source_text ?? ""}>{item.audio_source_text ?? "—"}</div></td> : null}
      {hasColumn("promptVersion") ? <td className="px-3 py-2 font-mono">{item.promptVersion}</td> : null}{hasColumn("createdAt") ? <td className="whitespace-nowrap px-3 py-2 font-mono">{item.createdAt.toISOString()}</td> : null}{hasColumn("updatedAt") ? <td className="whitespace-nowrap px-3 py-2 font-mono">{item.updatedAt.toISOString()}</td> : null}
    </tr>)}{!rows.length ? <tr><td colSpan={columns.length} className="px-3 py-8 text-center text-sm opacity-70">No story rows.</td></tr> : null}</tbody></table></div>
  </main>;
}
