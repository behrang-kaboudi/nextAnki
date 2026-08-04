"use client";

import { useEffect, useRef, useState } from "react";

import { PageHeader } from "@/components/page-header";
import { AnkiNoteTypes, SentenceAnkiConstants } from "@/lib/anki";
import { JOB_PROGRESS_TOPICS } from "@/lib/progress/topics";
import { useJobProgress } from "@/lib/progress/useJobProgress";

type EnsureResponse =
  | {
      ok: true;
      deckName: string;
      modelName: string;
      fields: string[];
      deckCreated: boolean;
      modelCreated: boolean;
      addedFields: string[];
    }
  | {
      ok: false;
      error: string;
    };

type SyncResponse =
  | {
      ok: true;
      status: {
        jobId: string;
        running: boolean;
        done: boolean;
        startedAt: string | null;
        finishedAt: string | null;
        error: string | null;
        stopRequested: boolean;
        stoppedEarly: boolean;
        total: number;
        processed: number;
        targetAddCount: number;
        eligible: number;
        added: number;
        updated: number;
        skippedSame: number;
        skippedAlreadyInDeck: number;
        failed: number;
        currentSentenceId: number | null;
        logs: string[];
      };
    }
  | {
      ok: false;
      error: string;
    };

type SelectedSyncResponse =
  | {
      ok: true;
      requested: number;
      matched: number;
      notFound: number;
      eligible: number;
      added: number;
      updated: number;
      skippedSame: number;
      skippedAlreadyInDeck: number;
      failed: number;
      logs: string[];
      addedItems: Array<{
        sentenceId: number;
        sentence_en: string;
        noteId: number;
      }>;
      notFoundItems: string[];
    }
  | {
      ok: false;
      error: string;
      logs?: string[];
    };

type SentenceDeckStatus = Extract<SyncResponse, { ok: true }>["status"];

const SELECTED_SYNC_EXAMPLE = `[
  {
    "sentence_en": "The man waited quietly at the bus stop."
  },
  {
    "sentence_en": "People gathered outside the building after work."
  }
]`;

