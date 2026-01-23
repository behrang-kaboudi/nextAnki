"use client";

import { useMemo, useState } from "react";

type Item = { id: number; words: string[] };

export default function HintExportModal({ q }: { q: string }) {
  const [open, setOpen] = useState(false);
  const [take, setTake] = useState(50);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<Item[] | null>(null);
  const [importJson, setImportJson] = useState(
    `[\n  {\n    \"id\": 2293,\n    \"hint_sentence\": \"علی جعبه‌ها را جمع کرد\"\n  }\n]`
  );
  const [importResult, setImportResult] = useState<string | null>(null);

  const outputPretty = useMemo(() => (items ? JSON.stringify(items, null, 2) : ""), [items]);
  const outputCompressed = useMemo(() => (items ? JSON.stringify(items) : ""), [items]);

  async function run() {
    setLoading(true);
    setError(null);
    setItems(null);
    setImportResult(null);
    try {
      const params = new URLSearchParams();
      params.set("take", String(take));
      if (q.trim()) params.set("q", q.trim());

      const res = await fetch(`/api/words/hint-export?${params.toString()}`);
      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; error?: string; items?: Item[] }
        | null;

      if (!res.ok || !data?.ok) throw new Error(data?.error || `Request failed (${res.status})`);
      setItems(data.items ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  async function runImport() {
    setLoading(true);
    setError(null);
    setImportResult(null);
    try {
      const parsed = JSON.parse(importJson) as unknown;
      const res = await fetch("/api/words/hint-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed),
      });
      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; error?: string; okCount?: number; total?: number; results?: unknown }
        | null;

      if (!res.ok || !data?.ok) throw new Error(data?.error || `Import failed (${res.status})`);
      setImportResult(`Imported ${data.okCount ?? 0}/${data.total ?? 0}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  async function copy() {
    if (!outputCompressed) return;
    await navigator.clipboard.writeText(outputCompressed);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded border px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/5"
      >
        Export hint words
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="flex h-[80vh] w-full max-w-3xl flex-col rounded border bg-background p-4 shadow-lg">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-base font-semibold">Export hint words</div>
                <div className="mt-1 text-xs opacity-80">
                  Output: <span className="font-mono">[{`{ id, words: [...] }`}]</span>
                  {q.trim() ? (
                    <>
                      {" "}
                      • Filter: <span className="font-mono">{q.trim()}</span>
                    </>
                  ) : null}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded border px-2 py-1 text-sm hover:bg-black/5 dark:hover:bg-white/5"
              >
                Close
              </button>
            </div>

            <div className="mt-4 flex flex-wrap items-end gap-3">
              <label className="flex flex-col gap-1 text-xs">
                Count
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={take}
                  onChange={(e) => setTake(Number(e.target.value))}
                  className="w-32 rounded border px-3 py-2 text-sm"
                />
              </label>

              <button
                type="button"
                onClick={run}
                disabled={loading}
                className="rounded border px-3 py-2 text-sm hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/5"
              >
                {loading ? "Loading…" : "Confirm"}
              </button>

              <button
                type="button"
                onClick={() => void copy()}
                disabled={!outputCompressed}
                className="rounded border px-3 py-2 text-sm hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/5"
              >
                Copy
              </button>

              {error ? <div className="text-xs text-red-600">{error}</div> : null}
              {items ? <div className="text-xs opacity-70">Items: {items.length}</div> : null}
              {importResult ? <div className="text-xs opacity-70">{importResult}</div> : null}
            </div>

            <div className="mt-4 grid min-h-0 flex-1 grid-cols-1 gap-3 md:grid-cols-2">
              <div className="flex min-h-0 flex-col gap-2">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold">Export output</div>
                </div>
                <textarea
                  readOnly
                  value={outputPretty}
                  placeholder="Result will appear here…"
                  className="min-h-0 flex-1 resize-none rounded border bg-transparent p-3 font-mono text-xs"
                />
              </div>

              <div className="flex min-h-0 flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs font-semibold">Import hint_sentence</div>
                  <button
                    type="button"
                    onClick={() => void runImport()}
                    disabled={loading}
                    className="rounded border px-2 py-1 text-[11px] hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/5"
                  >
                    Import
                  </button>
                </div>
                <textarea
                  value={importJson}
                  onChange={(e) => setImportJson(e.target.value)}
                  placeholder='[\n  { "id": 2293, "hint_sentence": "..." }\n]'
                  className="min-h-0 flex-1 resize-none rounded border bg-transparent p-3 font-mono text-xs"
                />
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
