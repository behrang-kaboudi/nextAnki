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
      scanned: number;
      eligible: number;
      added: number;
      skippedEmptyItems: number;
      skippedAlreadyInDeck: number;
      skippedMissingFaToEnReview: number;
      logs: string[];
      addedItems: Array<{ sentenceId: number; sentence_en: string; noteId: number }>;
    }
  | {
      ok: false;
      error: string;
      logs: string[];
    };

export default function SentenceDeckSyncClient() {
  const [isRunning, setIsRunning] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [result, setResult] = useState<EnsureResponse | null>(null);
  const [syncResult, setSyncResult] = useState<SyncResponse | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const logBoxRef = useRef<HTMLDivElement | null>(null);

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

    setIsSyncing(true);
    setSyncResult(null);
    setLogs(["Starting sentence deck sync..."]);

    try {
      const res = await fetch("/api/tests/sentence-deck-sync/sync", {
        method: "POST",
      });
      const data = (await res.json()) as SyncResponse;
      setSyncResult(data);
      setLogs(data.logs ?? []);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setSyncResult({ ok: false, error: message, logs: [`Error: ${message}`] });
      setLogs([`Error: ${message}`]);
    } finally {
      setIsSyncing(false);
    }
  }

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
              This page currently only ensures the Anki deck <span className="font-mono">enSenteses</span>
              {" "}and the note type <span className="font-mono">enSenteses</span>.
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

        <div className="rounded-2xl border border-card bg-background p-4">
          <div className="grid gap-3">
            <div className="text-sm text-muted">
              Add notes to <span className="font-mono">enSenteses</span> from DB sentences where{" "}
              <span className="font-mono">items</span> is non-empty,{" "}
              <span className="font-mono">sentence_en</span> is not already in the deck, and all
              referenced <span className="font-mono">anki_link_id</span> values have a{" "}
              <span className="font-mono">FaToEn</span> card in review.
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => void handleSync()}
                disabled={isSyncing}
                className="rounded-xl border border-card bg-background px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-60 dark:hover:bg-white/5"
              >
                {isSyncing ? "در حال افزودن..." : "افزودن نوت جمله‌ها"}
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
          </div>
        </div>

        {result ? (
          <div className="rounded-2xl border border-card bg-background p-4 text-sm">
            {result.ok ? (
              <div className="grid gap-2">
                <div className="font-semibold">Operation completed.</div>
                <div>
                  Deck: <span className="font-mono">{result.deckName}</span> | Note type:{" "}
                  <span className="font-mono">{result.modelName}</span>
                </div>
                <div>
                  Deck status: {result.deckCreated ? "created" : "already existed"}
                </div>
                <div>
                  Note type status: {result.modelCreated ? "created" : "already existed"}
                </div>
                <div>
                  Added missing fields:{" "}
                  {result.addedFields.length ? result.addedFields.join(", ") : "none"}
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
                <div className="font-semibold">Sentence sync completed.</div>
                <div>Scanned: {syncResult.scanned}</div>
                <div>Eligible: {syncResult.eligible}</div>
                <div>Added: {syncResult.added}</div>
                <div>Skipped empty items: {syncResult.skippedEmptyItems}</div>
                <div>Skipped already in deck: {syncResult.skippedAlreadyInDeck}</div>
                <div>Skipped missing FaToEn review: {syncResult.skippedMissingFaToEnReview}</div>
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
              <pre className="whitespace-pre-wrap break-words">{logs.join("\n")}</pre>
            ) : (
              <div className="text-xs text-muted">No logs yet.</div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
