import Link from "next/link";

import { prisma } from "@/lib/prisma";
import HintExportModal from "../HintExportModal.client";
import JsonHintGenerateAllButton from "../JsonHintGenerateAllButton.client";
import JsonHintHelpModal from "../JsonHintHelpModal.client";
import WordHintsTable from "../WordHintsTable.client";
import { getJsonHintGeneratedAtMs } from "@/lib/words/jsonHint";
import { hydrateWordsWithPersianMeanings } from "@/lib/words/persianMeanings.server";

export const metadata = {
  title: "Word Hints — JSON",
};

export const runtime = "nodejs";

function parsePositiveInt(value: string | null, fallback: number) {
  const n = value ? Number(value) : Number.NaN;
  if (!Number.isFinite(n)) return fallback;
  const i = Math.floor(n);
  return i > 0 ? i : fallback;
}

export default async function WordHintsJsonPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; pageSize?: string; noEn?: string }>;
}) {
  const sp = await searchParams;
  const q = String(sp.q ?? "").trim();
  const noEnOnly = String(sp.noEn ?? "") === "1";
  const page = parsePositiveInt(sp.page ?? null, 1);
  const pageSizeRaw = parsePositiveInt(sp.pageSize ?? null, 50);
  const pageSize = Math.min(Math.max(pageSizeRaw, 10), 200);
  const skip = (page - 1) * pageSize;

  const qWhere = q
    ? {
        OR: [
          { base_form: { contains: q } },
          { meaning: { is: { canonical_text: { contains: q } } } },
          { anki_link_id: { contains: q } },
        ],
      }
    : undefined;

  const noEnWhere = noEnOnly
    ? {
        OR: [
          { json_hint: { contains: `"en": "noEn"` } },
          { json_hint: { contains: `"en":"noEn"` } },
        ],
      }
    : undefined;

  const where = qWhere && noEnWhere ? { AND: [qWhere, noEnWhere] } : (qWhere ?? noEnWhere);

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
        meaningId: true,
        otherMeaningIds: true,
        hint_sentence: true,
        json_hint: true,
      },
    }),
  ]);

  const rowsWithMeta = (await hydrateWordsWithPersianMeanings(rows)).map((r) => ({
    ...r,
    json_hint_generated_at_ms: getJsonHintGeneratedAtMs(r.json_hint ?? null),
  }));

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const prevPage = Math.max(1, page - 1);
  const nextPage = Math.min(totalPages, page + 1);

  const queryBase = new URLSearchParams();
  if (q) queryBase.set("q", q);
  if (noEnOnly) queryBase.set("noEn", "1");
  queryBase.set("pageSize", String(pageSize));

  const prevHref = `/words/hints/json?${new URLSearchParams({ ...Object.fromEntries(queryBase), page: String(prevPage) }).toString()}`;
  const nextHref = `/words/hints/json?${new URLSearchParams({ ...Object.fromEntries(queryBase), page: String(nextPage) }).toString()}`;

  return (
    <main className="mx-auto w-full max-w-6xl p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">json_hint</h1>
          <p className="mt-1 text-sm opacity-80">
            Preview and compare computed <span className="font-mono">json_hint</span>.
          </p>
        </div>

        <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
          <HintExportModal q={q} />
          <JsonHintGenerateAllButton q={q} />
          <JsonHintHelpModal />
        </div>

        <form className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <input
            name="q"
            defaultValue={q}
            placeholder="Search base_form / meaning_fa / anki_link_id…"
            className="w-full rounded border px-3 py-2 text-sm sm:w-[26rem]"
          />
          <label className="flex items-center gap-2 rounded border px-3 py-2 text-sm">
            <input name="noEn" type="checkbox" value="1" defaultChecked={noEnOnly} />
            <span className="whitespace-nowrap font-mono">"en":"noEn"</span>
          </label>
          <input type="hidden" name="pageSize" value={String(pageSize)} />
          <button
            type="submit"
            className="rounded border px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/5"
          >
            Search
          </button>
          {q ? (
            <Link
              href={`/words/hints/json?${new URLSearchParams({ pageSize: String(pageSize), ...(noEnOnly ? { noEn: "1" } : {}) }).toString()}`}
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

      <WordHintsTable rows={rowsWithMeta} />
    </main>
  );
}
