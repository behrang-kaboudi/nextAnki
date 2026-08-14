import Link from "next/link";

import { PageHeader } from "@/components/page-header";
import { prisma } from "@/lib/prisma";
import { flattenWordSenseEnglishRelation, WORD_SENSE_ENGLISH_FIELDS_SELECT } from "@/lib/english/wordSenseEnglishFields.server";
import { hydrateWordSensesWithPersianMeanings } from "@/lib/words/persianMeanings.server";

import DeleteWordSenseButton from "./DeleteWordSenseButton.client";
import OpenWordSenseEditorModal from "./OpenWordSenseEditorModal.client";

export const metadata = {
  title: "Words — Editor",
};

export const runtime = "nodejs";

function parsePositiveInt(value: string | null, fallback: number) {
  const n = value ? Number(value) : Number.NaN;
  if (!Number.isFinite(n)) return fallback;
  const i = Math.floor(n);
  return i > 0 ? i : fallback;
}

export default async function WordsEditorIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; pageSize?: string }>;
}) {
  const sp = await searchParams;
  const q = String(sp.q ?? "").trim();
  const page = parsePositiveInt(sp.page ?? null, 1);
  const pageSizeRaw = parsePositiveInt(sp.pageSize ?? null, 50);
  const pageSize = Math.min(Math.max(pageSizeRaw, 10), 200);
  const skip = (page - 1) * pageSize;

  const where = q
    ? {
        OR: [
          { english: { is: { base_form: { contains: q } } } },
          { meaning: { is: { canonical_text: { contains: q } } } },
          { anki_link_id: { contains: q } },
        ],
      }
    : undefined;

  const [total, rows] = await Promise.all([
    prisma.wordSense.count({ where }),
    prisma.wordSense.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      skip,
      take: pageSize,
      select: { id: true, anki_link_id: true, englishId: true, english: { select: WORD_SENSE_ENGLISH_FIELDS_SELECT }, meaningId: true, otherMeaningIds: true, updatedAt: true },
    }),
  ]);

  const rowsWithMeanings = await hydrateWordSensesWithPersianMeanings(rows.map(flattenWordSenseEnglishRelation));
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const prevPage = Math.max(1, page - 1);
  const nextPage = Math.min(totalPages, page + 1);

  const queryBase = new URLSearchParams();
  if (q) queryBase.set("q", q);
  queryBase.set("pageSize", String(pageSize));
  const prevHref = `/words/editor?${new URLSearchParams({ ...Object.fromEntries(queryBase), page: String(prevPage) }).toString()}`;
  const nextHref = `/words/editor?${new URLSearchParams({ ...Object.fromEntries(queryBase), page: String(nextPage) }).toString()}`;

  return (
    <main className="mx-auto w-full max-w-6xl p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <PageHeader
          title="WordSense Editor"
          subtitle="Search and open a WordSense row to edit fields. Audio controls are available on the detail page."
        />

        <form className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <input
            name="q"
            defaultValue={q}
            placeholder="Search base_form / meaning_fa / anki_link_id…"
            className="w-full rounded border px-3 py-2 text-sm sm:w-[26rem]"
          />
          <input type="hidden" name="pageSize" value={String(pageSize)} />
          <button type="submit" className="rounded border px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/5">
            Search
          </button>
          {q ? (
            <Link
              href="/words/editor"
              className="rounded border px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/5"
            >
              Clear
            </Link>
          ) : null}
        </form>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 text-sm">
        <div className="opacity-80">
          Total: <span className="font-semibold">{total}</span> • Page{" "}
          <span className="font-semibold">
            {page}/{totalPages}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={prevHref}
            aria-disabled={page <= 1}
            className="rounded border px-3 py-2 text-sm hover:bg-black/5 aria-disabled:pointer-events-none aria-disabled:opacity-50 dark:hover:bg-white/5"
          >
            Prev
          </Link>
          <Link
            href={nextHref}
            aria-disabled={page >= totalPages}
            className="rounded border px-3 py-2 text-sm hover:bg-black/5 aria-disabled:pointer-events-none aria-disabled:opacity-50 dark:hover:bg-white/5"
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
                <th className="whitespace-nowrap px-3 py-2 font-semibold">id</th>
                <th className="whitespace-nowrap px-3 py-2 font-semibold">base_form</th>
                <th className="whitespace-nowrap px-3 py-2 font-semibold">meaning_fa</th>
                <th className="whitespace-nowrap px-3 py-2 font-semibold">anki_link_id</th>
                <th className="whitespace-nowrap px-3 py-2 font-semibold">updatedAt</th>
                <th className="whitespace-nowrap px-3 py-2 font-semibold">actions</th>
              </tr>
            </thead>
            <tbody>
              {rowsWithMeanings.map((r) => (
                <tr key={r.id} className="border-b">
                  <td className="whitespace-nowrap px-3 py-2 font-mono">{r.id}</td>
                  <td className="max-w-[240px] px-3 py-2">
                    <span className="block truncate" title={r.base_form}>
                      {r.base_form}
                    </span>
                  </td>
                  <td className="max-w-[320px] px-3 py-2">
                    <span className="block truncate" title={r.meaning_fa}>
                      {r.meaning_fa}
                    </span>
                  </td>
                  <td className="max-w-[240px] px-3 py-2 font-mono">
                    <span className="block truncate" title={r.anki_link_id}>
                      {r.anki_link_id}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 font-mono">{r.updatedAt.toISOString()}</td>
                  <td className="whitespace-nowrap px-3 py-2">
                    <div className="flex items-center gap-2">
                      <OpenWordSenseEditorModal id={r.id} label={r.base_form} />
                      <DeleteWordSenseButton id={r.id} label={r.base_form} />
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-sm opacity-70">
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