export default function SentenceDeckSyncClient() {
  const { status: streamedStatus } = useJobProgress<SentenceDeckStatus>(
    JOB_PROGRESS_TOPICS.sentenceDeck,
  );
  const [isRunning, setIsRunning] = useState(false);
  const [addLimit, setAddLimit] = useState<string>("10");
  const [result, setResult] = useState<EnsureResponse | null>(null);
  const [syncResult, setSyncResult] = useState<SyncResponse | null>(null);
  const [selectedModalOpen, setSelectedModalOpen] = useState(false);
  const [selectedInput, setSelectedInput] = useState(SELECTED_SYNC_EXAMPLE);
  const [selectedSyncing, setSelectedSyncing] = useState(false);
  const [selectedResult, setSelectedResult] =
    useState<SelectedSyncResponse | null>(null);
  const [selectedError, setSelectedError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const logBoxRef = useRef<HTMLDivElement | null>(null);

  const isSyncing = Boolean(syncResult?.ok && syncResult.status.running);
  const parsedLimit = Math.max(1, Math.trunc(Number(addLimit || "10") || 10));
  const targetCount = syncResult?.ok
    ? syncResult.status.targetAddCount
    : parsedLimit;
  const addedCount = syncResult?.ok ? syncResult.status.added : 0;
  const remainingCount = Math.max(0, targetCount - addedCount);
  const countdownPercent =
    targetCount > 0
      ? Math.max(0, Math.min(100, (remainingCount / targetCount) * 100))
      : 0;
  const countdownWidthClass =
    countdownPercent <= 0
      ? "w-0"
      : countdownPercent <= 10
        ? "w-[10%]"
        : countdownPercent <= 20
          ? "w-[20%]"
          : countdownPercent <= 30
            ? "w-[30%]"
            : countdownPercent <= 40
              ? "w-[40%]"
              : countdownPercent <= 50
                ? "w-1/2"
                : countdownPercent <= 60
                  ? "w-[60%]"
                  : countdownPercent <= 70
                    ? "w-[70%]"
                    : countdownPercent <= 80
                      ? "w-[80%]"
                      : countdownPercent <= 90
                        ? "w-[90%]"
                        : "w-full";

  useEffect(() => {
    const el = logBoxRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [logs.length]);

  async function handleCreate() {
    if (isRunning) return;

    setIsRunning(true);
    setResult(null);

    try {
      const res = await fetch("/api/tests/sentence-deck-sync/ensure", {
        method: "POST",
      });
      const data = (await res.json()) as EnsureResponse;
      setResult(data);
    } catch (error) {
      setResult({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setIsRunning(false);
    }
  }

  async function handleSync() {
    if (isSyncing) return;

    setLogs(["Starting sentence deck sync..."]);

    try {
      const res = await fetch("/api/tests/sentence-deck-sync/sync-all/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ limit: parsedLimit }),
      });
      const data = (await res.json()) as SyncResponse;
      setSyncResult(data);
      if (data.ok) {
        setLogs(data.status.logs ?? []);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setSyncResult({ ok: false, error: message });
      setLogs([`Error: ${message}`]);
    }
  }

  async function handleStopSync() {
    try {
      const res = await fetch("/api/tests/sentence-deck-sync/sync-all/stop", {
        method: "POST",
      });
      const data = (await res.json()) as SyncResponse;
      setSyncResult(data);
      if (data.ok) {
        setLogs(data.status.logs ?? []);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setSyncResult({ ok: false, error: message });
      setLogs([`Error: ${message}`]);
    }
  }

  async function handleSelectedSync() {
    if (selectedSyncing) return;

    setSelectedSyncing(true);
    setSelectedError(null);
    setSelectedResult(null);

    try {
      const parsed = JSON.parse(selectedInput) as unknown;
      if (!Array.isArray(parsed)) {
        throw new Error("JSON باید یک آرایه باشد.");
      }

      for (const item of parsed) {
        if (
          !item ||
          typeof item !== "object" ||
          Array.isArray(item) ||
          typeof (item as { sentence_en?: unknown }).sentence_en !== "string"
        ) {
          throw new Error(
            'هر آیتم باید دقیقاً فیلد string به نام "sentence_en" داشته باشد.',
          );
        }
      }

      const res = await fetch("/api/tests/sentence-deck-sync/sync-selected", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ rows: parsed }),
      });
      const data = (await res.json()) as SelectedSyncResponse;
      setSelectedResult(data);
      if (data.ok) {
        setLogs(data.logs ?? []);
      } else {
        setSelectedError(data.error);
        setLogs(data.logs?.length ? data.logs : [`Error: ${data.error}`]);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setSelectedError(message);
      setLogs([`Error: ${message}`]);
    } finally {
      setSelectedSyncing(false);
    }
  }

  useEffect(() => {
    if (!streamedStatus) return;
    setSyncResult({ ok: true, status: streamedStatus });
    setLogs(streamedStatus.logs ?? []);
  }, [streamedStatus]);

  return (
    <main className="mx-auto w-full max-w-4xl p-4">
      <div className="grid gap-4">
        <PageHeader
          title="Sentence Cards Management"
          subtitle="Create the sentence deck and note type scaffold in Anki."
        />

        <div className="rounded-2xl border border-card bg-background p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-muted">
              This page currently only ensures the Anki deck{" "}
              <span className="font-mono">{SentenceAnkiConstants.decks.EnSentences}</span> and the note type{" "}
              <span className="font-mono">{AnkiNoteTypes.EN_SENTENCES}</span>.
            </div>
            <button
              type="button"
              onClick={() => void handleCreate()}
              disabled={isRunning}
              className="rounded-xl border border-card bg-background px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-60 dark:hover:bg-white/5"
            >
              {isRunning ? "در حال ساخت..." : "ساخت"}
            </button>
          </div>

          <div className="mt-4 text-sm opacity-80">
            Fields: <span className="font-mono">sentence_en</span>,{" "}
            <span className="font-mono">sentence_en_sound</span>,{" "}
            <span className="font-mono">sentence_en_meaning_fa</span>,{" "}
            <span className="font-mono">sentence_en_meaning_fa_sound</span>,{" "}
            <span className="font-mono">updatedAt</span>
          </div>
        </div>

        <div className="rounded-2xl border border-card bg-gradient-to-br from-emerald-50/90 via-white to-cyan-50/80 p-4 shadow-[0_12px_40px_-24px_rgba(6,95,70,0.55)] dark:from-emerald-950/30 dark:via-background dark:to-cyan-950/20">
          <div className="grid gap-4">
            <div className="text-sm text-muted">
              Add notes to <span className="font-mono">{SentenceAnkiConstants.decks.EnSentences}</span> from DB
              sentences. Existing sentence notes are updated when DB fields,
              local audio sound tags, or <span className="font-mono">updatedAt</span>{" "}
              changed.
            </div>

            <div className="rounded-xl border border-emerald-200/80 bg-white/70 p-3 dark:border-emerald-900/60 dark:bg-black/10">
              <div className="flex flex-wrap items-end gap-3">
                <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-emerald-800 dark:text-emerald-300">
                  تعداد افزودن
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={addLimit}
                    onChange={(event) => setAddLimit(event.target.value)}
                    disabled={isSyncing}
                    className="w-28 rounded-lg border border-emerald-300 bg-white px-3 py-2 text-sm font-semibold text-emerald-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 disabled:cursor-not-allowed disabled:opacity-60 dark:border-emerald-700 dark:bg-background dark:text-emerald-100 dark:focus:ring-emerald-900"
                  />
                </label>

                <button
                  type="button"
                  onClick={() => void handleSync()}
                  disabled={isSyncing}
                  className="rounded-xl border border-emerald-600 bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-emerald-900/20 transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSyncing ? "در حال افزودن..." : "افزودن نوت جمله‌ها"}
                </button>
                <button
                  type="button"
                  onClick={() => void handleStopSync()}
                  disabled={!isSyncing}
                  className="rounded-xl border border-rose-600 bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-rose-900/20 transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  استاپ افزودن
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedModalOpen(true);
                    setSelectedError(null);
                  }}
                  disabled={isSyncing}
                  className="rounded-xl border border-sky-600 bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-sky-900/20 transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  افزودن از JSON
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLogs([]);
                    setSyncResult(null);
                  }}
                  disabled={isSyncing}
                  className="rounded-xl border border-card bg-background px-4 py-2 text-sm transition hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-60 dark:hover:bg-white/5"
                >
                  پاک کردن لاگ
                </button>
              </div>

              <div className="mt-4 grid gap-2">
                <div className="flex items-center justify-between text-xs font-semibold text-emerald-900 dark:text-emerald-200">
                  <span>شمارش معکوس افزودن</span>
                  <span>
                    باقی‌مانده: {remainingCount} / هدف: {targetCount}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-emerald-100 dark:bg-emerald-900/40">
                  <div
                    className={`h-full rounded-full bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 transition-all duration-300 ${countdownWidthClass}`}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {result ? (
          <div className="rounded-2xl border border-card bg-background p-4 text-sm">
            {result.ok ? (
              <div className="grid gap-2">
                <div className="font-semibold">Operation completed.</div>
                <div>
                  Deck: <span className="font-mono">{result.deckName}</span> |
                  Note type:{" "}
                  <span className="font-mono">{result.modelName}</span>
                </div>
                <div>
                  Deck status:{" "}
                  {result.deckCreated ? "created" : "already existed"}
                </div>
                <div>
                  Note type status:{" "}
                  {result.modelCreated ? "created" : "already existed"}
                </div>
                <div>
                  Added missing fields:{" "}
                  {result.addedFields.length
                    ? result.addedFields.join(", ")
                    : "none"}
                </div>
              </div>
            ) : (
              <div className="text-red-600 dark:text-red-400">
                Error: {result.error}
              </div>
            )}
          </div>
        ) : null}

        {syncResult ? (
          <div className="rounded-2xl border border-card bg-background p-4 text-sm">
            {syncResult.ok ? (
              <div className="grid gap-2">
                <div className="font-semibold">
                  {syncResult.status.running
                    ? "Sentence sync is running..."
                    : "Sentence sync finished."}
                </div>
                <div>Target add count: {syncResult.status.targetAddCount}</div>
                <div>
                  Processed: {syncResult.status.processed} /{" "}
                  {syncResult.status.total}
                </div>
                <div>Eligible: {syncResult.status.eligible}</div>
                <div>Added: {syncResult.status.added}</div>
                <div>Updated: {syncResult.status.updated}</div>
                <div>Skipped same: {syncResult.status.skippedSame}</div>
                <div>
                  Skipped already in deck:{" "}
                  {syncResult.status.skippedAlreadyInDeck}
                </div>
                <div>Failed: {syncResult.status.failed}</div>
                <div>
                  Stop requested:{" "}
                  {syncResult.status.stopRequested ? "yes" : "no"}
                </div>
                <div>
                  Stopped early: {syncResult.status.stoppedEarly ? "yes" : "no"}
                </div>
                {syncResult.status.error ? (
                  <div>Error: {syncResult.status.error}</div>
                ) : null}
              </div>
            ) : (
              <div className="text-red-600 dark:text-red-400">
                Error: {syncResult.error}
              </div>
            )}
          </div>
        ) : null}

        <div className="rounded-2xl border border-card bg-background p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="text-sm font-semibold">Log</div>
            <div className="text-xs opacity-70">{logs.length} line(s)</div>
          </div>
          <div
            ref={logBoxRef}
            className="max-h-96 overflow-auto rounded-xl border border-card bg-black/5 p-3 font-mono text-xs dark:bg-white/5"
          >
            {logs.length ? (
              <pre className="whitespace-pre-wrap break-words">
                {logs.join("\n")}
              </pre>
            ) : (
              <div className="text-xs text-muted">No logs yet.</div>
            )}
          </div>
        </div>

        {selectedModalOpen ? (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
            role="dialog"
            aria-modal="true"
          >
            <div
              dir="rtl"
              lang="fa"
              className="flex h-[86vh] w-full max-w-3xl flex-col rounded border bg-background p-4 text-right shadow-lg"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-base font-semibold">
                    افزودن جمله‌های انتخابی به Anki
                  </div>
                  <div className="mt-1 text-xs opacity-80">
                    ورودی باید آرایه‌ای از آبجکت‌های{" "}
                    <span className="font-mono">sentence_en</span> باشد.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedModalOpen(false)}
                  className="rounded border px-2 py-1 text-sm hover:bg-black/5 dark:hover:bg-white/5"
                >
                  Close
                </button>
              </div>

              <div className="mt-4 grid min-h-0 flex-1 gap-4 overflow-auto">
                <section className="rounded border p-3 text-sm leading-6">
                  <div className="text-xs font-semibold">راهنما</div>
                  <ul className="mt-2 list-disc space-y-1 ps-5">
                    <li>
                      سیستم جمله‌ها را با مقدار دقیق{" "}
                      <span className="font-mono">sentence_en</span> در جدول{" "}
                      <span className="font-mono">Sentence</span> پیدا می‌کند.
                    </li>
                    <li>
                      جمله‌هایی که مقدار{" "}
                      <span className="font-mono">sentence_en</span> آن‌ها
                      قبلاً در deck و note type جمله‌ها وجود داشته باشد، در
                      صورت تغییر فیلدها یا صوت آپدیت می‌شوند.
                    </li>
                    <li>
                      اگر برای فیلدهای جمله فایل صوتی محلی موجود باشد، فیلدهای
                      sound هم مثل sync اصلی پر می‌شوند.
                    </li>
                  </ul>
                </section>

                <label className="grid min-h-[260px] gap-2 text-xs font-semibold">
                  JSON
                  <textarea
                    dir="ltr"
                    value={selectedInput}
                    onChange={(event) => setSelectedInput(event.target.value)}
                    className="min-h-0 resize-none rounded border bg-transparent p-3 text-left font-mono text-xs font-normal outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200 dark:focus:ring-sky-900"
                    spellCheck={false}
                  />
                </label>

                {selectedError ? (
                  <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
                    {selectedError}
                  </div>
                ) : null}

                {selectedResult?.ok ? (
                  <div className="grid gap-2 rounded border p-3 text-sm">
                    <div className="font-semibold">نتیجه</div>
                    <div>Requested: {selectedResult.requested}</div>
                    <div>Matched: {selectedResult.matched}</div>
                    <div>Not found: {selectedResult.notFound}</div>
                    <div>Eligible: {selectedResult.eligible}</div>
                    <div>Added: {selectedResult.added}</div>
                    <div>Updated: {selectedResult.updated}</div>
                    <div>Skipped same: {selectedResult.skippedSame}</div>
                    <div>
                      Skipped already in deck:{" "}
                      {selectedResult.skippedAlreadyInDeck}
                    </div>
                    <div>Failed: {selectedResult.failed}</div>
                  </div>
                ) : null}
              </div>

              <div className="mt-4 flex flex-wrap justify-end gap-2 border-t pt-4">
                <button
                  type="button"
                  onClick={() => setSelectedInput(SELECTED_SYNC_EXAMPLE)}
                  disabled={selectedSyncing}
                  className="rounded border px-3 py-2 text-sm hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-white/5"
                >
                  نمونه
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedInput("");
                    setSelectedResult(null);
                    setSelectedError(null);
                  }}
                  disabled={selectedSyncing}
                  className="rounded border px-3 py-2 text-sm hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-white/5"
                >
                  پاک کردن
                </button>
                <button
                  type="button"
                  onClick={() => void handleSelectedSync()}
                  disabled={selectedSyncing || isSyncing}
                  className="rounded border border-sky-600 bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {selectedSyncing ? "در حال افزودن..." : "پیدا کن و اضافه کن"}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}
