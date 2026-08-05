"use client";

import { useState } from "react";

type JsonHintValue = string | null;
type Report = {
  summary: {
    englishWords: number;
    linkedEnglishWords: number;
    unlinkedEnglishWords: number;
    englishWordsWithMultipleWords: number;
    comparedWordRows: number;
    matchingWordRows: number;
    changedWordRows: number;
    englishWordsWithoutJsonHint: number;
    wordsWithoutJsonHint: number;
    invalidEnglishWordJsonHints: number;
    invalidWordJsonHints: number;
  };
  changes: Array<{
    englishWord: { id: number; baseForm: string; jsonHint: JsonHintValue };
    word: { id: number; ankiLinkId: string; baseForm: string; jsonHint: JsonHintValue };
    reasons: string[];
  }>;
  unlinkedEnglishWords: Array<{ id: number; baseForm: string; jsonHint: JsonHintValue }>;
};

function prettyJson(value: JsonHintValue) {
  const raw = value?.trim() ?? "";
  if (!raw) return "—";
  try {
    return JSON.stringify(JSON.parse(raw) as unknown, null, 2);
  } catch {
    return raw;
  }
}

export default function CompareEnglishWordJsonHintWithWords() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<Report | null>(null);

  async function runComparison() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/words/english-words/json-hint-compare-word", { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as { ok?: boolean; report?: Report; error?: string } | null;
      if (!response.ok || !payload?.ok || !payload.report) throw new Error(payload?.error ?? "Could not compare json_hint values.");
      setReport(payload.report);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setLoading(false);
    }
  }

  return <section className="flex flex-col gap-2"><div className="flex flex-wrap items-center justify-between gap-3"><div><div className="text-sm font-semibold">Temporary json_hint comparison</div><div className="text-xs opacity-70">Compares each EnglishWord json_hint with linked Word.json_hint values. No database changes are made.</div></div><button type="button" onClick={() => { setOpen(true); void runComparison(); }} disabled={loading} className="rounded border px-3 py-2 text-sm hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/5">{loading ? "Comparing…" : "Compare with Word json_hint"}</button></div>{open ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true"><div className="flex max-h-full w-full max-w-7xl flex-col rounded-2xl border border-card bg-background p-4 shadow-lg"><div className="flex items-start justify-between gap-3"><div><div className="text-base font-semibold">EnglishWord ↔ Word json_hint report</div><div className="mt-1 text-xs opacity-80">`generatedAtMs` and JSON object-key order are ignored.</div></div><div className="flex gap-2"><button type="button" onClick={() => void runComparison()} disabled={loading} className="rounded border px-3 py-2 text-sm hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/5">Refresh</button><button type="button" onClick={() => setOpen(false)} className="rounded border px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/5">Close</button></div></div>{error ? <p className="mt-3 rounded border border-red-500/30 bg-red-600/10 p-3 text-sm text-red-700">{error}</p> : null}{loading ? <p className="mt-4 text-sm opacity-70">Comparing all linked records…</p> : null}{report ? <div className="mt-4 min-h-0 overflow-y-auto pr-1"><div className="grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-4">{Object.entries(report.summary).map(([key, value]) => <div key={key} className="rounded border p-2"><span className="opacity-70">{key}</span><div className="mt-1 text-sm font-semibold">{value}</div></div>)}</div><section className="mt-4"><h3 className="text-sm font-semibold">Changed records ({report.changes.length})</h3>{report.changes.length ? <div className="mt-2 space-y-3">{report.changes.map((item) => <article key={`${item.englishWord.id}-${item.word.id}`} className="rounded border p-3 text-xs"><div className="font-medium">EnglishWord #{item.englishWord.id} ({item.englishWord.baseForm}) ↔ Word #{item.word.id} ({item.word.baseForm})</div><div className="mt-1 opacity-70">Anki link: {item.word.ankiLinkId} · {item.reasons.join(" · ")}</div><div className="mt-3 grid gap-3 lg:grid-cols-2"><div><div className="mb-1 font-semibold">EnglishWord json_hint</div><pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words rounded border p-2 font-mono">{prettyJson(item.englishWord.jsonHint)}</pre></div><div><div className="mb-1 font-semibold">Word json_hint</div><pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words rounded border p-2 font-mono">{prettyJson(item.word.jsonHint)}</pre></div></div></article>)}</div> : <p className="mt-2 text-sm opacity-70">No changed linked Word records.</p>}</section><section className="mt-4"><h3 className="text-sm font-semibold">EnglishWord records with no linked Word ({report.unlinkedEnglishWords.length})</h3>{report.unlinkedEnglishWords.length ? <p className="mt-2 rounded border p-2 font-mono text-xs">{report.unlinkedEnglishWords.map((item) => `#${item.id} ${item.baseForm}`).join(" · ")}</p> : <p className="mt-2 text-sm opacity-70">None.</p>}</section></div> : null}</div></div> : null}</section>;
}
