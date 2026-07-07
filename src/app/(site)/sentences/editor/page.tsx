import Link from "next/link";

import { PageHeader } from "@/components/page-header";
import { prisma } from "@/lib/prisma";

import SentenceEditorModal, { type SentenceEditorItem } from "./SentenceEditorModal.client";

export const metadata = {
  title: "Sentences - Editor",
};

export const runtime = "nodejs";

function parsePositiveInt(value: string | null, fallback: number) {
  const n = value ? Number(value) : Number.NaN;
  if (!Number.isFinite(n)) return fallback;
  const i = Math.floor(n);
  return i > 0 ? i : fallback;
}

export default async function SentencesEditorPage({
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
          { sentence_en: { contains: q } },
          { sentence_en_meaning_fa: { contains: q } },
          {
            wordLinks: {
              some: {
                word: {
                  OR: [
                    { base_form: { contains: q } },
                    { meaning_fa: { contains: q } },
                    { anki_link_id: { contains: q } },
                  ],
                },
              },
            },
          },
        ],
      }
    : undefined;

  const [total, rows] = await Promise.all([
    prisma.sentence.count({ where }),
    prisma.sentence.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      skip,
      take: pageSize,
      include: {
        wordLinks: {
          orderBy: [{ isPrimary: "desc" }, { wordId: "asc" }],
          include: {
            word: {
              select: {
                id: true,
                anki_link_id: true,
                base_form: true,
                meaning_fa: true,
              },
            },
          },
        },
      },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const prevPage = Math.max(1, page - 1);
  const nextPage = Math.min(totalPages, page + 1);

  const queryBase = new URLSearchParams();
  if (q) queryBase.set("q", q);
  queryBase.set("pageSize", String(pageSize));
  const prevHref = `/sentences/editor?${new URLSearchParams({ ...Object.fromEntries(queryBase), page: String(prevPage) }).toString()}`;
  const nextHref = `/sentences/editor?${new URLSearchParams({ ...Object.fromEntries(queryBase), page: String(nextPage) }).toString()}`;

  const items: SentenceEditorItem[] = rows.map((row) => ({
    id: row.id,
    sentence_en: row.sentence_en,
    sentence_en_meaning_fa: row.sentence_en_meaning_fa,
    words: row.wordLinks.map((link) => ({
      id: link.word.id,
      anki_link_id: link.word.anki_link_id,
      base_form: link.word.base_form,
      meaning_fa: link.word.meaning_fa,
      isPrimary: link.isPrimary,
    })),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }));

  return (
    <main className="mx-auto w-full max-w-6xl p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <PageHeader
          title="Sentence Editor"
          subtitle="Search and open a sentence to edit text, meaning, and audio."
        />

        <form className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <input
            name="q"
            defaultValue={q}
            placeholder="Search sentence / meaning / word / anki_link_id..."
            className="w-full rounded border px-3 py-2 text-sm sm:w-[28rem]"
          />
          <input type="hidden" name="pageSize" value={String(pageSize)} />
          <button type="submit" className="rounded border px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/5">
            Search
          </button>
          {q ? (
            <Link
              href="/sentences/editor"
              className="rounded border px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/5"
            >
              Clear
            </Link>
          ) : null}
        </form>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 text-sm">
        <div className="opacity-80">
          Total: <span className="font-semibold">{total}</span> - Page{" "}
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
                <th className="whitespace-nowrap px-3 py-2 font-semibold">sentence_en</th>
                <th className="whitespace-nowrap px-3 py-2 font-semibold">sentence_en_meaning_fa</th>
                <th className="whitespace-nowrap px-3 py-2 font-semibold">linked words</th>
                <th className="whitespace-nowrap px-3 py-2 font-semibold">updatedAt</th>
                <th className="whitespace-nowrap px-3 py-2 font-semibold">actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b">
                  <td className="whitespace-nowrap px-3 py-2 font-mono">{item.id}</td>
                  <td className="max-w-[320px] px-3 py-2">
                    <span className="block truncate" title={item.sentence_en}>
                      {item.sentence_en}
                    </span>
                  </td>
                  <td className="max-w-[320px] px-3 py-2">
                    <span className="block truncate" title={item.sentence_en_meaning_fa ?? ""}>
                      {item.sentence_en_meaning_fa ?? "-"}
                    </span>
                  </td>
                  <td className="max-w-[280px] px-3 py-2">
                    <span
                      className="block truncate"
                      title={item.words.map((word) => `${word.base_form} (${word.meaning_fa})`).join(" / ")}
                    >
                      {item.words.length
                        ? item.words.map((word) => word.base_form).join(", ")
                        : "-"}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 font-mono">{item.updatedAt}</td>
                  <td className="whitespace-nowrap px-3 py-2">
                    <SentenceEditorModal item={item} />
                  </td>
                </tr>
              ))}
              {items.length === 0 ? (
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
