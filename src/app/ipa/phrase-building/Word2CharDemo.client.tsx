"use client";

import { useState } from "react";

type Row = {
  id: number;
  fa: string;
  en: string;
  ipa_fa: string;
  ipa_fa_normalized: string;
  type: string;
};

export function Word2CharDemoClient() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<
    | null
    | {
        prefixes: string[];
        wordsByPrefix: Record<string, Array<{ base_form: string; phonetic_us: string | null; phonetic_us_normalized: string }>>;
        matchesByPrefix: Record<string, Row[]>;
      }
  >(null);

  async function run() {
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const res = await fetch(
        "/api/ipa/phrase-building/word-2char?maxPrefixes=2000&maxWordsPerPrefix=10&maxMatchesPerPrefix=50",
        { cache: "no-store" }
      );
      const json = (await res.json()) as {
        prefixes: string[];
        wordsByPrefix: Record<string, Array<{ base_form: string; phonetic_us: string | null; phonetic_us_normalized: string }>>;
        matchesByPrefix: Record<string, Row[]>;
        error?: string;
      };
      if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
      setData({ prefixes: json.prefixes ?? [], wordsByPrefix: json.wordsByPrefix ?? {}, matchesByPrefix: json.matchesByPrefix ?? {} });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-3 rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="grid gap-1">
          <h2 className="text-sm font-medium text-muted">Word 2-char phonetic</h2>
          <p className="text-sm text-muted">
            Finds all 2-char values from <code className="font-mono">Word.phonetic_us_normalized</code> and shows matching{" "}
            <code className="font-mono">PictureWord</code> rows where <code className="font-mono">ipa_fa_normalized</code> starts with them.
          </p>
        </div>
        <button
          type="button"
          onClick={run}
          disabled={loading}
          className="inline-flex items-center justify-center rounded-md bg-[var(--primary)] px-3 py-2 text-sm font-semibold text-[var(--primary-foreground)] transition hover:opacity-95 disabled:opacity-60"
        >
          {loading ? "Loading..." : "Load matches"}
        </button>
      </div>

      {error ? (
        <div className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-foreground">{error}</div>
      ) : null}

      {data ? (
        <div className="grid gap-2">
          {data.prefixes.map((p) => {
            const matches = data.matchesByPrefix[p] ?? [];
            const words = data.wordsByPrefix[p] ?? [];
            return (
              <div key={p} className="rounded-md border border-border/60 bg-background p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-mono text-base">{p}</div>
                  <div className="text-xs text-muted">matches: {matches.length}</div>
                </div>
                {words.length ? (
                  <div className="mt-2 text-xs text-muted">
                    base_form:{" "}
                    <span className="font-mono">
                      {words.map((w) => w.base_form).filter(Boolean).join(", ")}
                    </span>
                  </div>
                ) : null}
                {matches.length ? (
                  <div className="mt-2 overflow-x-auto">
                    <table className="w-full border-collapse text-sm">
                      <thead>
                        <tr className="text-left text-xs text-muted">
                          <th className="border-b border-border/60 py-1 pr-3">fa</th>
                          <th className="border-b border-border/60 py-1 pr-3">en</th>
                          <th className="border-b border-border/60 py-1 pr-3">ipa_fa</th>
                          <th className="border-b border-border/60 py-1 pr-3">ipa_fa_normalized</th>
                          <th className="border-b border-border/60 py-1 pr-3">type</th>
                        </tr>
                      </thead>
                      <tbody>
                        {matches.map((r) => (
                          <tr key={r.id} className="align-top">
                            <td className="py-1 pr-3 [direction:rtl]">{r.fa}</td>
                            <td className="py-1 pr-3">{r.en}</td>
                            <td className="py-1 pr-3 font-mono">{r.ipa_fa}</td>
                            <td className="py-1 pr-3 font-mono">{r.ipa_fa_normalized}</td>
                            <td className="py-1 pr-3 font-mono">{r.type}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="mt-2 text-xs text-muted">No matches.</div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-sm text-muted">Click the button to load results.</div>
      )}
    </div>
  );
}
