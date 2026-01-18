"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type FaEn = { fa?: string; en?: string };
type MatchSymbols = {
  person?: FaEn;
  job?: FaEn;
  adj?: FaEn;
  persian?: FaEn;
  persianImage?: FaEn | null;
};

type WordRow = {
  id: number;
  base_form: string;
  phonetic_us_normalized: string | null;
  meaning_fa: string;
  meaning_fa_IPA_normalized: string;
  match?: MatchSymbols | null;
};

function formatMatch(match: MatchSymbols | null | undefined): string {
  if (!match) return "";
  const parts: string[] = [];
  if (match.person?.fa || match.person?.en)
    parts.push(`person: ${match.person?.fa ?? ""} / ${match.person?.en ?? ""}`.trim());
  if (match.job?.fa || match.job?.en)
    parts.push(`job: ${match.job?.fa ?? ""} / ${match.job?.en ?? ""}`.trim());
  if (match.adj?.fa || match.adj?.en)
    parts.push(`adj: ${match.adj?.fa ?? ""} / ${match.adj?.en ?? ""}`.trim());
  if (match.persian?.fa || match.persian?.en)
    parts.push(`persian: ${match.persian?.fa ?? ""} / ${match.persian?.en ?? ""}`.trim());
  return parts.join(" | ");
}

