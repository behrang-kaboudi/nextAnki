import Link from "next/link";
import type { Prisma } from "@prisma/client";

import { PageHeader } from "@/components/page-header";
import { getPersianWordAudioPublicPath } from "@/lib/audio/persianWordAudioNaming";
import { prisma } from "@/lib/prisma";

import OpenPersianWordEditorModal from "./OpenPersianWordEditorModal.client";

export const metadata = { title: "Words — PersianWord Table" };
export const runtime = "nodejs";

function parsePositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

const SORT_FIELDS = ["id", "canonical_text", "normalized_text", "meaning_fa_IPA", "audio_file_name", "updatedAt"] as const;
type SortField = (typeof SORT_FIELDS)[number];

function parseSortField(value: string | undefined): SortField {
  return SORT_FIELDS.includes(value as SortField) ? (value as SortField) : "updatedAt";
}

function parseSortDirection(value: string | undefined) {
  return value === "asc" ? "asc" : "desc";
}

function SortHeader({ href, label, active, direction }: { href: string; label: string; active: boolean; direction: "asc" | "desc" }) {
  return (
    <th className="whitespace-nowrap px-3 py-2">
      <Link href={href} className="inline-flex items-center gap-1 hover:underline">
        {label} <span className={active ? "opacity-100" : "opacity-40"}>{active && direction === "asc" ? "↑" : "↓"}</span>
      </Link>
    </th>
  );
}

export default async function PersianWordsTablePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; pageSize?: string; sort?: string; dir?: string }>;
}) {
  const params = await searchParams;
  const q = String(params.q ?? "").trim();
  const page = parsePositiveInt(params.page, 1);
  const showAll = params.pageSize === "all";
  const pageSize = Math.min(Math.max(parsePositiveInt(params.pageSize, 100), 10), 1000);
  const sort = parseSortField(params.sort);
  const dir = parseSortDirection(params.dir);
  const primaryOrderBy: Record<SortField, Prisma.PersianWordOrderByWithRelationInput> = {
    id: { id: dir },
    canonical_text: { canonical_text: dir },
    normalized_text: { normalized_text: dir },
    meaning_fa_IPA: { meaning_fa_IPA: dir },
    audio_file_name: { audio_file_name: dir },
    updatedAt: { updatedAt: dir },
  };
  const where = q
    ? {
        OR: [
          { canonical_text: { contains: q } },
          { normalized_text: { contains: q } },
          { meaning_fa_IPA: { contains: q } },
        ],
      }
    : undefined;
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
        meaning_fa_IPA: true,
        audio_file_name: true,
        updatedAt: true,
      },
    }),
  ]);
  const totalPages = showAll ? 1 : Math.max(1, Math.ceil(total / pageSize));
  const pageHref = (nextPage: number) => {
    const query = new URLSearchParams({ page: String(nextPage), pageSize: showAll ? "all" : String(pageSize), sort, dir });
    if (q) query.set("q", q);
    return `/words/tables/persian-words?${query.toString()}`;
  };
  const sortHref = (field: SortField) => {
    const nextDir = field === sort && dir === "asc" ? "desc" : "asc";
    const query = new URLSearchParams({ page: "1", pageSize: showAll ? "all" : String(pageSize), sort: field, dir: nextDir });
    if (q) query.set("q", q);
    return `/words/tables/persian-words?${query.toString()}`;
  };

  return (
    <main className="mx-auto w-full max-w-7xl p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <PageHeader
          title="PersianWord Table"
          subtitle="Browse Persian word records, play linked audio, and open any row for editing."
        />
        <form className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
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
          <button type="submit" className="rounded border px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/5">
            Search
          </button>
          {q ? <Link href="/words/tables/persian-words" className="rounded border px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/5">Clear</Link> : null}
        </form>
      </div>

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
              <SortHeader href={sortHref("id")} label="id" active={sort === "id"} direction={dir} /><SortHeader href={sortHref("canonical_text")} label="canonical_text" active={sort === "canonical_text"} direction={dir} /><SortHeader href={sortHref("normalized_text")} label="normalized_text" active={sort === "normalized_text"} direction={dir} /><SortHeader href={sortHref("meaning_fa_IPA")} label="meaning_fa_IPA" active={sort === "meaning_fa_IPA"} direction={dir} /><SortHeader href={sortHref("audio_file_name")} label="audio" active={sort === "audio_file_name"} direction={dir} /><SortHeader href={sortHref("updatedAt")} label="updatedAt" active={sort === "updatedAt"} direction={dir} /><th className="px-3 py-2">actions</th>
            </tr></thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b align-middle">
                  <td className="whitespace-nowrap px-3 py-2 font-mono">{row.id}</td>
                  <td className="max-w-52 px-3 py-2 text-base" dir="rtl"><span className="block truncate" title={row.canonical_text}>{row.canonical_text}</span></td>
                  <td className="max-w-52 px-3 py-2" dir="rtl"><span className="block truncate" title={row.normalized_text}>{row.normalized_text}</span></td>
                  <td className="max-w-52 px-3 py-2"><span className="block truncate" title={row.meaning_fa_IPA ?? ""}>{row.meaning_fa_IPA ?? "—"}</span></td>
                  <td className="px-3 py-2">{row.audio_file_name ? <audio controls preload="none" src={getPersianWordAudioPublicPath(row.audio_file_name)} className="h-7 w-48" /> : <span className="opacity-60">—</span>}</td>
                  <td className="whitespace-nowrap px-3 py-2 font-mono">{row.updatedAt.toISOString()}</td>
                  <td className="px-3 py-2"><OpenPersianWordEditorModal id={row.id} label={row.canonical_text} /></td>
                </tr>
              ))}
              {!rows.length ? <tr><td colSpan={7} className="px-3 py-6 text-center text-sm opacity-70">No rows.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
