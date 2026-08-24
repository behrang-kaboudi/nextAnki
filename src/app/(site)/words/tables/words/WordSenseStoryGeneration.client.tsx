"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { ModalPortal } from "@/components/modal-portal";
import { RemainingCountBadge } from "@/components/remaining-count";

type Summary = { totalMissing: number; readyByFields: number; blockedByFields: number };
type PreparedItem = { word_sense_id: number; english_word: string; meaning_fa: string; expected_selected_symbols: Array<{ token: string }> };
type PreviewItem = {
  word_sense_id: number;
  english_word: string;
  meaning_fa: string;
  story_text: string;
  selected_symbols: Array<{ token: string; target_lang: string; target_ipa: string }>;
  qa: { score: number };
};

const buttonClass = "inline-flex min-h-10 items-center justify-center rounded-xl border border-card bg-background px-3 py-2 text-xs font-semibold text-foreground transition hover:bg-card disabled:cursor-not-allowed disabled:opacity-50";

export default function WordSenseStoryGeneration({ initialSummary, pilotWordSenseIds }: { initialSummary: Summary; pilotWordSenseIds: readonly number[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [summary, setSummary] = useState(initialSummary);
  const [limit, setLimit] = useState(String(Math.min(20, Math.max(1, initialSummary.readyByFields))));
  const [usePilot, setUsePilot] = useState(true);
  const [prompt, setPrompt] = useState("");
  const [requests, setRequests] = useState<PreparedItem[]>([]);
  const [responseText, setResponseText] = useState("");
  const [preview, setPreview] = useState<PreviewItem[]>([]);
  const [omittedIds, setOmittedIds] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => setSummary(initialSummary), [initialSummary]);
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [busy, open]);

  const completePrompt = useMemo(
    () => prompt && requests.length ? `${prompt}\n\n## Input records\n${JSON.stringify(requests, null, 2)}` : "",
    [prompt, requests],
  );

  function resetAfterPrepare() {
    setResponseText("");
    setPreview([]);
    setOmittedIds([]);
    setError("");
    setNotice("");
  }

  async function prepare() {
    const parsedLimit = Number(limit);
    if (!Number.isSafeInteger(parsedLimit) || parsedLimit <= 0) {
      setError("Count must be a positive integer.");
      return;
    }
    setBusy(true);
    resetAfterPrepare();
    try {
      const response = await fetch("/api/v1/word-sense-stories/prepare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: parsedLimit, ...(usePilot ? { wordSenseIds: pilotWordSenseIds } : {}) }),
      });
      const json = await response.json() as { ok?: boolean; error?: string; prompt?: string; data?: PreparedItem[]; summary?: Summary };
      if (!response.ok || !json.ok) throw new Error(json.error || `Prepare failed (${response.status}).`);
      setPrompt(json.prompt ?? "");
      setRequests(json.data ?? []);
      if (json.summary) setSummary(json.summary);
      setNotice(`${(json.data ?? []).length.toLocaleString()} records prepared${usePilot ? ` from the saved ${pilotWordSenseIds.length}-sense pilot` : ""}. No story has been saved.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  }

  async function previewResponse() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const items = JSON.parse(responseText) as unknown;
      const response = await fetch("/api/v1/word-sense-stories/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requests, items }),
      });
      const json = await response.json() as { ok?: boolean; error?: string; items?: PreviewItem[]; omittedWordSenseIds?: number[] };
      if (!response.ok || !json.ok) throw new Error(json.error || `Preview failed (${response.status}).`);
      setPreview(json.items ?? []);
      setOmittedIds(json.omittedWordSenseIds ?? []);
      setNotice("Preview validated. Nothing has been saved yet.");
    } catch (reason) {
      setPreview([]);
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  }

  async function applyConfirmed() {
    if (!window.confirm(`Save ${preview.length} reviewed stor${preview.length === 1 ? "y" : "ies"}? Omitted records remain unchanged.`)) return;
    setBusy(true);
    setError("");
    try {
      const items = JSON.parse(responseText) as unknown;
      const response = await fetch("/api/v1/word-sense-stories/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requests, items, confirmed: true }),
      });
      const json = await response.json() as { ok?: boolean; error?: string; createdCount?: number };
      if (!response.ok || !json.ok) throw new Error(json.error || `Apply failed (${response.status}).`);
      setNotice(`${json.createdCount ?? 0} reviewed stories saved. Omitted records were not changed.`);
      setPreview([]);
      setPrompt("");
      setRequests([]);
      setResponseText("");
      const statusResponse = await fetch("/api/v1/word-sense-stories/status", { cache: "no-store" });
      const status = await statusResponse.json() as ({ ok?: boolean } & Partial<Summary>);
      if (status.ok && typeof status.totalMissing === "number" && typeof status.readyByFields === "number" && typeof status.blockedByFields === "number") {
        setSummary({ totalMissing: status.totalMissing, readyByFields: status.readyByFields, blockedByFields: status.blockedByFields });
      }
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1 rounded border px-3 py-2 text-sm transition active:scale-90 hover:bg-black/5 dark:hover:bg-white/5">
        <span>GENERATE WORD STORIES</span>
        <RemainingCountBadge count={summary.totalMissing} />
      </button>

      {open ? (
        <ModalPortal>
          <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-3 backdrop-blur-sm sm:p-6" role="dialog" aria-modal="true" aria-labelledby="word-story-title" onMouseDown={(event) => event.target === event.currentTarget && !busy && setOpen(false)}>
            <section className="flex max-h-[94vh] w-full max-w-7xl flex-col overflow-hidden rounded-3xl border border-card bg-background shadow-elevated">
              <header className="flex flex-wrap items-start justify-between gap-4 border-b border-card p-5">
                <div>
                  <h2 id="word-story-title" className="text-xl font-bold">WordSense story generation</h2>
                  <p className="mt-1 max-w-3xl text-sm leading-6 text-muted">Prepare missing stories, generate an array response, inspect the preview, and save only the items you explicitly approve.</p>
                </div>
                <button type="button" disabled={busy} onClick={() => setOpen(false)} className={buttonClass}>Close</button>
              </header>

              <div className="min-h-0 overflow-y-auto p-5">
                <div className="mb-4 grid gap-2 sm:grid-cols-3">
                  <div className="rounded-xl border p-3 text-sm"><b>{summary.totalMissing.toLocaleString()}</b><span className="ml-2 text-muted">without an active story</span></div>
                  <div className="rounded-xl border p-3 text-sm"><b>{summary.readyByFields.toLocaleString()}</b><span className="ml-2 text-muted">have meaning + json_hint</span></div>
                  <div className="rounded-xl border p-3 text-sm"><b>{summary.blockedByFields.toLocaleString()}</b><span className="ml-2 text-muted">missing required source fields</span></div>
                </div>

                <div className="grid gap-5 lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1.5fr)]">
                  <aside className="grid content-start gap-4">
                    <section className="rounded-2xl border border-card bg-card p-4">
                      <label className="mb-3 flex items-start gap-2 rounded-xl border bg-background p-3 text-xs">
                        <input type="checkbox" checked={usePilot} onChange={(event) => { setUsePilot(event.target.checked); resetAfterPrepare(); }} />
                        <span><b>Use saved pilot 20</b><span className="mt-1 block text-muted">Convenience selection only; it does not limit the system.</span></span>
                      </label>
                      <label className="grid gap-1 text-xs font-semibold text-muted">Count
                        <input type="number" min="1" disabled={usePilot} value={limit} onChange={(event) => { setLimit(event.target.value); resetAfterPrepare(); }} className="h-10 w-28 rounded-xl border bg-background px-3 text-sm disabled:opacity-50" />
                      </label>
                      <button type="button" disabled={busy} onClick={() => void prepare()} className="mt-3 rounded-xl bg-[var(--primary)] px-4 py-2 text-xs font-semibold text-[var(--primary-foreground)] disabled:opacity-50">{busy ? "Working…" : "Create data"}</button>
                      <p className="mt-2 break-words font-mono text-[10px] text-muted">Pilot WordSense IDs: {pilotWordSenseIds.join(", ")}</p>
                    </section>

                    <section className="rounded-2xl border border-card bg-card p-4">
                      <div className="flex flex-wrap gap-2">
                        <button type="button" disabled={!completePrompt || busy} onClick={() => void navigator.clipboard.writeText(completePrompt).then(() => setNotice("Complete prompt copied."))} className={buttonClass}>Copy prompt + data</button>
                        <button type="button" disabled={busy} onClick={() => void navigator.clipboard.readText().then(setResponseText).catch((reason) => setError(String(reason)))} className={buttonClass}>Paste response</button>
                      </div>
                      <button type="button" disabled={busy || !requests.length || !responseText.trim()} onClick={() => void previewResponse()} className={`${buttonClass} mt-2 w-full`}>Validate and preview</button>
                    </section>

                    {notice ? <p className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-xs text-emerald-800">{notice}</p> : null}
                    {error ? <p className="whitespace-pre-wrap rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-700">{error}</p> : null}
                  </aside>

                  <main className="grid content-start gap-4">
                    <div className="grid gap-4 xl:grid-cols-2">
                      <label className="grid gap-2 text-sm font-semibold">Prepared records
                        <textarea readOnly dir="ltr" value={JSON.stringify(requests, null, 2)} className="min-h-[360px] resize-y rounded-2xl border border-card bg-card p-4 font-mono text-xs font-normal leading-6" />
                      </label>
                      <label className="grid gap-2 text-sm font-semibold">AI response array
                        <textarea dir="ltr" value={responseText} onChange={(event) => { setResponseText(event.target.value); setPreview([]); setError(""); }} className="min-h-[360px] resize-y rounded-2xl border border-card bg-card p-4 font-mono text-xs font-normal leading-6" />
                      </label>
                    </div>

                    {preview.length || omittedIds.length ? (
                      <section className="rounded-2xl border border-card p-4">
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                          <div><h3 className="font-semibold">Human-review preview</h3><p className="text-xs text-muted">{preview.length} ready to save · {omittedIds.length} omitted and unchanged</p></div>
                          <button type="button" disabled={busy || !preview.length} onClick={() => void applyConfirmed()} className="rounded-xl border border-emerald-700 bg-emerald-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">Confirm and save reviewed stories</button>
                        </div>
                        <div className="grid gap-3">
                          {preview.map((item) => (
                            <article key={item.word_sense_id} className="rounded-xl border border-card bg-card p-4">
                              <div className="flex flex-wrap items-center gap-2 text-xs"><b>#{item.word_sense_id}</b><code>{item.english_word}</code><span dir="rtl">{item.meaning_fa}</span><span>QA {item.qa.score.toFixed(1)}</span></div>
                              <div className="mt-2 text-xs">{item.selected_symbols.map((symbol) => <code key={`${symbol.token}-${symbol.target_ipa}`} className="mr-2">{symbol.token} /{symbol.target_ipa}/</code>)}</div>
                              <p dir="rtl" className="mt-3 text-right leading-7">{item.story_text}</p>
                            </article>
                          ))}
                        </div>
                      </section>
                    ) : null}
                  </main>
                </div>
              </div>
            </section>
          </div>
        </ModalPortal>
      ) : null}
    </>
  );
}
