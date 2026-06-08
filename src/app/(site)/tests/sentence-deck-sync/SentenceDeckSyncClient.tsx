"use client";

import { useEffect, useRef, useState } from "react";

import { PageHeader } from "@/components/page-header";

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
        skippedEmptyItems: number;
        skippedAlreadyInDeck: number;
        skippedMissingFaToEnReview: number;
        failed: number;
        currentSentenceId: number | null;
        logs: string[];
      };
    }
  | {
      ok: false;
      error: string;
    };

export default function SentenceDeckSyncClient() {
  const [isRunning, setIsRunning] = useState(false);
  const [addLimit, setAddLimit] = useState<string>("10");
  const [result, setResult] = useState<EnsureResponse | null>(null);
  const [syncResult, setSyncResult] = useState<SyncResponse | null>(null);
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

  async function fetchSyncStatus() {
    try {
      const res = await fetch("/api/tests/sentence-deck-sync/sync-all/status", {
        method: "GET",
        cache: "no-store",
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

  useEffect(() => {
    void fetchSyncStatus();
  }, []);

  useEffect(() => {
    if (!(syncResult?.ok && syncResult.status.running)) return;
    const id = setInterval(() => {
      void fetchSyncStatus();
    }, 1000);
    return () => clearInterval(id);
  }, [syncResult?.ok, syncResult?.ok ? syncResult.status.running : false]);

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
              <span className="font-mono">enSenteses</span> and the note type{" "}
              <span className="font-mono">enSenteses</span>.
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
              Add notes to <span className="font-mono">enSenteses</span> from DB
              sentences where <span className="font-mono">items</span> is
              non-empty, <span className="font-mono">sentence_en</span> is not
              already in the deck, and all referenced{" "}
              <span className="font-mono">anki_link_id</span> values have a{" "}
              <span className="font-mono">FaToEn</span> card in review. If local
              audio exists for sentence fields, corresponding sound fields are
              filled automatically.
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
                <div>
                  Skipped empty items: {syncResult.status.skippedEmptyItems}
                </div>
                <div>
                  Skipped already in deck:{" "}
                  {syncResult.status.skippedAlreadyInDeck}
                </div>
                <div>
                  Skipped missing FaToEn review:{" "}
                  {syncResult.status.skippedMissingFaToEnReview}
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
      </div>
    </main>
  );
}
