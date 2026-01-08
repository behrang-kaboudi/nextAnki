"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type MatchMode = "2char" | "3char" | "4char";

export function Word2CharDemoClient() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<MatchMode>("3char");
  const [showLessThanKeysOnly, setShowLessThanKeysOnly] = useState(false);
  const [data, setData] = useState<
    | null
    | {
        words: Array<{
          base_form: string;
          phonetic_us: string | null;
          phonetic_us_normalized: string;
          combinationKeys?: string[];
          keys: Array<{ fa: string; ipa_fa_normalized: string }>;
          bestMatch: null | {
            id: number;
            fa: string;
            ipa_fa_normalized: string;
            type: string;
          };
        }>;
      }
  >(null);

  const filterKeysLessThan = 3;

  const visibleWords = useMemo(() => {
    if (!data?.words?.length) return [];
    if (!showLessThanKeysOnly) return data.words;
    return data.words.filter((w) => (w.keys?.length ?? 0) < filterKeysLessThan);
  }, [data?.words, showLessThanKeysOnly]);

  const stats = useMemo(() => {
    const words = data?.words ?? [];
    const visible = visibleWords;
    const countFor = (list: typeof words) => {
      const zero = list.filter((w) => (w.keys?.length ?? 0) === 0).length;
      const one = list.filter((w) => (w.keys?.length ?? 0) === 1).length;
      const two = list.filter((w) => (w.keys?.length ?? 0) === 2).length;
      return { total: list.length, zero, one, two };
    };

    return {
      all: countFor(words),
      visible: countFor(visible),
      isFiltered: showLessThanKeysOnly,
    };
  }, [data?.words, showLessThanKeysOnly, visibleWords]);

  const run = useCallback(async (nextMode: MatchMode) => {
    setLoading(true);
    setError(null);
    setData(null);
    setMode(nextMode);
    try {
      const res = await fetch(
        nextMode === "4char"
          ? "/api/ipa/phrase-building/word-4char"
          : nextMode === "3char"
            ? "/api/ipa/phrase-building/word-3char"
            : "/api/ipa/phrase-building/word-2char",
        { cache: "no-store" },
      );
      const json = (await res.json()) as {
        words: Array<{
          base_form: string;
          phonetic_us: string | null;
          phonetic_us_normalized: string;
          combinationKeys?: string[];
          keys: Array<{ fa: string; ipa_fa_normalized: string }>;
          bestMatch: null | {
            id: number;
            fa: string;
            ipa_fa_normalized: string;
            type: string;
          };
        }>;
        error?: string;
      };
      if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
      setData({ words: json.words ?? [] });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void run("3char");
  }, [run]);

  return (
    <div className="grid gap-3 rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="grid gap-1">
          <h2 className="text-sm font-medium text-muted">
            Word{" "}
            {mode === "4char" ? "4-char" : mode === "3char" ? "3-char" : "2-char"}{" "}
            phonetic
          </h2>
          <p className="text-sm text-muted">
            Finds all{" "}
            {mode === "4char" ? "4" : mode === "3char" ? "3" : "2"}-char values
            from{" "}
            <code className="font-mono">Word.phonetic_us_normalized</code> and
            shows matching{" "}
            <code className="font-mono">PictureWord</code> rows where <code className="font-mono">ipa_fa_normalized</code> starts with them.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-3">
          <label className="inline-flex select-none items-center gap-2 text-sm text-muted">
            <input
              type="checkbox"
              checked={showLessThanKeysOnly}
              onChange={(e) => setShowLessThanKeysOnly(e.target.checked)}
              disabled={loading}
            />
            keys &lt; {filterKeysLessThan}
          </label>
          <button
            type="button"
            onClick={() => run("2char")}
            disabled={loading}
            className="inline-flex items-center justify-center rounded-md bg-[var(--primary)] px-3 py-2 text-sm font-semibold text-[var(--primary-foreground)] transition hover:opacity-95 disabled:opacity-60"
          >
            {loading && mode === "2char" ? "Loading..." : "Load 2-char matches"}
          </button>
          <button
            type="button"
            onClick={() => run("3char")}
            disabled={loading}
            className="inline-flex items-center justify-center rounded-md bg-[var(--primary)] px-3 py-2 text-sm font-semibold text-[var(--primary-foreground)] transition hover:opacity-95 disabled:opacity-60"
          >
            {loading && mode === "3char" ? "Loading..." : "Load 3-char matches"}
          </button>
          <button
            type="button"
            onClick={() => run("4char")}
            disabled={loading}
            className="inline-flex items-center justify-center rounded-md bg-[var(--primary)] px-3 py-2 text-sm font-semibold text-[var(--primary-foreground)] transition hover:opacity-95 disabled:opacity-60"
          >
            {loading && mode === "4char" ? "Loading..." : "Load 4-char matches"}
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-foreground">{error}</div>
      ) : null}

      {data ? (
        <div className="grid gap-2">
          <div className="rounded-md border border-border/60 bg-background p-3">
            <div className="text-xs text-muted">
              words: {visibleWords.length}
              {showLessThanKeysOnly ? ` (filtered from ${data.words.length})` : ""}
            </div>
            <div className="mt-2 grid gap-1 text-xs text-muted">
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                <span className="tabular-nums">total: {stats.visible.total}</span>
                <span className="tabular-nums">keys=0: {stats.visible.zero}</span>
                <span className="tabular-nums">keys=1: {stats.visible.one}</span>
                <span className="tabular-nums">keys=2: {stats.visible.two}</span>
              </div>
              {stats.isFiltered ? (
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  <span className="tabular-nums text-muted">
                    (all) total: {stats.all.total}
                  </span>
                  <span className="tabular-nums text-muted">
                    (all) keys=0: {stats.all.zero}
                  </span>
                  <span className="tabular-nums text-muted">
                    (all) keys=1: {stats.all.one}
                  </span>
                  <span className="tabular-nums text-muted">
                    (all) keys=2: {stats.all.two}
                  </span>
                </div>
              ) : null}
            </div>
            {visibleWords.length ? (
              <div className="mt-2 overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted">
                      <th className="border-b border-border/60 py-1 pr-3">base_form</th>
                      <th className="border-b border-border/60 py-1 pr-3">phonetic_us</th>
                      <th className="border-b border-border/60 py-1 pr-3">phonetic_us_normalized</th>
                      <th className="border-b border-border/60 py-1 pr-3">combination</th>
                      <th className="border-b border-border/60 py-1 pr-3">bestMatch</th>
                      <th className="border-b border-border/60 py-1 pr-3">keys</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleWords.map((w, idx) => (
                      <tr key={`${w.phonetic_us_normalized}-${idx}`} className="align-top">
                        <td className="py-1 pr-3">{w.base_form}</td>
                        <td className="py-1 pr-3 font-mono">{w.phonetic_us ?? ""}</td>
                        <td className="py-1 pr-3 font-mono">{w.phonetic_us_normalized}</td>
                        <td className="py-1 pr-3 font-mono text-xs">
                          {w.combinationKeys?.length ? w.combinationKeys.join(" | ") : ""}
                        </td>
                        <td className="py-1 pr-3 font-mono text-xs">
                          {w.bestMatch
                            ? `id:${w.bestMatch.id} type:${w.bestMatch.type} fa:'${w.bestMatch.fa}' ipa:'${w.bestMatch.ipa_fa_normalized}'`
                            : ""}
                        </td>
                        <td className="py-1 pr-3 font-mono text-xs">
                          {w.keys?.length ? w.keys.map((k) => `fa: '${k.fa}', ipa_fa_normalized: '${k.ipa_fa_normalized}'`).join(" | ") : ""}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="mt-2 text-xs text-muted">No results.</div>
            )}
          </div>
        </div>
      ) : (
        <div className="text-sm text-muted">Click the button to load results.</div>
      )}
    </div>
  );
}
