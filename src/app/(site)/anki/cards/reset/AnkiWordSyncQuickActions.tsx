"use client";

import { useState } from "react";

import { JOB_PROGRESS_TOPICS } from "@/lib/progress/topics";
import { useJobProgressStatuses } from "@/lib/progress/useJobProgress";

type SyncJobStatus = {
  running: boolean;
  error: string | null;
  total: number;
  processed: number;
  created?: number;
  updated: number;
  skippedSame: number;
  skippedNoLinkId: number;
  skippedNoWord: number;
  skippedNotReady?: number;
  failed: number;
  mediaUploaded: number;
};

type MissingAnkiNote = {
  noteId: number;
  modelName: string;
  anki_link_id: string;
  base_form: string;
  meaning_fa: string;
};

type MissingAnkiNotesResponse = {
  query?: string;
  totalNotes?: number;
  checkedNotes?: number;
  missing?: MissingAnkiNote[];
  error?: string;
};

function skippedTotal(status: SyncJobStatus | null) {
  return (
    (status?.skippedSame ?? 0) +
    (status?.skippedNoLinkId ?? 0) +
    (status?.skippedNoWord ?? 0) +
    (status?.skippedNotReady ?? 0)
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <span dir="ltr" className="rounded bg-black/5 px-1 py-0.5 font-mono text-[11px] dark:bg-white/10">
      {children}
    </span>
  );
}

type AnkiWordSyncQuickActionsProps = {
  disabled?: boolean;
  allJobsRunning?: boolean;
  onRunAllJobs?: () => void;
};

