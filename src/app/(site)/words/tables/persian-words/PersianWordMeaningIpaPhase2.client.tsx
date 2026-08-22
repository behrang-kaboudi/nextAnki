"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { SpecialCharactersBar } from "@/components/ipa/SpecialCharactersBar";
import { PromptSourcesButton } from "@/components/prompts/PromptSourcesButton";
import { PromptBatchControls } from "@/components/prompts/PromptBatchControls.client";
import { RemainingCountBadge, RemainingCountButton } from "@/components/remaining-count";
import { combinePromptParts } from "@/lib/ai/promptPolicy";

const PROMPT_PATHS = [
  "src/prompts/word-extraction/base/inputOutRulseV1 .md",
  "src/prompts/word-extraction/meaning_fa_IPA/rulseV1.md",
] as const;

const IPA_CHARACTERS = ["æ", "ɪ", "ɜ", "ə", "ʊ", "ʌ", "ʔ", "ʧ", "ʤ", "ɑ", "ɔ", "ŋ", "θ", "ð", "ʃ", "ʒ", "ɡ"] as const;
type InputRow = { id: number; canonical_text: string; dbMeaning: string | null; dbNormalized: string | null; dbConfirmed: boolean; inputMeaning: string; saving: boolean; saved: boolean; error: string | null };
type DuplicateConflict = { attempted: { id: number; canonical_text: string }; meaning_fa_IPA: string; existing: { id: number; canonical_text: string } };
type Report = { total: number; updated: number; failed: number; duplicateConflicts: DuplicateConflict[] };

function parseResponse(value: string): Array<{ id: number; meaning_fa_IPA: string }> {
  const parsed = JSON.parse(value) as unknown;
  if (!Array.isArray(parsed)) throw new Error("Response must be a JSON array.");
  const seen = new Set<number>();
  return parsed.map((row, index) => {
    if (!row || typeof row !== "object") throw new Error(`item[${index}] must be an object.`);
    const item = row as Record<string, unknown>;
    if (Object.keys(item).length !== 2 || !("id" in item) || !("meaning_fa_IPA" in item)) throw new Error(`item[${index}] must be exactly { id, meaning_fa_IPA }.`);
    const id = item.id;
    const meaning = typeof item.meaning_fa_IPA === "string" ? item.meaning_fa_IPA.trim() : "";
    if (typeof id !== "number" || !Number.isSafeInteger(id) || id <= 0 || !meaning || seen.has(id)) throw new Error(`Invalid or duplicate item at index ${index}.`);
    seen.add(id); return { id, meaning_fa_IPA: meaning };
  });
}

