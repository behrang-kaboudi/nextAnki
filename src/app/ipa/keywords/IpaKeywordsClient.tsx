"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type IpaKeywordRow = {
  id: number;
  number: number;
  fa: string;
  faPlain: string;
  ipa_fa: string;
};

type FilterValue = "all" | "space0" | "space1" | "space2";

function countSpaces(value: string) {
  return (value.match(/ /g) ?? []).length;
}

function filterLabel(filter: FilterValue) {
  if (filter === "space0") return "Has 0 spaces (1 word)";
  if (filter === "space1") return "Has 1 space (2 words)";
  if (filter === "space2") return "Has 2 spaces (3 words)";
  return "All";
}

export function IpaKeywordsClient() {
  const [rows, setRows] = useState<IpaKeywordRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [filter, setFilter] = useState<FilterValue>("all");
  const [startsWithPrefix, setStartsWithPrefix] = useState<string | null>(null);
  const [startsWithRows, setStartsWithRows] = useState<IpaKeywordRow[]>([]);
  const [startsWithLoading, setStartsWithLoading] = useState(false);

  const fetchRows = useCallback(async (opts: { prefix: string }) => {
    setLoading(true);
    setError(null);
    try {
      const url = new URL("/api/ipa/keywords", window.location.origin);
      if (opts.prefix.trim()) url.searchParams.set("prefix", opts.prefix.trim());
      const response = await fetch(url.toString(), { cache: "no-store" });
      if (!response.ok) throw new Error(`Request failed (${response.status})`);
      const data = (await response.json()) as { rows: IpaKeywordRow[] };
      setRows(data.rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchStartsWith = useCallback(async (prefix: string) => {
    setStartsWithLoading(true);
    setError(null);
    try {
      const url = new URL("/api/ipa/keywords", window.location.origin);
      url.searchParams.set("prefix", prefix.trim());
      const response = await fetch(url.toString(), { cache: "no-store" });
      if (!response.ok) throw new Error(`Request failed (${response.status})`);
      const data = (await response.json()) as { rows: IpaKeywordRow[] };
      setStartsWithRows(data.rows);
      setStartsWithPrefix(prefix);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setStartsWithLoading(false);
    }
  }, []);

  const onClearStartsWith = useCallback(() => {
    setStartsWithPrefix(null);
    setStartsWithRows([]);
  }, []);

  const onDelete = useCallback(
    async (id: number) => {
      if (!confirm("Delete this record?")) return;
      setLoading(true);
      setError(null);
      try {
        const url = new URL("/api/ipa/keywords", window.location.origin);
        url.searchParams.set("id", String(id));
        const response = await fetch(url.toString(), { method: "DELETE" });
        if (!response.ok) throw new Error(`Delete failed (${response.status})`);
        await fetchRows({ prefix: "" });
        if (startsWithPrefix?.trim()) {
          await fetchStartsWith(startsWithPrefix);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    },
    [fetchRows, fetchStartsWith, startsWithPrefix],
  );

  const onStartsWith = useCallback(
    (value: string) => {
      void fetchStartsWith(value);
    },
    [fetchStartsWith],
  );

  const filtered = useMemo(() => {
    const base = rows;
    if (filter === "all") return base;
    if (filter === "space0") return base.filter((row) => countSpaces(row.faPlain) === 0);
    if (filter === "space1") return base.filter((row) => countSpaces(row.faPlain) === 1);
    return base.filter((row) => countSpaces(row.faPlain) === 2);
  }, [filter, rows]);

  useEffect(() => {
    void fetchRows({ prefix: "" });
  }, [fetchRows]);

  return (
    <div className="grid gap-6 lg:grid-cols-[22rem_1fr]">
      <aside className="h-fit rounded-2xl border border-card bg-card p-4 shadow-elevated">
        <div className="text-lg font-semibold text-foreground">Filter</div>
        <div className="mt-1 text-sm text-muted">
          Applied automatically on <code className="font-mono">faPlain</code>.
        </div>

        <label className="mt-4 block text-sm font-medium text-foreground">
          Space count
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as FilterValue)}
            className="mt-1 w-full rounded-xl border border-card bg-background px-3 py-2 text-sm text-foreground"
          >
            <option value="all">All</option>
            <option value="space0">Has 0 spaces (1 word)</option>
            <option value="space1">Has 1 space (2 words)</option>
            <option value="space2">Has 2 spaces (3 words)</option>
          </select>
        </label>

        <div className="mt-6 rounded-xl border border-card bg-background p-3 text-sm">
          <div className="text-muted">Status</div>
          <div className="mt-1 text-foreground">
            {loading ? "Loading…" : `${filtered.length} results (filter: ${filterLabel(filter)})`}
          </div>
        </div>
      </aside>

      <main className="grid gap-4 lg:grid-cols-[1fr_22rem] lg:items-start">
        <div className="grid gap-4">
          <div className="grid gap-1">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            IPA Keywords
          </h1>
          <p className="text-sm text-muted">
            Manage <code className="font-mono">IpaKeyword</code> records.
          </p>
          </div>

          {error ? (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <section className="overflow-hidden rounded-2xl border border-card bg-card shadow-elevated">
            <div className="overflow-auto">
              <table className="w-full table-fixed border-collapse">
                <thead className="bg-background">
                  <tr className="text-left text-xs uppercase tracking-wide text-muted">
                    <th className="px-4 py-3">fa</th>
                    <th className="px-4 py-3">faPlain</th>
                    <th className="hidden px-4 py-3 lg:table-cell">ipa</th>
                    <th className="w-44 px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row) => (
                    <tr key={row.id} className="border-t border-card text-sm">
                      <td className="break-words px-4 py-3 text-foreground">{row.fa}</td>
                      <td className="break-words px-4 py-3 text-foreground">{row.faPlain}</td>
                      <td className="hidden px-4 py-3 font-mono text-muted lg:table-cell">
                        <span className="block truncate">{row.ipa_fa}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => onStartsWith(row.faPlain)}
                            className="rounded-xl border border-card bg-background px-3 py-1.5 text-sm font-semibold text-foreground transition hover:bg-card disabled:opacity-60"
                            disabled={loading || startsWithLoading}
                          >
                            Starts-with
                          </button>
                          <button
                            type="button"
                            onClick={() => onDelete(row.id)}
                            className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-sm font-semibold text-red-700 transition hover:bg-red-500/15 disabled:opacity-60"
                            disabled={loading}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}

                  {filtered.length === 0 ? (
                    <tr className="border-t border-card">
                      <td
                        colSpan={4}
                        className="px-4 py-10 text-center text-sm text-muted"
                      >
                        No results.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <aside className="h-fit rounded-2xl border border-card bg-card p-4 shadow-elevated">
          <div className="flex items-center justify-between gap-2">
            <div className="text-lg font-semibold text-foreground">Starts-with</div>
            {startsWithPrefix ? (
              <button
                type="button"
                onClick={onClearStartsWith}
                className="rounded-xl border border-card bg-background px-2.5 py-1.5 text-sm font-semibold text-foreground transition hover:bg-card"
              >
                Clear
              </button>
            ) : null}
          </div>
          <div className="mt-1 text-sm text-muted">
            {startsWithPrefix ? (
              <>
                Showing keywords starting with{" "}
                <code className="font-mono">{startsWithPrefix}</code>
              </>
            ) : (
              "Click Starts-with on a row."
            )}
          </div>

          {startsWithLoading ? (
            <div className="mt-4 text-sm text-muted">Loading…</div>
          ) : startsWithPrefix ? (
            <div className="mt-4 grid gap-2">
              <div className="text-sm text-muted">{startsWithRows.length} results</div>
              <div className="max-h-[28rem] overflow-auto rounded-xl border border-card bg-background p-2">
                <div className="grid gap-1">
                  {startsWithRows.map((row) => (
                    <div
                      key={row.id}
                      className="rounded-lg px-2 py-1.5 text-sm text-foreground hover:bg-card"
                    >
                      {row.faPlain}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </aside>
      </main>
    </div>
  );
}
