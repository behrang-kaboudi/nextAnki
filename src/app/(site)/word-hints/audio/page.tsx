import Link from "next/link";

import { prisma } from "@/lib/prisma";
import BatchWordFieldVoiceGenerate from "../BatchWordFieldVoiceGenerate.client";
import BatchWordFieldVoiceGenerateAllFields from "../BatchWordFieldVoiceGenerateAllFields.client";
import AudioHelpModal from "../AudioHelpModal.client";
import WordFieldVoiceDuplicatesModal from "../WordFieldVoiceDuplicatesModal.client";
import WordFieldVoiceCell from "../WordFieldVoiceCell.client";

export const metadata = {
  title: "Word Hints — Audio",
};

export const runtime = "nodejs";

function parsePositiveInt(value: string | null, fallback: number) {
  const n = value ? Number(value) : Number.NaN;
  if (!Number.isFinite(n)) return fallback;
  const i = Math.floor(n);
  return i > 0 ? i : fallback;
}

export default async function WordHintsAudioPage({
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
        other_meanings_fa: true,
        concept_explained_fa: true,
        sentenceRecord: {
          select: {
            sentence_en: true,
            sentence_en_meaning_fa: true,
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

  const prevHref = `/word-hints/audio?${new URLSearchParams({ ...Object.fromEntries(queryBase), page: String(prevPage) }).toString()}`;
  const nextHref = `/word-hints/audio?${new URLSearchParams({ ...Object.fromEntries(queryBase), page: String(nextPage) }).toString()}`;

  return (
    <main className="mx-auto w-full max-w-6xl p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold">Audio</h1>
            <WordFieldVoiceDuplicatesModal />
            <span aria-hidden="true" className="mx-1 h-6 w-px bg-black/20 dark:bg-white/20" />
            <BatchWordFieldVoiceGenerateAllFields />
            <AudioHelpModal />
          </div>
          <p className="mt-1 text-sm opacity-80">
            UI for generating audio for <span className="font-mono">base_form</span>,{" "}
            <span className="font-mono">meaning_fa</span>,{" "}
            <span className="font-mono">other_meanings_fa</span>,{" "}
            <span className="font-mono">concept_explained_fa</span>,{" "}
            <span className="font-mono">sentence_en</span>,{" "}
            <span className="font-mono">sentence_en_meaning_fa</span>.
          </p>
        </div>

        <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
          <div className="grid w-full gap-2 sm:w-auto sm:grid-cols-2">
            <BatchWordFieldVoiceGenerate
              field="base_form"
            />
            <BatchWordFieldVoiceGenerate
              field="meaning_fa"
            />
            <BatchWordFieldVoiceGenerate
              field="other_meanings_fa"
            />
            <BatchWordFieldVoiceGenerate
              field="concept_explained_fa"
            />
            <BatchWordFieldVoiceGenerate
              field="sentence_en"
            />
            <BatchWordFieldVoiceGenerate
              field="sentence_en_meaning_fa"
            />
          </div>
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
              href={`/word-hints/audio?pageSize=${pageSize}`}
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
                <th className="whitespace-nowrap px-3 py-2 font-semibold">other_meanings_fa</th>
                <th className="whitespace-nowrap px-3 py-2 font-semibold">concept_explained_fa</th>
                <th className="whitespace-nowrap px-3 py-2 font-semibold">sentence_en</th>
                <th className="whitespace-nowrap px-3 py-2 font-semibold">sentence_en_meaning_fa</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b">
                  <td className="whitespace-nowrap px-3 py-2 font-mono">{r.id}</td>
                  <td className="max-w-[280px] px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate" title={r.base_form}>
                        {r.base_form}
                      </span>
                      <WordFieldVoiceCell
                        field="base_form"
                        ankiLinkId={r.anki_link_id}
                        text={r.base_form}
                      />
                    </div>
                  </td>
                  <td className="max-w-[360px] px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate" title={r.meaning_fa}>
                        {r.meaning_fa}
                      </span>
                      <WordFieldVoiceCell
                        field="meaning_fa"
                        ankiLinkId={r.anki_link_id}
                        text={r.meaning_fa}
                      />
                    </div>
                  </td>
                  <td className="max-w-[360px] px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate" title={String(r.other_meanings_fa ?? "")}>
                        {r.other_meanings_fa ?? "—"}
                      </span>
                      <WordFieldVoiceCell
                        field="other_meanings_fa"
                        ankiLinkId={r.anki_link_id}
                        text={r.other_meanings_fa}
                      />
                    </div>
                  </td>
                  <td className="max-w-[360px] px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate" title={String(r.concept_explained_fa ?? "")}>
                        {r.concept_explained_fa ?? "—"}
                      </span>
                      <WordFieldVoiceCell
                        field="concept_explained_fa"
                        ankiLinkId={r.anki_link_id}
                        text={r.concept_explained_fa}
                      />
                    </div>
                  </td>
                  <td className="max-w-[360px] px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate" title={r.sentenceRecord?.sentence_en ?? ""}>
                        {r.sentenceRecord?.sentence_en ?? "—"}
                      </span>
                      <WordFieldVoiceCell
                        field="sentence_en"
                        ankiLinkId={r.anki_link_id}
                        text={r.sentenceRecord?.sentence_en ?? null}
                      />
                    </div>
                  </td>
                  <td className="max-w-[360px] px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className="truncate"
                        title={String(r.sentenceRecord?.sentence_en_meaning_fa ?? "")}
                      >
                        {r.sentenceRecord?.sentence_en_meaning_fa ?? "—"}
                      </span>
                      <WordFieldVoiceCell
                        field="sentence_en_meaning_fa"
                        ankiLinkId={r.anki_link_id}
                        text={r.sentenceRecord?.sentence_en_meaning_fa ?? null}
                      />
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-sm opacity-70">
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