export function WordListClient() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [only2CharPhonetic, setOnly2CharPhonetic] = useState(false);
  const [only3CharPhonetic, setOnly3CharPhonetic] = useState(false);
  const [only4CharPhonetic, setOnly4CharPhonetic] = useState(false);
  const [only5CharPhonetic, setOnly5CharPhonetic] = useState(false);
  const [onlyOver6CharPhonetic, setOnlyOver6CharPhonetic] = useState(false);
  const [onlySpaced, setOnlySpaced] = useState(false);
  const [onlyEmptyMatch, setOnlyEmptyMatch] = useState(false);
  const [sortBy, setSortBy] = useState<
    "base_form" | "phonetic_us_normalized" | "meaning_fa"
  >("base_form");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<
    null | {
      total: number;
      rows: WordRow[];
      matchStats?: null | {
        matched: number;
        empty: number;
        total: number;
        noJob: number;
        jobEnIsJob: number;
      };
    }
  >(null);

  const totalPages = useMemo(() => {
    const total = data?.total ?? 0;
    return Math.max(1, Math.ceil(total / pageSize));
  }, [data?.total, pageSize]);

  const clampedPage = Math.min(Math.max(page, 1), totalPages);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/ipa/phrase-building/words?page=${clampedPage}&pageSize=${pageSize}&includeMatch=1&includeMatchStats=1&sortBy=${sortBy}&sortDir=${sortDir}${
          only2CharPhonetic
            ? "&phoneticLen=2"
            : only3CharPhonetic
              ? "&phoneticLen=3"
              : only4CharPhonetic
                ? "&phoneticLen=4&includeSpacedFiveForFour=1"
                : only5CharPhonetic
                  ? "&phoneticLen=5&includeSpacedSixForFive=1"
                  : onlyOver6CharPhonetic
                    ? "&phoneticLenGt=6"
                  : ""
        }${onlySpaced ? "&onlySpaced=1" : ""}${onlyEmptyMatch ? "&onlyEmptyMatch=1" : ""}`,
        { cache: "no-store" }
      );
      const json = (await res.json()) as {
        total: number;
        rows: WordRow[];
        matchStats?:
          | null
          | {
              matched: number;
              empty: number;
              total: number;
              noJob: number;
              jobEnIsJob: number;
            };
        error?: string;
      };
      if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
      setData({
        total: json.total ?? 0,
        rows: json.rows ?? [],
        matchStats: json.matchStats ?? null,
      });
    } catch (e) {
      setData(null);
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [
    clampedPage,
    only2CharPhonetic,
    only3CharPhonetic,
    only4CharPhonetic,
    only5CharPhonetic,
    onlyOver6CharPhonetic,
    onlySpaced,
    onlyEmptyMatch,
    pageSize,
    sortBy,
    sortDir,
  ]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (page !== clampedPage) setPage(clampedPage);
  }, [clampedPage, page]);

  return (
    <div className="grid gap-3 rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="grid gap-1">
          <h2 className="text-sm font-medium text-muted">Word (paginated)</h2>
          <div className="text-xs text-muted tabular-nums">
            total: {data?.total ?? "—"} • page: {clampedPage}/{totalPages} •
            pageSize: {pageSize} • match:{" "}
            {data?.matchStats
              ? `${data.matchStats.matched} filled / ${data.matchStats.empty} empty (total)`
              : "—"}
          </div>
          {data?.matchStats ? (
            <div className="text-xs text-muted tabular-nums">
              no job: {data.matchStats.noJob} • job.en=&quot;job&quot;:{" "}
              {data.matchStats.jobEnIsJob}
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex items-center gap-2 rounded-md border border-border/60 bg-background px-3 py-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={only2CharPhonetic}
              onChange={(e) => {
                setPage(1);
                if (e.target.checked) {
                  setOnly3CharPhonetic(false);
                  setOnly4CharPhonetic(false);
                  setOnly5CharPhonetic(false);
                  setOnlyOver6CharPhonetic(false);
                }
                setOnly2CharPhonetic(e.target.checked);
              }}
            />
            <span>Only 2</span>
          </label>
          <label className="inline-flex items-center gap-2 rounded-md border border-border/60 bg-background px-3 py-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={only3CharPhonetic}
              onChange={(e) => {
                setPage(1);
                if (e.target.checked) {
                  setOnly2CharPhonetic(false);
                  setOnly4CharPhonetic(false);
                  setOnly5CharPhonetic(false);
                  setOnlyOver6CharPhonetic(false);
                }
                setOnly3CharPhonetic(e.target.checked);
              }}
            />
            <span>Only 3</span>
          </label>
          <label className="inline-flex items-center gap-2 rounded-md border border-border/60 bg-background px-3 py-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={only4CharPhonetic}
              onChange={(e) => {
                setPage(1);
                if (e.target.checked) {
                  setOnly2CharPhonetic(false);
                  setOnly3CharPhonetic(false);
                  setOnly5CharPhonetic(false);
                  setOnlyOver6CharPhonetic(false);
                }
                setOnly4CharPhonetic(e.target.checked);
              }}
            />
            <span>Only 4</span>
          </label>
          <label className="inline-flex items-center gap-2 rounded-md border border-border/60 bg-background px-3 py-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={only5CharPhonetic}
              onChange={(e) => {
                setPage(1);
                if (e.target.checked) {
                  setOnly2CharPhonetic(false);
                  setOnly3CharPhonetic(false);
                  setOnly4CharPhonetic(false);
                  setOnlyOver6CharPhonetic(false);
                }
                setOnly5CharPhonetic(e.target.checked);
              }}
            />
            <span>Only 5</span>
          </label>
          <label className="inline-flex items-center gap-2 rounded-md border border-border/60 bg-background px-3 py-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={onlyOver6CharPhonetic}
              onChange={(e) => {
                setPage(1);
                if (e.target.checked) {
                  setOnly2CharPhonetic(false);
                  setOnly3CharPhonetic(false);
                  setOnly4CharPhonetic(false);
                  setOnly5CharPhonetic(false);
                }
                setOnlyOver6CharPhonetic(e.target.checked);
              }}
            />
            <span>6+</span>
          </label>
          <label className="inline-flex items-center gap-2 rounded-md border border-border/60 bg-background px-3 py-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={onlySpaced}
              onChange={(e) => {
                setPage(1);
                setOnlySpaced(e.target.checked);
              }}
            />
            <span>Spaced</span>
          </label>
          <label className="inline-flex items-center gap-2 rounded-md border border-border/60 bg-background px-3 py-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={onlyEmptyMatch}
              onChange={(e) => {
                setPage(1);
                setOnlyEmptyMatch(e.target.checked);
              }}
            />
            <span>Empty match</span>
          </label>
          <button
            type="button"
            onClick={() => setPage(1)}
            disabled={loading || clampedPage <= 1}
            className="rounded-md border border-border/60 bg-background px-3 py-2 text-sm text-foreground disabled:opacity-60"
          >
            First
          </button>
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={loading || clampedPage <= 1}
            className="rounded-md border border-border/60 bg-background px-3 py-2 text-sm text-foreground disabled:opacity-60"
          >
            Prev
          </button>
          <button
            type="button"
            onClick={() => setPage((p) => p + 1)}
            disabled={loading || clampedPage >= totalPages}
            className="rounded-md border border-border/60 bg-background px-3 py-2 text-sm text-foreground disabled:opacity-60"
          >
            Next
          </button>
          <button
            type="button"
            onClick={() => setPage(totalPages)}
            disabled={loading || clampedPage >= totalPages}
            className="rounded-md border border-border/60 bg-background px-3 py-2 text-sm text-foreground disabled:opacity-60"
          >
            Last
          </button>

          <select
            value={String(pageSize)}
            onChange={(e) => {
              setPage(1);
              setPageSize(Number(e.target.value));
            }}
            disabled={loading}
            className="h-10 rounded-md border border-border/60 bg-background px-3 text-sm text-foreground disabled:opacity-60"
            aria-label="Page size"
          >
            {[25, 50, 100, 200].map((n) => (
              <option key={n} value={n}>
                {n}/page
              </option>
            ))}
          </select>
        </div>
      </div>

      {error ? (
        <div className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-foreground">
          {error}
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-md border border-border/60 bg-background">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="text-left text-xs text-muted">
              <th className="border-b border-border/60 px-3 py-2">
                <button
                  type="button"
                  onClick={() => {
                    setPage(1);
                    setSortBy("base_form");
                    setSortDir((d) =>
                      sortBy === "base_form" ? (d === "asc" ? "desc" : "asc") : "asc"
                    );
                  }}
                  className="inline-flex items-center gap-1 hover:underline"
                  aria-label="Sort by base_form"
                >
                  <span>base_form</span>
                  {sortBy === "base_form" ? (
                    <span className="text-[10px]">{sortDir === "asc" ? "▲" : "▼"}</span>
                  ) : null}
                </button>
              </th>
              <th className="border-b border-border/60 px-3 py-2">
                <button
                  type="button"
                  onClick={() => {
                    setPage(1);
                    setSortBy("phonetic_us_normalized");
                    setSortDir((d) =>
                      sortBy === "phonetic_us_normalized"
                        ? d === "asc"
                          ? "desc"
                          : "asc"
                        : "asc"
                    );
                  }}
                  className="inline-flex items-center gap-1 hover:underline"
                  aria-label="Sort by phonetic_us_normalized"
                >
                  <span>phonetic_us_normalized</span>
                  {sortBy === "phonetic_us_normalized" ? (
                    <span className="text-[10px]">{sortDir === "asc" ? "▲" : "▼"}</span>
                  ) : null}
                </button>
              </th>
              <th className="border-b border-border/60 px-3 py-2">
                <button
                  type="button"
                  onClick={() => {
                    setPage(1);
                    setSortBy("meaning_fa");
                    setSortDir((d) =>
                      sortBy === "meaning_fa" ? (d === "asc" ? "desc" : "asc") : "asc"
                    );
                  }}
                  className="inline-flex items-center gap-1 hover:underline"
                  aria-label="Sort by meaning_fa"
                >
                  <span>meaning_fa</span>
                  {sortBy === "meaning_fa" ? (
                    <span className="text-[10px]">{sortDir === "asc" ? "▲" : "▼"}</span>
                  ) : null}
                </button>
              </th>
              <th className="border-b border-border/60 px-3 py-2">
                match
              </th>
              <th className="border-b border-border/60 px-3 py-2">
                meaning_fa_IPA_normalized
              </th>
            </tr>
          </thead>
          <tbody>
            {data?.rows?.length ? (
              data.rows.map((row) => (
                <tr key={row.id} className="align-top">
                  <td className="border-b border-border/30 px-3 py-2 font-medium text-foreground">
                    {row.base_form}
                  </td>
                  <td className="border-b border-border/30 px-3 py-2 font-mono text-foreground">
                    {row.phonetic_us_normalized ?? ""}
                  </td>
                  <td className="border-b border-border/30 px-3 py-2 text-foreground">
                    {row.meaning_fa}
                  </td>
                  <td className="border-b border-border/30 px-3 py-2 font-mono text-xs text-foreground">
                    {formatMatch(row.match)}
                  </td>
                  <td className="border-b border-border/30 px-3 py-2 font-mono text-foreground">
                    {row.meaning_fa_IPA_normalized}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={5}
                  className="px-3 py-6 text-center text-sm text-muted"
                >
                  {loading ? "Loading..." : "No results."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
