import Link from "next/link";

import { prisma } from "@/lib/prisma";
import VoiceCell from "./VoiceCell.client";
import HintExportModal from "./HintExportModal.client";
import BatchVoiceGenerate from "./BatchVoiceGenerate.client";

export const metadata = {
  title: "Words",
};

export const runtime = "nodejs";

function parsePositiveInt(value: string | null, fallback: number) {
  const n = value ? Number(value) : Number.NaN;
  if (!Number.isFinite(n)) return fallback;
  const i = Math.floor(n);
  return i > 0 ? i : fallback;
}

export default async function WordsPage({
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
          { base_form: { contains: q } },
          { meaning_fa: { contains: q } },
          { anki_link_id: { contains: q } },
        ],
      }
    : undefined;

  const [total, rows] = await Promise.all([
    prisma.word.count({ where }),
    prisma.word.findMany({
      where,
      orderBy: [{ id: "desc" }],
      skip,
      take: pageSize,
      select: {
        id: true,
        anki_link_id: true,
        base_form: true,
        meaning_fa: true,
        hint_sentence: true,
      },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const prevPage = Math.max(1, page - 1);
  const nextPage = Math.min(totalPages, page + 1);

  const queryBase = new URLSearchParams();
  if (q) queryBase.set("q", q);
  queryBase.set("pageSize", String(pageSize));

  const prevHref = `/words?${new URLSearchParams({ ...Object.fromEntries(queryBase), page: String(prevPage) }).toString()}`;
  const nextHref = `/words?${new URLSearchParams({ ...Object.fromEntries(queryBase), page: String(nextPage) }).toString()}`;

  return (
    <main className="mx-auto w-full max-w-6xl p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Words</h1>
          <p className="mt-1 text-sm opacity-80">
            DB table: <span className="font-mono">Word</span>
          </p>
        </div>

        <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
          <HintExportModal q={q} />
          <BatchVoiceGenerate rows={rows.map((r) => ({ id: r.id, text: r.hint_sentence }))} />
        </div>

        <form className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <input
            name="q"
            defaultValue={q}
            placeholder="Search base_form / meaning_fa / anki_link_id…"
            className="w-full rounded border px-3 py-2 text-sm sm:w-[26rem]"
          />
          <input type="hidden" name="pageSize" value={String(pageSize)} />
          <button
            type="submit"
            className="rounded border px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/5"
          >
            Search
          </button>
          {q ? (
            <Link
              href={`/words?pageSize=${pageSize}`}
              className="rounded border px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/5"
            >
              Clear
            </Link>
          ) : null}
        </form>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm opacity-80">
        <div>
          Total: {total} • Page {page}/{totalPages} • PageSize {pageSize}
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={prevHref}
            aria-disabled={page <= 1}
            className="rounded border px-3 py-1.5 text-sm hover:bg-black/5 aria-disabled:pointer-events-none aria-disabled:opacity-50 dark:hover:bg-white/5"
          >
            Prev
          </Link>
          <Link
            href={nextHref}
            aria-disabled={page >= totalPages}
            className="rounded border px-3 py-1.5 text-sm hover:bg-black/5 aria-disabled:pointer-events-none aria-disabled:opacity-50 dark:hover:bg-white/5"
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
                <th className="whitespace-nowrap px-3 py-2 font-semibold">hint_sentence</th>
                <th className="whitespace-nowrap px-3 py-2 font-semibold">voice</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b">
                  <td className="whitespace-nowrap px-3 py-2 font-mono">{r.id}</td>
                  <td className="whitespace-nowrap px-3 py-2">{r.base_form}</td>
                  <td className="max-w-[520px] truncate px-3 py-2" title={r.meaning_fa}>
                    {r.meaning_fa}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">{r.hint_sentence ?? "—"}</td>
                  <td className="whitespace-nowrap px-3 py-2">
                    <VoiceCell
                      wordId={r.id}
                      text={r.hint_sentence}
                    />
                  </td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-sm opacity-70">
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