export default function PersianWordMeaningIpaPhase2({ initialMissingCount }: { initialMissingCount: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [limit, setLimit] = useState(String(initialMissingCount));
  const [loadedCount, setLoadedCount] = useState(0);
  const [prompt, setPrompt] = useState("");
  const [data, setData] = useState("");
  const [remainingCount, setRemainingCount] = useState(initialMissingCount);
  const [response, setResponse] = useState("");
  const [rows, setRows] = useState<InputRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [copyNotice, setCopyNotice] = useState<string | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  useEffect(() => setLimit(String(initialMissingCount)), [initialMissingCount]);
  const lastInputRef = useRef<HTMLInputElement | null>(null);
  const lastIdRef = useRef<number | null>(null);
  const clearLoadedBatch = () => {
    setData("");
    setResponse("");
    setLoadedCount(0);
    setRows([]);
    setReport(null);
    setCopyNotice(null);
  };

  const copy = (value: string) => {
    const label = value === prompt ? "Prompt" : value === data ? "Data" : "Prompt and data";
    void navigator.clipboard.writeText(value)
      .then(() => { setError(null); setCopyNotice(`${label} copied ✓`); })
      .catch((reason) => setError(reason instanceof Error ? reason.message : String(reason)));
  };
  const refreshData = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/words/persian-words/meaning-fa-ipa/missing?batchSize=${encodeURIComponent(limit)}`);
      const json = (await res.json()) as { ok?: boolean; items?: unknown; totalMissing?: number; error?: string };
      if (!res.ok || !json.ok) throw new Error(json.error || "Could not load missing rows.");
      setData(JSON.stringify(json.items ?? [], null, 2));
      setRemainingCount(typeof json.totalMissing === "number" ? json.totalMissing : initialMissingCount);
      setLoadedCount(Array.isArray(json.items) ? json.items.length : 0);
      setCopyNotice(`Data refreshed with ${Array.isArray(json.items) ? json.items.length : 0} record(s) ✓`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); } finally { setLoading(false); }
  }, [initialMissingCount, limit]);
  const openPrompt = useCallback(async () => {
    setOpen(true); setLoading(true); setError(null); setCopyNotice(null); setResponse(""); setRows([]); setReport(null);
    try {
      const [files, missing] = await Promise.all([
        Promise.all(PROMPT_PATHS.map(async (path) => { const res = await fetch(`/api/ai/prompt-file?path=${encodeURIComponent(path)}`); const json = (await res.json()) as { text?: string; error?: string }; if (!res.ok || !json.text) throw new Error(json.error || "Could not load prompt."); return json.text; })),
        fetch(`/api/words/persian-words/meaning-fa-ipa/missing?batchSize=${encodeURIComponent(limit)}`).then(async (res) => { const json = (await res.json()) as { ok?: boolean; items?: unknown; totalMissing?: number; error?: string }; if (!res.ok || !json.ok) throw new Error(json.error || "Could not load missing rows."); return json; }),
      ]);
      setPrompt(combinePromptParts(files)); setData(JSON.stringify(missing.items ?? [], null, 2)); setRemainingCount(typeof missing.totalMissing === "number" ? missing.totalMissing : initialMissingCount); setLoadedCount(Array.isArray(missing.items) ? missing.items.length : 0);
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); } finally { setLoading(false); }
  }, [initialMissingCount, limit]);

  const prepareApply = useCallback(async () => {
    setError(null);
    try {
      const pairs = parseResponse(response);
      const res = await fetch("/api/words/persian-words/meaning-fa-ipa/records", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: pairs.map((pair) => pair.id) }) });
      const json = (await res.json()) as { ok?: boolean; items?: Array<{ id: number; canonical_text: string; meaning_fa_IPA: string | null; meaning_fa_IPA_normalize: string | null; meaning_fa_IPA_confirmed: boolean }>; error?: string };
      if (!res.ok || !json.ok) throw new Error(json.error || "Could not load rows for confirmation.");
      const db = new Map((json.items ?? []).map((item) => [item.id, item]));
      setRows(pairs.map((pair) => { const item = db.get(pair.id); if (!item) throw new Error(`PersianWord ${pair.id} was not found.`); return { id: item.id, canonical_text: item.canonical_text, dbMeaning: item.meaning_fa_IPA, dbNormalized: item.meaning_fa_IPA_normalize, dbConfirmed: item.meaning_fa_IPA_confirmed, inputMeaning: pair.meaning_fa_IPA, saving: false, saved: false, error: null }; }));
      setConfirmOpen(true);
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
  }, [response]);

  const apply = useCallback(async (selected: InputRow[]) => {
    const selectedIds = new Set(selected.map((row) => row.id));
    setError(null);
    setRows((current) => current.map((row) => selectedIds.has(row.id) ? { ...row, saving: true, saved: false, error: null } : row));
    try {
      const res = await fetch("/api/words/persian-words/meaning-fa-ipa/update-bulk", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(selected.map((row) => ({ id: row.id, meaning_fa_IPA: row.inputMeaning.trim() }))) });
      const json = (await res.json()) as { ok?: boolean; total?: number; updated?: number; results?: Array<{ ok: boolean; id: number; meaning_fa_IPA?: string | null; meaning_fa_IPA_normalize?: string | null; meaning_fa_IPA_confirmed?: boolean; error?: string; duplicateConflict?: DuplicateConflict }>; error?: string };
      if (!res.ok || !json.ok) throw new Error(json.error || "Apply failed.");
      const results = new Map((json.results ?? []).map((result) => [result.id, result]));
      const failed = [...results.values()].filter((result) => !result.ok).length;
      const duplicateConflicts = [...results.values()].flatMap((result) => result.duplicateConflict ? [result.duplicateConflict] : []);
      setReport({ total: json.total ?? selected.length, updated: json.updated ?? 0, failed, duplicateConflicts });
      setRemainingCount((current) => Math.max(0, current - (json.updated ?? 0)));
      setRows((current) => current.map((row) => { const result = results.get(row.id); return !result ? row : result.ok ? { ...row, dbMeaning: result.meaning_fa_IPA ?? row.inputMeaning, dbNormalized: result.meaning_fa_IPA_normalize ?? null, dbConfirmed: result.meaning_fa_IPA_confirmed === true, saving: false, saved: true, error: null } : { ...row, saving: false, error: result.error ?? "Update failed." }; }));
      router.refresh();
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : String(reason);
      setError(message);
      setRows((current) => current.map((row) => selectedIds.has(row.id) ? { ...row, saving: false, error: message } : row));
    }
  }, [router]);

  const insertCharacter = (character: string) => {
    const element = lastInputRef.current; const id = lastIdRef.current;
    if (!element || !id) return;
    const start = element.selectionStart ?? element.value.length; const end = element.selectionEnd ?? element.value.length;
    const next = element.value.slice(0, start) + character + element.value.slice(end);
    setRows((current) => current.map((row) => row.id === id ? { ...row, inputMeaning: next, dbConfirmed: false, saved: false } : row));
    requestAnimationFrame(() => { element.focus(); element.setSelectionRange(start + character.length, start + character.length); });
  };

  return <>
    <style jsx>{`
      button { transition: transform 120ms ease, background-color 120ms ease; }
      button:active:not(:disabled) { transform: scale(0.95); }
    `}</style>
    {open && copyNotice ? <div className="fixed bottom-6 right-6 z-[70] rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-800 shadow-elevated dark:text-emerald-300" role="status">{copyNotice}</div> : null}
    <div><button type="button" onClick={() => void openPrompt()} disabled={loading} className="rounded border px-3 py-2 text-sm hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/5">{loading ? "Loading…" : <>2.1 PROMPT FOR: EXTRACT MEANING_FA_IPA <RemainingCountBadge count={remainingCount} /></>}</button></div>
    {open ? (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
        <div className="flex h-[85vh] w-full max-w-7xl flex-col gap-4 rounded-2xl border border-card bg-background p-6 shadow-elevated">
          <div className="flex items-start justify-between gap-3">
            <div><div className="text-base font-semibold">meaning_fa_IPA Prompt — PersianWord</div><div className="mt-1 text-xs opacity-70">Copy prompt + data, paste the AI JSON response on the right, then apply.</div></div>
            <div className="flex items-center gap-2"><PromptSourcesButton paths={PROMPT_PATHS} /><button type="button" onClick={() => setOpen(false)} className="rounded border px-2 py-1 text-sm">Close</button></div>
          </div>
          {error ? <div className="rounded border border-red-500/30 bg-red-600/10 p-3 text-sm text-red-700">{error}</div> : null}
          <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-2">
            <section className="flex min-h-0 flex-col gap-2">
              <PromptBatchControls batchSize={limit} disabled={loading} loadedCount={loadedCount} totalEligibleCount={remainingCount} onBatchSizeChange={(value) => { clearLoadedBatch(); setLimit(value); }} />
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => copy(prompt)} className="rounded border px-2 py-1 text-xs">Copy prompt</button>
                <button type="button" onClick={() => copy(data)} className="rounded border px-2 py-1 text-xs">Copy data</button>
                <button type="button" onClick={() => copy(`${prompt}\n\n${data}`)} disabled={!data} className="rounded border px-2 py-1 text-xs disabled:opacity-50">Copy prompt + data</button>
                <button type="button" onClick={() => void refreshData()} disabled={loading} className="rounded border px-2 py-1 text-xs disabled:opacity-50">{loading ? "Loading…" : "Create data"}</button>
                <RemainingCountButton count={remainingCount} disabled={loading} onClick={() => setLimit(String(remainingCount))} />
              </div>
              <textarea readOnly value={`${prompt}${data ? `\n\n${data}` : ""}`} className="min-h-0 flex-1 resize-none rounded border p-3 font-mono text-xs" />
            </section>
            <section className="flex min-h-0 flex-col gap-2">
              <div className="text-sm font-semibold">Response</div>
              <textarea value={response} onChange={(event) => setResponse(event.target.value)} placeholder='[{"id": 1, "meaning_fa_IPA": "..."}]' className="min-h-0 flex-1 resize-none rounded border p-3 font-mono text-xs" />
              <div className="flex gap-2"><button type="button" onClick={() => void navigator.clipboard.readText().then(setResponse).catch((reason) => setError(reason instanceof Error ? reason.message : String(reason)))} className="rounded border px-3 py-2 text-sm hover:bg-black/5">Paste response</button><button type="button" onClick={() => void prepareApply()} disabled={!response.trim()} className="rounded border px-3 py-2 text-sm hover:bg-black/5 disabled:opacity-50">2.2 APPLY MEANING_FA_IPA (per row)</button></div>
            </section>
          </div>
        </div>
      </div>
    ) : null}
    {confirmOpen ? <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true"><div className="flex h-[85vh] w-full max-w-6xl flex-col gap-4 rounded-2xl border border-card bg-background p-6 shadow-elevated"><div className="flex items-start justify-between gap-3"><div><div className="text-base font-semibold">Review and confirm meaning_fa_IPA</div>{report ? <div className="mt-1 text-sm text-emerald-700">Report: updated and confirmed {report.updated}/{report.total} • failed {report.failed}</div> : <div className="mt-1 text-xs opacity-70">Compare or edit each value. Every successful Update is saved with meaning_fa_IPA_confirmed=true.</div>}</div><div className="flex gap-2"><button type="button" onClick={() => void apply(rows)} disabled={!rows.length || rows.some((row) => row.saving)} className="rounded border px-3 py-1 text-sm">Update &amp; confirm all</button><button type="button" onClick={() => setConfirmOpen(false)} className="rounded border px-2 py-1 text-sm">Close</button></div></div>{report?.duplicateConflicts.length ? <div className="overflow-auto rounded border border-red-500/30 bg-red-600/5"><div className="border-b border-red-500/20 px-3 py-2 text-sm font-semibold text-red-700">Duplicate IPA log</div><table className="w-full text-left text-xs"><thead><tr className="border-b border-red-500/20"><th className="px-3 py-2"><span dir="rtl">رکورد در حال ویرایش</span></th><th className="px-3 py-2"><span dir="rtl">IPA واردشده</span></th><th className="px-3 py-2"><span dir="rtl">رکوردی که قبلاً این IPA را دارد</span></th></tr></thead><tbody>{report.duplicateConflicts.map((conflict) => <tr key={`${conflict.attempted.id}-${conflict.meaning_fa_IPA}`} className="border-b border-red-500/10 last:border-0"><td className="px-3 py-2"><span className="font-mono">{conflict.attempted.id}</span> — <span dir="rtl">{conflict.attempted.canonical_text}</span></td><td className="px-3 py-2 font-mono">{conflict.meaning_fa_IPA}</td><td className="px-3 py-2"><span className="font-mono">{conflict.existing.id}</span> — <span dir="rtl">{conflict.existing.canonical_text}</span></td></tr>)}</tbody></table></div> : null}<SpecialCharactersBar characters={IPA_CHARACTERS} onPick={insertCharacter} title="Special characters" helpText="Click an IPA field, then click a character." /><div className="min-h-0 flex-1 overflow-auto rounded border"><table className="w-full text-left text-xs"><thead className="sticky top-0 bg-background"><tr className="border-b"><th className="px-3 py-2">id</th><th className="px-3 py-2">canonical_text</th><th className="px-3 py-2">IPA (DB)</th><th className="px-3 py-2">confirmed</th><th className="px-3 py-2">IPA input/edit</th><th className="px-3 py-2">action</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id} className="border-b"><td className="px-3 py-2 font-mono">{row.id}</td><td className="px-3 py-2 text-base" dir="rtl">{row.canonical_text}</td><td className="px-3 py-2 font-mono">{row.dbMeaning ?? "—"}</td><td className={row.dbConfirmed ? "px-3 py-2 font-semibold text-emerald-700" : "px-3 py-2 font-semibold text-amber-700"}>{row.dbConfirmed ? "True" : "False"}</td><td className="px-3 py-2"><input value={row.inputMeaning} onChange={(event) => setRows((current) => current.map((item) => item.id === row.id ? { ...item, inputMeaning: event.target.value, dbConfirmed: false, saved: false } : item))} onFocus={(event) => { lastInputRef.current = event.currentTarget; lastIdRef.current = row.id; }} className="w-72 rounded border px-2 py-1 font-mono" />{row.error ? <div className="text-red-600">{row.error}</div> : row.saved ? <div className="text-green-700">Confirmed</div> : null}</td><td className="px-3 py-2"><button type="button" onClick={() => void apply([row])} className="rounded border px-2 py-1">Update &amp; confirm</button></td></tr>)}</tbody></table></div></div></div> : null}
  </>;
}