export default function AnkiWordSyncQuickActions({
  disabled = false,
  allJobsRunning = false,
  onRunAllJobs,
}: AnkiWordSyncQuickActionsProps) {
  const progress = useJobProgressStatuses();
  const mediaStatus = (progress.statuses[JOB_PROGRESS_TOPICS.ankiMedia] as SyncJobStatus | undefined) ?? null;
  const fullStatus = (progress.statuses[JOB_PROGRESS_TOPICS.ankiFull] as SyncJobStatus | undefined) ?? null;

  const [requestRunning, setRequestRunning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [missingDeleteModalOpen, setMissingDeleteModalOpen] = useState(false);
  const [missingDeleteLoading, setMissingDeleteLoading] = useState(false);
  const [missingDeleteDeleting, setMissingDeleteDeleting] = useState(false);
  const [missingDeleteError, setMissingDeleteError] = useState<string | null>(null);
  const [missingDeleteQuery, setMissingDeleteQuery] = useState<string | null>(null);
  const [missingDeleteTotalNotes, setMissingDeleteTotalNotes] = useState<number | null>(null);
  const [missingDeleteCheckedNotes, setMissingDeleteCheckedNotes] = useState<number | null>(null);
  const [missingDeleteItems, setMissingDeleteItems] = useState<MissingAnkiNote[]>([]);

  const syncRunning = Boolean(mediaStatus?.running || fullStatus?.running);
  const actionsDisabled = disabled || requestRunning || syncRunning || missingDeleteLoading || missingDeleteDeleting;

  async function startJob(endpoint: string, successMessage: string) {
    if (actionsDisabled) return;
    setRequestRunning(true);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch(endpoint, { method: "POST" });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? `Request failed (${response.status})`);
      setMessage(successMessage);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setRequestRunning(false);
    }
  }

  async function stopJob(endpoint: string, label: string) {
    if (requestRunning) return;
    setRequestRunning(true);
    setError(null);
    try {
      const response = await fetch(endpoint, { method: "POST" });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? `Request failed (${response.status})`);
      setMessage(`${label} stop requested.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setRequestRunning(false);
    }
  }

  async function loadMissingAnkiNotes() {
    setMissingDeleteLoading(true);
    setMissingDeleteDeleting(false);
    setMissingDeleteError(null);
    try {
      const response = await fetch("/api/word/anki-missing", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ limit: 50_000 }),
      });
      const data = (await response.json().catch(() => ({}))) as MissingAnkiNotesResponse;
      if (!response.ok) throw new Error(data.error ?? `Request failed (${response.status})`);

      setMissingDeleteQuery(data.query ?? null);
      setMissingDeleteTotalNotes(typeof data.totalNotes === "number" ? data.totalNotes : null);
      setMissingDeleteCheckedNotes(typeof data.checkedNotes === "number" ? data.checkedNotes : null);
      setMissingDeleteItems(Array.isArray(data.missing) ? data.missing : []);
    } catch (caught) {
      setMissingDeleteError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setMissingDeleteLoading(false);
    }
  }

  async function openMissingDeleteModal() {
    if (actionsDisabled) return;
    setMissingDeleteModalOpen(true);
    setMissingDeleteItems([]);
    setMissingDeleteQuery(null);
    setMissingDeleteTotalNotes(null);
    setMissingDeleteCheckedNotes(null);
    await loadMissingAnkiNotes();
  }

  async function deleteMissingAnkiNotes() {
    if (!missingDeleteItems.length || missingDeleteDeleting) return;
    const confirmed = window.confirm(
      `Delete ${missingDeleteItems.length} Anki note(s) that do not exist in the local DB? This cannot be undone.`,
    );
    if (!confirmed) return;

    setMissingDeleteDeleting(true);
    setMissingDeleteError(null);
    try {
      const response = await fetch("/api/word/anki-missing/delete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ noteIds: missingDeleteItems.map((item) => item.noteId) }),
      });
      const data = (await response.json().catch(() => ({}))) as { deleted?: number; error?: string };
      if (!response.ok) throw new Error(data.error ?? `Request failed (${response.status})`);

      const deleted = data.deleted ?? missingDeleteItems.length;
      setMessage(`Deleted ${deleted} Anki note(s) missing in DB.`);
      setMissingDeleteItems([]);
      setMissingDeleteTotalNotes((current) => (current === null ? null : Math.max(0, current - deleted)));
      setMissingDeleteCheckedNotes((current) => (current === null ? null : Math.max(0, current - deleted)));
    } catch (caught) {
      setMissingDeleteError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setMissingDeleteDeleting(false);
    }
  }

  return (
    <section dir="ltr" className="order-0 grid gap-3 rounded-2xl border border-card bg-background p-3 text-left xl:col-span-2">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">Word sync quick actions</h2>
          <p className="mt-1 text-xs text-muted">The primary media, database sync, and cleanup operations from Anki Word Synchronization.</p>
        </div>
        {onRunAllJobs ? (
          <button
            type="button"
            onClick={onRunAllJobs}
            disabled={actionsDisabled}
            className="h-10 rounded-xl bg-[var(--primary)] px-4 text-sm font-bold text-[var(--primary-foreground)] transition disabled:opacity-50"
          >
            {allJobsRunning ? "Running all jobs…" : "Run all jobs in order"}
          </button>
        ) : null}
      </div>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <button
          type="button"
          onClick={() => void startJob("/api/tests/sync-anki-words/media/sync-all/start", "Copy all media started.")}
          disabled={actionsDisabled}
          className="h-10 rounded-xl bg-foreground px-3 text-sm font-semibold text-background transition disabled:opacity-50"
        >
          Copy all media
        </button>
        <button
          type="button"
          onClick={() => void startJob("/api/tests/sync-anki-words/media/sync-changed/start", "Copy changed media started.")}
          disabled={actionsDisabled}
          className="h-10 rounded-xl border border-card bg-background px-3 text-sm font-semibold text-foreground transition hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/5"
        >
          Copy changed media
        </button>
        <button
          type="button"
          onClick={() => void startJob("/api/tests/sync-anki-words/full/sync-all/start", "Full database sync started.")}
          disabled={actionsDisabled}
          className="h-10 rounded-xl bg-foreground px-3 text-sm font-semibold text-background transition disabled:opacity-50"
        >
          Full database sync
        </button>
        <button
          type="button"
          onClick={() => void openMissingDeleteModal()}
          disabled={actionsDisabled}
          className="h-10 rounded-xl border border-red-500/30 bg-red-600/10 px-3 text-sm font-semibold text-red-700 transition hover:bg-red-600/15 disabled:opacity-50 dark:text-red-300"
        >
          Delete Anki notes missing in DB
        </button>
      </div>

      <div className="grid gap-1 text-xs text-muted">
        <div className="flex flex-wrap items-center gap-2">
          <span>
            Media: <span className="font-semibold">{mediaStatus?.processed ?? 0}/{mediaStatus?.total ?? 0}</span> processed
            {" • "}Uploaded <span className="font-semibold">{mediaStatus?.mediaUploaded ?? 0}</span>
            {" • "}Skipped <span className="font-semibold">{skippedTotal(mediaStatus)}</span>
            {" • "}Failed <span className="font-semibold">{mediaStatus?.failed ?? 0}</span>
          </span>
          {mediaStatus?.running ? (
            <button
              type="button"
              onClick={() => void stopJob("/api/tests/sync-anki-words/media/sync-all/stop", "Media copy")}
              disabled={requestRunning}
              className="rounded border border-card px-2 py-1 font-semibold text-foreground disabled:opacity-50"
            >
              Stop media copy
            </button>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span>
            Full sync: <span className="font-semibold">{fullStatus?.processed ?? 0}/{fullStatus?.total ?? 0}</span> processed
            {" • "}Created <span className="font-semibold">{fullStatus?.created ?? 0}</span>
            {" • "}Updated <span className="font-semibold">{fullStatus?.updated ?? 0}</span>
            {" • "}Skipped <span className="font-semibold">{skippedTotal(fullStatus)}</span>
            {" • "}Failed <span className="font-semibold">{fullStatus?.failed ?? 0}</span>
          </span>
          {fullStatus?.running ? (
            <button
              type="button"
              onClick={() => void stopJob("/api/tests/sync-anki-words/full/sync-all/stop", "Full database sync")}
              disabled={requestRunning}
              className="rounded border border-card px-2 py-1 font-semibold text-foreground disabled:opacity-50"
            >
              Stop full sync
            </button>
          ) : null}
        </div>
      </div>

      {message ? <p className="text-xs font-semibold text-green-700 dark:text-green-400">{message}</p> : null}
      {error ? <p className="text-xs font-semibold text-red-700 dark:text-red-400">{error}</p> : null}
      {mediaStatus?.error ? <p className="text-xs font-semibold text-red-700 dark:text-red-400">{mediaStatus.error}</p> : null}
      {fullStatus?.error ? <p className="text-xs font-semibold text-red-700 dark:text-red-400">{fullStatus.error}</p> : null}

      {missingDeleteModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="flex max-h-[85vh] w-full max-w-5xl flex-col rounded border bg-background p-4 text-left shadow-lg">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="text-base font-semibold">Delete Anki Notes Missing from the Database</div>
                <div className="text-xs opacity-80">
                  Found: <span className="font-semibold">{missingDeleteItems.length}</span> • Checked:{" "}
                  <span className="font-semibold">{missingDeleteCheckedNotes ?? "—"}</span> • Total notes:{" "}
                  <span className="font-semibold">{missingDeleteTotalNotes ?? "—"}</span>
                </div>
                {missingDeleteQuery ? <div className="text-xs opacity-80">Query: <Code>{missingDeleteQuery}</Code></div> : null}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void loadMissingAnkiNotes()}
                  disabled={missingDeleteLoading || missingDeleteDeleting}
                  className="rounded border px-3 py-1.5 text-sm hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/5"
                >
                  {missingDeleteLoading ? "Loading..." : "Refresh"}
                </button>
                <button
                  type="button"
                  onClick={() => setMissingDeleteModalOpen(false)}
                  disabled={missingDeleteDeleting}
                  className="rounded border px-3 py-1.5 text-sm hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/5"
                >
                  Close
                </button>
              </div>
            </div>

            {missingDeleteError ? <div className="mt-3 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">{missingDeleteError}</div> : null}

            <div className="mt-3 min-h-0 flex-1 overflow-auto rounded border">
              {missingDeleteLoading ? (
                <div className="p-4 text-sm text-muted">Loading the list...</div>
              ) : missingDeleteItems.length ? (
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-background">
                    <tr className="border-b border-card">
                      <th className="whitespace-nowrap px-3 py-2 font-semibold">noteId</th>
                      <th className="whitespace-nowrap px-3 py-2 font-semibold">anki_link_id</th>
                      <th className="whitespace-nowrap px-3 py-2 font-semibold">Word</th>
                      <th dir="rtl" className="px-3 py-2 text-right font-semibold">معنی</th>
                    </tr>
                  </thead>
                  <tbody>
                    {missingDeleteItems.map((item) => (
                      <tr key={`${item.noteId}-${item.anki_link_id}`} className="border-b border-card align-top">
                        <td className="whitespace-nowrap px-3 py-2 font-mono">{item.noteId}</td>
                        <td className="whitespace-nowrap px-3 py-2 font-mono">{item.anki_link_id}</td>
                        <td className="whitespace-nowrap px-3 py-2">{item.base_form || "—"}</td>
                        <td dir="rtl" className="min-w-[18rem] px-3 py-2 text-right">{item.meaning_fa || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="p-4 text-sm text-muted">No notes were found for deletion.</div>
              )}
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t pt-3">
              <div className="text-xs text-muted">This permanently deletes the listed notes from Anki and cannot be undone.</div>
              <button
                type="button"
                onClick={() => void deleteMissingAnkiNotes()}
                disabled={missingDeleteLoading || missingDeleteDeleting || !missingDeleteItems.length}
                className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
              >
                {missingDeleteDeleting ? "Deleting..." : `Delete All from Anki (${missingDeleteItems.length})`}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
