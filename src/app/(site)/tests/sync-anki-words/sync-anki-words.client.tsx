"use client";

import { useEffect, useMemo, useState } from "react";

import { PageHeader } from "@/components/page-header";
import { createAnkiConnectClient } from "@/lib/AnkiConnect";

type SyncAllStatus = {
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
  created?: number;
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
  const [jsonHintStatus, setJsonHintStatus] = useState<SyncAllStatus | null>(null);
  const [mediaSyncStatus, setMediaSyncStatus] = useState<SyncAllStatus | null>(null);
  const [fullSyncStatus, setFullSyncStatus] = useState<SyncAllStatus | null>(null);
  const [dedupStatus, setDedupStatus] = useState<SyncAllStatus | null>(null);
  const [otherMeaningsFaStatus, setOtherMeaningsFaStatus] = useState<SyncAllStatus | null>(null);
  const [sentenceEnStatus, setSentenceEnStatus] = useState<SyncAllStatus | null>(null);
  const [sentenceEnMeaningFaStatus, setSentenceEnMeaningFaStatus] = useState<SyncAllStatus | null>(null);

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

  async function startSyncJsonHint() {
    if (isRunning || jsonHintStatus?.running) return;
    setIsRunning(true);
    setPreview(null);

    try {
      append({ level: "info", message: "Starting sync json_hint + first_letter_*_hint (all notes)..." });
      const res = await fetch("/api/tests/sync-anki-words/json-hint/sync-all/start", { method: "POST" });
      const data = (await res.json()) as { status?: SyncAllStatus } | unknown;
      setPreview(data);
      if (data && typeof data === "object" && "status" in data) {
        const s = (data as { status?: SyncAllStatus }).status ?? null;
        setJsonHintStatus(s);
      }
      append({ level: res.ok ? "info" : "error", message: "Start result", data });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      append({ level: "error", message: "Unexpected error", data: message });
    } finally {
      setIsRunning(false);
    }
  }

  async function startSyncSentenceEn() {
    if (isRunning || sentenceEnStatus?.running) return;
    setIsRunning(true);
    setPreview(null);

    try {
      append({ level: "info", message: "Starting sync sentence_en (all notes)..." });
      const res = await fetch("/api/tests/sync-anki-words/sentence-en/sync-all/start", { method: "POST" });
      const data = (await res.json()) as { status?: SyncAllStatus } | unknown;
      setPreview(data);
      if (data && typeof data === "object" && "status" in data) {
        const s = (data as { status?: SyncAllStatus }).status ?? null;
        setSentenceEnStatus(s);
      }
      append({ level: res.ok ? "info" : "error", message: "Start result", data });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      append({ level: "error", message: "Unexpected error", data: message });
    } finally {
      setIsRunning(false);
    }
  }

  async function startSyncSentenceEnMeaningFa() {
    if (isRunning || sentenceEnMeaningFaStatus?.running) return;
    setIsRunning(true);
    setPreview(null);

    try {
      append({ level: "info", message: "Starting sync sentence_en_meaning_fa (all notes)..." });
      const res = await fetch("/api/tests/sync-anki-words/sentence-en-meaning-fa/sync-all/start", { method: "POST" });
      const data = (await res.json()) as { status?: SyncAllStatus } | unknown;
      setPreview(data);
      if (data && typeof data === "object" && "status" in data) {
        const s = (data as { status?: SyncAllStatus }).status ?? null;
        setSentenceEnMeaningFaStatus(s);
      }
      append({ level: res.ok ? "info" : "error", message: "Start result", data });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      append({ level: "error", message: "Unexpected error", data: message });
    } finally {
      setIsRunning(false);
    }
  }

  async function startSyncOtherMeaningsFa() {
    if (isRunning || otherMeaningsFaStatus?.running) return;
    setIsRunning(true);
    setPreview(null);

    try {
      append({ level: "info", message: "Starting sync other_meanings_fa (all notes)..." });
      const res = await fetch("/api/tests/sync-anki-words/other-meanings-fa/sync-all/start", { method: "POST" });
      const data = (await res.json()) as { status?: SyncAllStatus } | unknown;
      setPreview(data);
      if (data && typeof data === "object" && "status" in data) {
        const s = (data as { status?: SyncAllStatus }).status ?? null;
        setOtherMeaningsFaStatus(s);
      }
      append({ level: res.ok ? "info" : "error", message: "Start result", data });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      append({ level: "error", message: "Unexpected error", data: message });
    } finally {
      setIsRunning(false);
    }
  }

  async function startSyncAllMedia() {
    if (isRunning || mediaSyncStatus?.running) return;
    setIsRunning(true);
    setPreview(null);

    try {
      append({ level: "info", message: "Starting media copy (pictureWord + words)..." });
      const res = await fetch("/api/tests/sync-anki-words/media/sync-all/start", { method: "POST" });
      const data = (await res.json()) as { status?: SyncAllStatus } | unknown;
      setPreview(data);
      if (data && typeof data === "object" && "status" in data) {
        const s = (data as { status?: SyncAllStatus }).status ?? null;
        setMediaSyncStatus(s);
      }
      append({ level: res.ok ? "info" : "error", message: "Start result", data });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      append({ level: "error", message: "Unexpected error", data: message });
    } finally {
      setIsRunning(false);
    }
  }

  async function startFullSyncAll() {
    if (isRunning || fullSyncStatus?.running) return;
    setIsRunning(true);
    setPreview(null);

    try {
      append({ level: "info", message: "Starting FULL sync (DB -> Anki)..." });
      const res = await fetch("/api/tests/sync-anki-words/full/sync-all/start", { method: "POST" });
      const data = (await res.json()) as { status?: SyncAllStatus } | unknown;
      setPreview(data);
      if (data && typeof data === "object" && "status" in data) {
        const s = (data as { status?: SyncAllStatus }).status ?? null;
        setFullSyncStatus(s);
      }
      append({ level: res.ok ? "info" : "error", message: "Start result", data });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      append({ level: "error", message: "Unexpected error", data: message });
    } finally {
      setIsRunning(false);
    }
  }

  async function deduplicateAnkiLinkIdKeepOldest() {
    if (isRunning || dedupStatus?.running) return;
    setIsRunning(true);
    setPreview(null);

    try {
      append({ level: "info", message: "Deduplicating notes by anki_link_id (keep oldest noteId)..." });
      const res = await fetch("/api/tests/sync-anki-words/anki-link-id/deduplicate/start", { method: "POST" });
      const data = (await res.json()) as { status?: SyncAllStatus } | unknown;
      setPreview(data);
      if (data && typeof data === "object" && "status" in data) {
        const s = (data as { status?: SyncAllStatus }).status ?? null;
        setDedupStatus(s);
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
        const [jsonHintRes, mediaRes, fullRes, dedupRes, otherRes, sentenceEnRes, sentenceMeaningRes] = await Promise.all([
          fetch("/api/tests/sync-anki-words/json-hint/sync-all/status", { cache: "no-store" }),
          fetch("/api/tests/sync-anki-words/media/sync-all/status", { cache: "no-store" }),
          fetch("/api/tests/sync-anki-words/full/sync-all/status", { cache: "no-store" }),
          fetch("/api/tests/sync-anki-words/anki-link-id/deduplicate/status", { cache: "no-store" }),
          fetch("/api/tests/sync-anki-words/other-meanings-fa/sync-all/status", { cache: "no-store" }),
          fetch("/api/tests/sync-anki-words/sentence-en/sync-all/status", { cache: "no-store" }),
          fetch("/api/tests/sync-anki-words/sentence-en-meaning-fa/sync-all/status", { cache: "no-store" }),
        ]);

        const jsonHintJson = (await jsonHintRes.json()) as { ok?: boolean; status?: SyncAllStatus };
        const mediaJson = (await mediaRes.json()) as { ok?: boolean; status?: SyncAllStatus };
        const fullJson = (await fullRes.json()) as { ok?: boolean; status?: SyncAllStatus };
        const dedupJson = (await dedupRes.json()) as { ok?: boolean; status?: SyncAllStatus };
        const otherJson = (await otherRes.json()) as { ok?: boolean; status?: SyncAllStatus };
        const sentenceEnJson = (await sentenceEnRes.json()) as { ok?: boolean; status?: SyncAllStatus };
        const sentenceMeaningJson = (await sentenceMeaningRes.json()) as { ok?: boolean; status?: SyncAllStatus };

        const jsonHint = jsonHintJson?.status ?? null;
        const media = mediaJson?.status ?? null;
        const full = fullJson?.status ?? null;
        const dedup = dedupJson?.status ?? null;
        const other = otherJson?.status ?? null;
        const sentenceEn = sentenceEnJson?.status ?? null;
        const sentenceMeaning = sentenceMeaningJson?.status ?? null;
        setJsonHintStatus(jsonHint);
        setMediaSyncStatus(media);
        setFullSyncStatus(full);
        setDedupStatus(dedup);
        setOtherMeaningsFaStatus(other);
        setSentenceEnStatus(sentenceEn);
        setSentenceEnMeaningFaStatus(sentenceMeaning);

        const jsonHintDone = Boolean(jsonHint?.done);
        const mediaDone = Boolean(media?.done);
        const fullDone = Boolean(full?.done);
        const dedupDone = Boolean(dedup?.done);
        const otherDone = Boolean(other?.done);
        const sentenceEnDone = Boolean(sentenceEn?.done);
        const sentenceMeaningDone = Boolean(sentenceMeaning?.done);
        if (jsonHintDone && mediaDone && fullDone && dedupDone && otherDone && sentenceEnDone && sentenceMeaningDone) {
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

  const sentenceEnSkippedTotal =
    (sentenceEnStatus?.skippedSame ?? 0) +
    (sentenceEnStatus?.skippedNoLinkId ?? 0) +
    (sentenceEnStatus?.skippedNoWord ?? 0);

  const jsonHintSkippedTotal =
    (jsonHintStatus?.skippedSame ?? 0) +
    (jsonHintStatus?.skippedNoLinkId ?? 0) +
    (jsonHintStatus?.skippedNoWord ?? 0);

  const mediaSkippedTotal =
    (mediaSyncStatus?.skippedSame ?? 0) +
    (mediaSyncStatus?.skippedNoLinkId ?? 0) +
    (mediaSyncStatus?.skippedNoWord ?? 0);

  const fullSkippedTotal =
    (fullSyncStatus?.skippedSame ?? 0) +
    (fullSyncStatus?.skippedNoLinkId ?? 0) +
    (fullSyncStatus?.skippedNoWord ?? 0);

  const dedupSkippedTotal =
    (dedupStatus?.skippedSame ?? 0) +
    (dedupStatus?.skippedNoLinkId ?? 0) +
    (dedupStatus?.skippedNoWord ?? 0);

  const otherSkippedTotal =
    (otherMeaningsFaStatus?.skippedSame ?? 0) +
    (otherMeaningsFaStatus?.skippedNoLinkId ?? 0) +
    (otherMeaningsFaStatus?.skippedNoWord ?? 0);

  const sentenceSkippedTotal =
    (sentenceEnMeaningFaStatus?.skippedSame ?? 0) +
    (sentenceEnMeaningFaStatus?.skippedNoLinkId ?? 0) +
    (sentenceEnMeaningFaStatus?.skippedNoWord ?? 0);

  return (
    <main className="mx-auto w-full max-w-6xl select-text p-4">
      <div className="flex flex-col gap-4">
        <PageHeader
          title="Sync Anki/Words"
          subtitle="Internal tool for syncing Anki note fields from the DB."
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
                onClick={() => void startSyncJsonHint()}
                disabled={isRunning || Boolean(jsonHintStatus?.running)}
                className="h-10 rounded-xl bg-foreground px-3 text-sm font-semibold text-background transition disabled:opacity-50"
              >
                Sync json_hint + hints
              </button>
              <button
                type="button"
                onClick={() => void startSyncAllMedia()}
                disabled={isRunning || Boolean(mediaSyncStatus?.running)}
                className="h-10 rounded-xl bg-foreground px-3 text-sm font-semibold text-background transition disabled:opacity-50"
              >
                Copy all media
              </button>
              <button
                type="button"
                onClick={() => void startFullSyncAll()}
                disabled={isRunning || Boolean(fullSyncStatus?.running)}
                className="h-10 rounded-xl bg-foreground px-3 text-sm font-semibold text-background transition disabled:opacity-50"
              >
                Full sync DB → Anki
              </button>
              <button
                type="button"
                onClick={() => void deduplicateAnkiLinkIdKeepOldest()}
                disabled={isRunning || Boolean(dedupStatus?.running)}
                className="h-10 rounded-xl border border-card bg-background px-3 text-sm font-semibold text-foreground transition hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-50"
              >
                Deduplicate (keep oldest)
              </button>
              <button
                type="button"
                onClick={() => void startSyncSentenceEn()}
                disabled={isRunning || Boolean(sentenceEnStatus?.running)}
                className="h-10 rounded-xl bg-foreground px-3 text-sm font-semibold text-background transition disabled:opacity-50"
              >
                Sync sentence_en
              </button>
              <button
                type="button"
                onClick={() => void startSyncSentenceEnMeaningFa()}
                disabled={isRunning || Boolean(sentenceEnMeaningFaStatus?.running)}
                className="h-10 rounded-xl bg-foreground px-3 text-sm font-semibold text-background transition disabled:opacity-50"
              >
                Sync sentence_en_meaning_fa
              </button>
              <button
                type="button"
                onClick={() => void startSyncOtherMeaningsFa()}
                disabled={isRunning || Boolean(otherMeaningsFaStatus?.running)}
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

          <div className="grid gap-1 text-xs text-muted">
            <div>
              {jsonHintStatus ? (
                <span>
                  json_hint + hints: Processed{" "}
                  <span className="font-semibold">{jsonHintStatus.processed}/{jsonHintStatus.total}</span> • Updated{" "}
                  <span className="font-semibold">{jsonHintStatus.updated}</span> • Skipped{" "}
                  <span className="font-semibold">{jsonHintSkippedTotal}</span> • Failed{" "}
                  <span className="font-semibold">{jsonHintStatus.failed}</span>
                </span>
              ) : (
                <span>json_hint + hints: Processed 0/0 • Updated 0 • Skipped 0 • Failed 0</span>
              )}
            </div>
            <div>
              {mediaSyncStatus ? (
                <span>
                  media copy: Processed{" "}
                  <span className="font-semibold">{mediaSyncStatus.processed}/{mediaSyncStatus.total}</span> • Uploaded{" "}
                  <span className="font-semibold">{mediaSyncStatus.mediaUploaded}</span> • Skipped{" "}
                  <span className="font-semibold">{mediaSkippedTotal}</span> • Failed{" "}
                  <span className="font-semibold">{mediaSyncStatus.failed}</span>
                </span>
              ) : (
                <span>media copy: Processed 0/0 • Uploaded 0 • Skipped 0 • Failed 0</span>
              )}
            </div>
            <div>
              {fullSyncStatus ? (
                <span>
                  full sync: Processed{" "}
                  <span className="font-semibold">{fullSyncStatus.processed}/{fullSyncStatus.total}</span> • Created{" "}
                  <span className="font-semibold">{fullSyncStatus.created ?? 0}</span> • Updated{" "}
                  <span className="font-semibold">{fullSyncStatus.updated}</span> • Skipped{" "}
                  <span className="font-semibold">{fullSkippedTotal}</span> • Failed{" "}
                  <span className="font-semibold">{fullSyncStatus.failed}</span>
                </span>
              ) : (
                <span>full sync: Processed 0/0 • Created 0 • Updated 0 • Skipped 0 • Failed 0</span>
              )}
            </div>
            <div>
              {dedupStatus ? (
                <span>
                  dedup: Processed{" "}
                  <span className="font-semibold">{dedupStatus.processed}/{dedupStatus.total}</span> • Deleted{" "}
                  <span className="font-semibold">{dedupStatus.updated}</span> • Kept{" "}
                  <span className="font-semibold">{dedupSkippedTotal}</span> • Failed{" "}
                  <span className="font-semibold">{dedupStatus.failed}</span>
                </span>
              ) : (
                <span>dedup: Processed 0/0 • Deleted 0 • Kept 0 • Failed 0</span>
              )}
            </div>
            <div>
              {sentenceEnStatus ? (
                <span>
                  sentence_en: Processed{" "}
                  <span className="font-semibold">{sentenceEnStatus.processed}/{sentenceEnStatus.total}</span> • Updated{" "}
                  <span className="font-semibold">{sentenceEnStatus.updated}</span> • Skipped{" "}
                  <span className="font-semibold">{sentenceEnSkippedTotal}</span> • Failed{" "}
                  <span className="font-semibold">{sentenceEnStatus.failed}</span>
                </span>
              ) : (
                <span>sentence_en: Processed 0/0 • Updated 0 • Skipped 0 • Failed 0</span>
              )}
            </div>
            <div>
              {sentenceEnMeaningFaStatus ? (
                <span>
                  sentence_en_meaning_fa: Processed{" "}
                  <span className="font-semibold">
                    {sentenceEnMeaningFaStatus.processed}/{sentenceEnMeaningFaStatus.total}
                  </span>{" "}
                  • Updated <span className="font-semibold">{sentenceEnMeaningFaStatus.updated}</span> • Skipped{" "}
                  <span className="font-semibold">{sentenceSkippedTotal}</span> • Failed{" "}
                  <span className="font-semibold">{sentenceEnMeaningFaStatus.failed}</span>
                </span>
              ) : (
                <span>sentence_en_meaning_fa: Processed 0/0 • Updated 0 • Skipped 0 • Failed 0</span>
              )}
            </div>
            <div>
              {otherMeaningsFaStatus ? (
                <span>
                  other_meanings_fa: Processed{" "}
                  <span className="font-semibold">
                    {otherMeaningsFaStatus.processed}/{otherMeaningsFaStatus.total}
                  </span>{" "}
                  • Updated <span className="font-semibold">{otherMeaningsFaStatus.updated}</span> • Skipped{" "}
                  <span className="font-semibold">{otherSkippedTotal}</span> • Failed{" "}
                  <span className="font-semibold">{otherMeaningsFaStatus.failed}</span>
                </span>
              ) : (
                <span>other_meanings_fa: Processed 0/0 • Updated 0 • Skipped 0 • Failed 0</span>
              )}
            </div>
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
