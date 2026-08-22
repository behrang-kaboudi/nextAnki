"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { PromptBatchControls } from "@/components/prompts/PromptBatchControls.client";
import { PromptSourcesButton } from "@/components/prompts/PromptSourcesButton";
import { RemainingCountBadge, RemainingCountButton } from "@/components/remaining-count";
import { parseIdiomReviewDecisions, type IdiomReviewDecision } from "@/lib/words/idiomReview";

const PROMPT_PATH = "src/prompts/word-extraction/idiom_review/rulseV1.md";
const buttonClass =
  "rounded border px-3 py-2 text-sm transition active:scale-90 hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/5";

type SourceRecord = { id: number; updatedAt: string };

type SourceRow = {
  id: number;
  base_form: string;
  meaning_fa: string;
  other_meanings_fa: string[];
  pos: string;
  concept_explained_fa: string;
  sentences: Array<{
    sentence_id: number;
    sentence_en: string;
    sentence_en_meaning_fa: string;
  }>;
};

export default function WordSenseIdiomReview({ remainingCount }: { remainingCount: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewTab, setPreviewTab] = useState<"changes" | "unchanged">("changes");
  const [busy, setBusy] = useState(false);
  const [limit, setLimit] = useState(String(remainingCount));
  const [totalEligible, setTotalEligible] = useState(remainingCount);
  const [prompt, setPrompt] = useState("");
  const [rows, setRows] = useState<SourceRow[]>([]);
  const [sourceRecords, setSourceRecords] = useState<SourceRecord[]>([]);
  const [response, setResponse] = useState("");
  const [decisions, setDecisions] = useState<IdiomReviewDecision[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    setLimit(String(remainingCount));
    setTotalEligible(remainingCount);
  }, [remainingCount]);

  const clearLoadedBatch = () => {
    setRows([]);
    setSourceRecords([]);
    setResponse("");
    setDecisions([]);
    setNotice(null);
  };

  const createData = async (showModal: boolean, successNotice?: string) => {
    const batchSize = Number(limit);
    if (!Number.isSafeInteger(batchSize) || batchSize < 0) {
      setError("Count must be a non-negative integer.");
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const [promptResponse, dataResponse] = await Promise.all([
        fetch(`/api/ai/prompt-file?path=${encodeURIComponent(PROMPT_PATH)}`),
        fetch("/api/words/idiom-review/prepare", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ batchSize }),
        }),
      ]);
      const promptJson = (await promptResponse.json()) as { text?: string; error?: string };
      const dataJson = (await dataResponse.json()) as {
        ok?: boolean;
        items?: SourceRow[];
        sourceRecords?: SourceRecord[];
        totalEligible?: number;
        error?: string;
      };
      if (!promptResponse.ok || typeof promptJson.text !== "string") {
        throw new Error(promptJson.error || "Could not load the multi-word review prompt.");
      }
      if (!dataResponse.ok || !dataJson.ok || !Array.isArray(dataJson.items) || !Array.isArray(dataJson.sourceRecords)) {
        throw new Error(dataJson.error || "Could not prepare multi-word review candidates.");
      }
      setPrompt(promptJson.text);
      setRows(dataJson.items);
      setSourceRecords(dataJson.sourceRecords);
      setTotalEligible(dataJson.totalEligible ?? dataJson.items.length);
      setResponse("");
      setDecisions([]);
      setNotice(successNotice ?? `Created ${dataJson.items.length} multi-word review candidate(s) ✓`);
      if (showModal) setOpen(true);
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  };

  const openPreview = async (responseValue = response) => {
    setBusy(true);
    setError(null);
    try {
      const raw = JSON.parse(responseValue) as unknown;
      const recordsResponse = await fetch("/api/words/idiom-review/records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decisions: raw }),
      });
      const recordsJson = (await recordsResponse.json()) as {
        ok?: boolean;
        items?: SourceRow[];
        sourceRecords?: SourceRecord[];
        decisions?: IdiomReviewDecision[];
        error?: string;
      };
      if (!recordsResponse.ok || !recordsJson.ok || !Array.isArray(recordsJson.items) ||
          !Array.isArray(recordsJson.sourceRecords) || !Array.isArray(recordsJson.decisions)) {
        throw new Error(recordsJson.error || "Could not rebuild current records from this response.");
      }
      const validated = parseIdiomReviewDecisions(
        recordsJson.decisions,
        recordsJson.items.map((row) => row.id),
      );
      setRows(recordsJson.items);
      setSourceRecords(recordsJson.sourceRecords);
      setDecisions(validated);
      setPreviewTab("changes");
      setNotice(`Validated all ${validated.length} response item(s) against current database records ✓`);
      setPreviewOpen(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  };

  const applyConfirmed = async () => {
    setBusy(true);
    setError(null);
    try {
      const applyResponse = await fetch("/api/words/idiom-review/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceRecords, decisions }),
      });
      const result = (await applyResponse.json()) as {
        ok?: boolean;
        kept?: number;
        deleted?: number;
        failedAudioFiles?: number;
        error?: string;
      };
      if (!applyResponse.ok || !result.ok) {
        throw new Error(result.error || "Could not apply multi-word review decisions.");
      }
      setPreviewOpen(false);
      setResponse("");
      router.refresh();
      await createData(
        false,
        `Marked ${result.kept ?? 0} retained WordSense record(s) as reviewed and deleted ${result.deleted ?? 0}${
          result.failedAudioFiles ? `; ${result.failedAudioFiles} owned audio cleanup(s) failed` : ""
        } ✓`,
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  };

  const rowById = useMemo(() => new Map(rows.map((row) => [row.id, row])), [rows]);
  const deleteCount = decisions.filter((decision) => decision.delete).length;
  const visibleDecisions = decisions.filter((decision) =>
    previewTab === "changes" ? decision.delete : !decision.delete,
  );
  const copyText = `${prompt}\n\n${JSON.stringify(rows, null, 2)}`;
  return (
    <>
      <button
        type="button"
        disabled={busy}
        aria-busy={busy && !open}
        onClick={() => void createData(true)}
        className="relative rounded border px-3 py-2 text-sm hover:bg-black/5 disabled:opacity-100 dark:hover:bg-white/5"
      >
        REVIEW MULTI-WORD ENTRIES <RemainingCountBadge count={remainingCount} />
        {busy && !open ? (
          <span className="absolute inset-0 flex items-center justify-center gap-1 rounded bg-background/85" aria-hidden="true">
            <span className="size-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.3s]" />
            <span className="size-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.15s]" />
            <span className="size-1.5 animate-bounce rounded-full bg-current" />
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4" role="dialog" aria-modal="true">
          <div className="flex h-[90vh] w-full max-w-7xl flex-col gap-4 rounded-2xl border border-card bg-background p-6 shadow-elevated">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-base font-semibold">Multi-word dictionary-entry review — WordSense</div>
                <div className="mt-1 text-xs opacity-70">The AI response contains only id and delete. Nothing changes before preview and final confirmation.</div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => setGuideOpen((value) => !value)} className={buttonClass}>How it works</button>
                <PromptSourcesButton paths={[PROMPT_PATH]} />
                <button type="button" disabled={busy} onClick={() => setOpen(false)} className={buttonClass}>Close</button>
              </div>
            </div>

            {guideOpen ? (
              <div dir="rtl" className="max-h-72 overflow-auto rounded border border-blue-500/30 bg-blue-500/10 p-3 text-right text-sm leading-6">
                <div className="font-semibold">هدف این مرحله</div>
                <p>فقط WordSenseهای چندکلمه‌ای که هنوز بررسی نشده‌اند وارد پرامپت می‌شوند. عبارت‌های تک‌کلمه‌ای به‌صورت خودکار بررسی‌شده محسوب می‌شوند.</p>
                <div className="mt-2 font-semibold">معنی خروجی</div>
                <ul className="list-disc pr-5">
                  <li><code>delete: false</code> یعنی این WordSense ارزش مستقل دیکشنری دارد و باقی می‌ماند.</li>
                  <li><code>delete: true</code> یعنی این WordSense ترکیب آزاد، collocation غیرمستقل یا مدخل زائد است و فقط پس از تأیید شما حذف می‌شود.</li>
                  <li>idiom، phrasal verb، compound تثبیت‌شده، fixed expression و term معتبر باید با <code>delete: false</code> حفظ شوند.</li>
                  <li>در حالت شک، پاسخ باید <code>delete: false</code> باشد.</li>
                </ul>
                <div className="mt-2 font-semibold">ایمنی</div>
                <p>پاسخ باید تمام IDها را دقیقاً یک‌بار و به همان ترتیب داشته باشد. Preview دوباره رکوردهای فعلی را از دیتابیس می‌خواند. Apply نیز تغییرات هم‌زمان را کنترل می‌کند و همهٔ تصمیم‌های همان batch را در یک تراکنش اجرا می‌کند.</p>
              </div>
            ) : null}

            {error ? <div className="rounded border border-red-500/30 bg-red-500/10 p-2 text-sm text-red-700">{error}</div> : null}
            {notice ? <div className="rounded border border-emerald-500/30 bg-emerald-500/10 p-2 text-sm text-emerald-800">{notice}</div> : null}

            <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-2">
              <section className="flex min-h-0 flex-col gap-2">
                <PromptBatchControls
                  batchSize={limit}
                  disabled={busy}
                  loadedCount={rows.length}
                  totalEligibleCount={totalEligible}
                  onBatchSizeChange={(value) => { clearLoadedBatch(); setLimit(value); }}
                />
                <div className="flex flex-wrap gap-2">
                  <button type="button" disabled={busy} onClick={() => void createData(false)} className={buttonClass}>Create data</button>
                  <button
                    type="button"
                    disabled={busy || rows.length === 0}
                    onClick={() => void navigator.clipboard.writeText(copyText)
                      .then(() => setNotice("Prompt and data copied ✓"))
                      .catch((reason) => setError(reason instanceof Error ? reason.message : String(reason)))}
                    className={buttonClass}
                  >Copy prompt + data</button>
                  <RemainingCountButton count={totalEligible} disabled={busy} onClick={() => setLimit(String(totalEligible))} />
                </div>
                <textarea readOnly value={copyText} className="min-h-0 flex-1 rounded border p-3 font-mono text-xs" />
              </section>

              <section className="flex min-h-0 flex-col gap-2">
                <b>Response JSON</b>
                <textarea
                  value={response}
                  disabled={busy}
                  onChange={(event) => setResponse(event.target.value)}
                  className="min-h-0 flex-1 rounded border p-3 font-mono text-xs"
                  placeholder='[{"id":123,"delete":true},{"id":456,"delete":false}]'
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void navigator.clipboard.readText().then(setResponse)
                      .catch((reason) => setError(reason instanceof Error ? reason.message : String(reason)))}
                    className={buttonClass}
                  >Paste response</button>
                  <button type="button" disabled={busy || !response.trim()} onClick={() => void openPreview()} className={`${buttonClass} flex-1`}>PREVIEW CHANGES</button>
                </div>
              </section>
            </div>
          </div>
        </div>
      ) : null}

      {previewOpen ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true">
          <div className="flex h-[90vh] w-full max-w-7xl flex-col gap-4 rounded-2xl border border-card bg-background p-6 shadow-elevated">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <b>Confirm multi-word review</b>
                <div className="mt-1 text-xs opacity-70">Review or change every Boolean below. Deleted WordSense records cannot be restored from this dialog.</div>
              </div>
              <button type="button" disabled={busy} onClick={() => setPreviewOpen(false)} className={buttonClass}>Back without saving</button>
            </div>
            {error ? <div className="rounded border border-red-500/30 bg-red-500/10 p-2 text-sm text-red-700">{error}</div> : null}
            <div role="tablist" aria-label="Multi-word review result groups" className="grid grid-cols-2 gap-1 rounded-2xl border border-card bg-background p-1.5">
              <button
                type="button"
                role="tab"
                aria-selected={previewTab === "changes"}
                aria-controls="idiom-review-changes-panel"
                onClick={() => setPreviewTab("changes")}
                className={`rounded-xl px-3 py-2.5 text-sm font-semibold transition ${previewTab === "changes" ? "bg-[var(--primary)] text-[var(--primary-foreground)] shadow-elevated" : "text-muted hover:bg-card hover:text-foreground"}`}
              >
                Needs changes
                <span className={`ml-2 rounded-full px-2 py-0.5 text-[10px] ${previewTab === "changes" ? "bg-white/20" : "bg-card"}`}>{deleteCount}</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={previewTab === "unchanged"}
                aria-controls="idiom-review-unchanged-panel"
                onClick={() => setPreviewTab("unchanged")}
                className={`rounded-xl px-3 py-2.5 text-sm font-semibold transition ${previewTab === "unchanged" ? "bg-[var(--primary)] text-[var(--primary-foreground)] shadow-elevated" : "text-muted hover:bg-card hover:text-foreground"}`}
              >
                No changes
                <span className={`ml-2 rounded-full px-2 py-0.5 text-[10px] ${previewTab === "unchanged" ? "bg-white/20" : "bg-card"}`}>{decisions.length - deleteCount}</span>
              </button>
            </div>
            <div
              id={previewTab === "changes" ? "idiom-review-changes-panel" : "idiom-review-unchanged-panel"}
              role="tabpanel"
              className="min-h-0 flex-1 overflow-auto rounded border"
            >
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-background">
                  <tr className="border-b">
                    <th className="px-3 py-2">id</th>
                    <th className="px-3 py-2">base_form / POS</th>
                    <th className="px-3 py-2">Persian meaning / concept</th>
                    <th className="px-3 py-2">sentences</th>
                    <th className="px-3 py-2">delete</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleDecisions.map((decision) => {
                    const row = rowById.get(decision.id);
                    return (
                      <tr key={decision.id} className={`border-b align-top ${decision.delete ? "bg-red-500/10" : "bg-emerald-500/10"}`}>
                        <td className="px-3 py-2 font-mono">{decision.id}</td>
                        <td className="px-3 py-2"><b dir="ltr">{row?.base_form ?? "Unknown"}</b><br /><span>{row?.pos || "—"}</span></td>
                        <td dir="rtl" className="max-w-md px-3 py-2 text-right">
                          <b>{row?.meaning_fa || "—"}</b>
                          {row?.other_meanings_fa.length ? <div>{row.other_meanings_fa.join("، ")}</div> : null}
                          {row?.concept_explained_fa ? <div className="mt-1 opacity-75">{row.concept_explained_fa}</div> : null}
                        </td>
                        <td className="max-w-lg px-3 py-2">
                          {row?.sentences.length ? row.sentences.map((sentence) => (
                            <div key={sentence.sentence_id} className="mb-2">
                              <span dir="ltr">#{sentence.sentence_id} — {sentence.sentence_en}</span>
                              {sentence.sentence_en_meaning_fa ? <div dir="rtl" className="text-right">{sentence.sentence_en_meaning_fa}</div> : null}
                            </div>
                          )) : "—"}
                        </td>
                        <td className="px-3 py-2">
                          <label className="inline-flex items-center gap-2 font-semibold">
                            <input
                              type="checkbox"
                              checked={decision.delete}
                              disabled={busy}
                              onChange={(event) => setDecisions((current) => current.map((item) =>
                                item.id === decision.id ? { ...item, delete: event.target.checked } : item,
                              ))}
                            />
                            {decision.delete ? "true" : "false"}
                          </label>
                        </td>
                      </tr>
                    );
                  })}
                  {!visibleDecisions.length ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-10 text-center text-sm text-muted">
                        {previewTab === "changes" ? "No records need changes." : "No records are marked as unchanged."}
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-sm">Keep and mark reviewed: {decisions.length - deleteCount} • Permanently delete WordSense: {deleteCount}</span>
              <button type="button" disabled={busy || decisions.length === 0} onClick={() => void applyConfirmed()} className={`${buttonClass} border-red-600 ${deleteCount ? "bg-red-600 text-white hover:bg-red-700" : ""}`}>
                {busy ? "APPLYING…" : "CONFIRM AND APPLY ALL"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
