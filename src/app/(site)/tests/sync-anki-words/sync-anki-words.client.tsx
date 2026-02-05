"use client";

import { useEffect, useMemo, useState } from "react";

import { PageHeader } from "@/components/page-header";
import { createAnkiConnectClient } from "@/lib/AnkiConnect";

type OtherMeaningsFaSyncAllStatus = {
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
  updated: number;
  skippedSame: number;
  skippedNoLinkId: number;
  skippedNoWord: number;
  failed: number;
  mediaUploaded: number;
  mediaDeleted: number;
  currentNoteId: number | null;
};

type LogEntry = {
  ts: string;
  level: "info" | "error";
  message: string;
  data?: unknown;
};

function nowIso() {
  return new Date().toISOString();
}

function formatForLog(entry: LogEntry) {
  const prefix = `[${entry.ts}] ${entry.level.toUpperCase()}: ${entry.message}`;
  if (entry.data === undefined) return prefix;
  try {
    return `${prefix}\n${JSON.stringify(entry.data, null, 2)}`;
  } catch {
    return `${prefix}\n${String(entry.data)}`;
  }
}

export default function SyncAnkiWordsClient() {
  const client = useMemo(
    () => createAnkiConnectClient({ timeoutMs: 15_000, retryDelayMs: 750 }),
    [],
  );

  const [isRunning, setIsRunning] = useState(false);
  const [permissionText, setPermissionText] = useState<string | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [preview, setPreview] = useState<unknown | null>(null);
  const [status, setStatus] = useState<OtherMeaningsFaSyncAllStatus | null>(null);

  function append(entry: Omit<LogEntry, "ts">) {
    setLog((prev) => [...prev, { ts: nowIso(), ...entry }]);
  }

  async function requestPermission() {
    const res = await client.requestDetailed("requestPermission");
    if (!res.ok) {
      append({ level: "error", message: "requestPermission failed", data: res.error });
      return;
    }
    const permission = res.result?.permission ?? "unknown";
    setPermissionText(permission);
    append({ level: "info", message: `Permission: ${permission}` });
  }

  async function startSyncOtherMeaningsFa() {
    if (isRunning || status?.running) return;
    setIsRunning(true);
    setPreview(null);

    try {
      append({ level: "info", message: "Starting sync other_meanings_fa (all notes)..." });
      const res = await fetch("/api/tests/sync-anki-words/other-meanings-fa/sync-all/start", { method: "POST" });
      const data = (await res.json()) as { status?: OtherMeaningsFaSyncAllStatus } | unknown;
      setPreview(data);
      if (data && typeof data === "object" && "status" in data) {
        const s = (data as { status?: OtherMeaningsFaSyncAllStatus }).status ?? null;
        setStatus(s);
      }
      append({ level: res.ok ? "info" : "error", message: "Start result", data });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      append({ level: "error", message: "Unexpected error", data: message });
    } finally {
      setIsRunning(false);
    }
  }

  useEffect(() => {
    let timer: number | null = null;
    let stopped = false;

    async function tick() {
      try {
        const res = await fetch("/api/tests/sync-anki-words/other-meanings-fa/sync-all/status", { cache: "no-store" });
        const json = (await res.json()) as { ok?: boolean; status?: OtherMeaningsFaSyncAllStatus };
        const s = json?.status ?? null;
        setStatus(s);
        if (s?.done) {
          if (timer != null) window.clearInterval(timer);
          timer = null;
        }
      } catch {
        // ignore transient errors while polling
      }
    }

    void tick();
    timer = window.setInterval(() => {
      if (stopped) return;
      void tick();
    }, 1000);

    return () => {
      stopped = true;
      if (timer != null) window.clearInterval(timer);
    };
  }, []);

  const skippedTotal =
    (status?.skippedSame ?? 0) + (status?.skippedNoLinkId ?? 0) + (status?.skippedNoWord ?? 0);

  return (
    <main className="mx-auto w-full max-w-6xl select-text p-4">
      <div className="flex flex-col gap-4">
        <PageHeader
          title="Sync Anki/Words"
          subtitle="Internal tool for syncing Anki note fields from the DB (starting with sentence_en)."
        />

        <div className="grid gap-3 rounded-2xl border border-card bg-background p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs text-muted">
              {permissionText ? (
                <span>
                  Permission: <span className="font-semibold">{permissionText}</span>
                </span>
              ) : (
                <span>Permission: unknown</span>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void requestPermission()}
                className="h-10 rounded-xl border border-card bg-background px-3 text-sm font-semibold text-foreground transition hover:bg-black/5 dark:hover:bg-white/5"
              >
                Request permission
              </button>
              <button
                type="button"
                onClick={() => void startSyncOtherMeaningsFa()}
                disabled={isRunning || Boolean(status?.running)}
                className="h-10 rounded-xl bg-foreground px-3 text-sm font-semibold text-background transition disabled:opacity-50"
              >
                Sync other_meanings_fa
              </button>
              <button
                type="button"
                onClick={() => {
                  setLog([]);
                  setPreview(null);
                }}
                className="h-10 rounded-xl border border-card bg-background px-3 text-sm font-semibold text-foreground transition hover:bg-black/5 dark:hover:bg-white/5"
              >
                Clear log
              </button>
            </div>
          </div>

          <div className="text-xs text-muted">
            {status ? (
              <span>
                other_meanings_fa: Processed{" "}
                <span className="font-semibold">{status.processed}/{status.total}</span> • Updated{" "}
                <span className="font-semibold">{status.updated}</span> • Skipped{" "}
                <span className="font-semibold">{skippedTotal}</span> • Failed{" "}
                <span className="font-semibold">{status.failed}</span>
              </span>
            ) : (
              <span>other_meanings_fa: Processed 0/0 • Updated 0 • Skipped 0 • Failed 0</span>
            )}
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <div className="grid gap-2">
              <div className="text-xs font-semibold text-muted">Log</div>
              <pre className="min-h-[16rem] whitespace-pre-wrap break-words rounded-xl border border-card bg-background p-3 font-mono text-xs text-foreground">
                {log.length ? log.map(formatForLog).join("\n\n") : "No logs yet."}
              </pre>
            </div>

            <div className="grid gap-2">
              <div className="text-xs font-semibold text-muted">Preview</div>
              <pre className="min-h-[16rem] whitespace-pre-wrap break-words rounded-xl border border-card bg-background p-3 font-mono text-xs text-foreground">
                {preview ? JSON.stringify(preview, null, 2) : "No preview yet."}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
