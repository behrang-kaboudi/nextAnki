"use client";

import { useEffect, useState } from "react";

import { ActionIcon } from "@/components/icons/ActionIcon";

type Step = { command: string; output: string };
type Result = { ok: boolean; action?: string; outcome?: "local_backup_unchanged" | "local_backup_updated" | "push_already_synced" | "pushed"; message?: string; error?: string; steps?: Step[] };
type Action = "backup" | "push" | "restore";
type BackupSyncReport = {
  status: "synced" | "local_changes" | "missing_local" | "missing_github" | "unknown";
  message: string;
  error: string | null;
};
type GitReport = {
  branch: string | null;
  localHead: string | null;
  localCommittedAt: string | null;
  localCommitSubject: string | null;
  upstream: string | null;
  githubHead: string | null;
  githubCommittedAt: string | null;
  githubCommitSubject: string | null;
  ahead: number | null;
  behind: number | null;
  dirtyFiles: number;
  relation: "same" | "different" | "unknown";
  error: string | null;
};

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString() : "—";
}

function syncLabel(relation: GitReport["relation"]) {
  if (relation === "same") return "In sync";
  if (relation === "different") return "Needs attention";
  return "Status unknown";
}

export function DatabaseBackupClient() {
  const [running, setRunning] = useState<Action | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [commitMessage, setCommitMessage] = useState("");
  const [gitReport, setGitReport] = useState<GitReport | null>(null);
  const [backupSync, setBackupSync] = useState<BackupSyncReport | null>(null);
  const [reportLoading, setReportLoading] = useState(true);
  const [helpOpen, setHelpOpen] = useState(false);

  async function refreshGitReport() {
    setReportLoading(true);
    try {
      const response = await fetch("/api/admin/database-backup", { cache: "no-store" });
      const payload = (await response.json()) as { ok: boolean; report?: GitReport; backupSync?: BackupSyncReport };
      setGitReport(payload.ok ? payload.report ?? null : null);
      setBackupSync(payload.ok ? payload.backupSync ?? null : null);
    } finally {
      setReportLoading(false);
    }
  }

  useEffect(() => {
    void refreshGitReport();
  }, []);

  useEffect(() => {
    if (!helpOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setHelpOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [helpOpen]);

  async function execute(action: Action) {
    if (action === "restore" && !window.confirm("Restore will replace all local database data with the committed backup. Continue?")) return;
    setRunning(action);
    setResult(null);
    try {
      const response = await fetch("/api/admin/database-backup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, commitMessage }),
      });
      setResult((await response.json()) as Result);
    } catch (error) {
      setResult({ ok: false, error: error instanceof Error ? error.message : String(error) });
    } finally {
      setRunning(null);
      void refreshGitReport();
    }
  }

  const isRunning = running !== null;
  return (
    <div className="grid gap-6">
      <section className="grid gap-4 rounded-2xl border border-card bg-card p-5 shadow-elevated lg:grid-cols-2">
        <div className="grid content-start gap-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-300">Save current state</div>
              <h2 className="mt-1 text-xl font-semibold text-foreground">Create database backup</h2>
            </div>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded border px-3 py-2 text-sm font-medium text-foreground hover:bg-black/5 dark:hover:bg-white/5"
              aria-expanded={helpOpen}
              aria-controls="backup-plan-modal"
              aria-haspopup="dialog"
              onClick={() => setHelpOpen((open) => !open)}
            >
              <ActionIcon name="help" />
              Backup plan
            </button>
          </div>
          <label className="grid gap-1.5 text-sm font-medium text-foreground">
            Commit description for push <span className="font-normal text-muted">(optional)</span>
            <textarea
              value={commitMessage}
              onChange={(event) => setCommitMessage(event.target.value)}
              rows={4}
              disabled={isRunning}
              placeholder="chore: back up local database"
              className="min-h-28 resize-y rounded border border-card bg-card px-3 py-2 text-sm font-normal text-foreground outline-none placeholder:text-muted focus:border-foreground/40 disabled:opacity-50"
            />
          </label>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className="rounded border border-emerald-600 bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isRunning}
              onClick={() => execute("backup")}
            >
              {running === "backup" ? "Creating backup…" : "Create local backup"}
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded border border-emerald-600 px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-50 dark:text-emerald-300"
              disabled={isRunning || backupSync?.status === "missing_local"}
              onClick={() => execute("push")}
            >
              <span aria-hidden className="text-base leading-none">↑</span>
              {running === "push" ? "Pushing local backup…" : "Push local backup"}
            </button>
          </div>
        </div>

        <aside className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
          <h3 className="font-semibold text-foreground">What this does</h3>
          <p className="mt-2 text-sm leading-6 text-muted">
            Create Local Backup only updates the file on this computer when database data changed. Push Local Backup is a separate, explicit action that compares the preserved local file with GitHub before uploading.
          </p>
        </aside>
      </section>

      {backupSync ? <BackupSyncAlert report={backupSync} loading={reportLoading} /> : null}

      <section className="grid content-start gap-4 rounded-2xl border border-red-500/30 bg-red-500/5 p-5 shadow-elevated">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-red-700 dark:text-red-300">Replace local data</div>
          <h2 className="mt-1 text-xl font-semibold text-foreground">Get backup from GitHub</h2>
          <p className="mt-1 text-sm leading-6 text-muted">
            Fast-forwards from GitHub, installs changed dependencies and migrations when needed, then replaces the local database with the archive. No commit or push is made.
          </p>
        </div>
        <button
          type="button"
          className="w-fit rounded border border-red-500/40 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-50 dark:text-red-300"
          disabled={isRunning}
          onClick={() => execute("restore")}
        >
          {running === "restore" ? "Restoring…" : "Restore local database"}
        </button>
      </section>

      <section className="overflow-hidden rounded-2xl border border-card bg-card shadow-elevated">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="p-5">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Repository health</div>
            <h2 className="mt-1 text-xl font-semibold text-foreground">Local and GitHub status</h2>
            <p className="mt-1 text-sm text-muted">Current branch, latest commits, sync state, and uncommitted local files.</p>
          </div>
          <button type="button" className="m-5 rounded border px-3 py-2 text-sm hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/5" disabled={reportLoading || isRunning} onClick={() => void refreshGitReport()}>
            {reportLoading ? "Refreshing…" : "Refresh report"}
          </button>
        </div>
        {gitReport?.error ? <p className="mt-3 text-sm text-red-700 dark:text-red-300">{gitReport.error}</p> : null}
        {gitReport ? (
          <div className="border-t border-card">
            <div className="grid gap-px bg-card md:grid-cols-4">
              <Metric label="Branch" value={gitReport.branch ?? "—"} detail={gitReport.upstream ?? "No upstream"} />
              <Metric label="Sync state" value={syncLabel(gitReport.relation)} tone={gitReport.relation === "same" ? "good" : gitReport.relation === "different" ? "warn" : "neutral"} detail={gitReport.relation === "same" ? "Local and GitHub point to the same commit" : "Review ahead/behind counts"} />
              <Metric label="Ahead / behind" value={`${gitReport.ahead ?? "—"} / ${gitReport.behind ?? "—"}`} detail="Local commits / GitHub commits" />
              <Metric label="Uncommitted files" value={String(gitReport.dirtyFiles)} tone={gitReport.dirtyFiles ? "warn" : "good"} detail={gitReport.dirtyFiles ? "Changes need a commit" : "Working tree is clean"} />
            </div>
            <div className="grid gap-4 border-t border-card p-5 lg:grid-cols-2">
              <CommitCard source="LOCAL" head={gitReport.localHead} subject={gitReport.localCommitSubject} date={gitReport.localCommittedAt} />
              <CommitCard source="GITHUB" head={gitReport.githubHead} subject={gitReport.githubCommitSubject} date={gitReport.githubCommittedAt} />
            </div>
          </div>
        ) : !reportLoading ? <p className="mt-3 text-sm text-muted">Git report is unavailable.</p> : null}
      </section>

      {result ? (
        <section className={`rounded-2xl border p-4 ${result.ok ? "border-emerald-500/30 bg-emerald-500/5" : "border-red-500/30 bg-red-500/5"}`}>
          <h2 className="font-semibold text-foreground">{result.ok ? "Completed" : "Operation failed"}</h2>
          {result.message ? <p className="mt-2 text-sm leading-6 text-foreground">{result.message}</p> : null}
          {result.error ? <p className="mt-2 text-sm text-red-700 dark:text-red-300">{result.error}</p> : null}
          {result.steps?.length ? (
            <div className="mt-3 grid gap-3">
              {result.steps.map((step, index) => (
                <div key={`${step.command}-${index}`} className="rounded-xl border border-card bg-background p-3">
                  <div className="font-mono text-xs text-foreground">{step.command}</div>
                  {step.output ? <pre className="mt-2 max-h-60 overflow-auto whitespace-pre-wrap text-xs leading-5 text-muted">{step.output}</pre> : null}
                </div>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}
      {helpOpen ? <BackupPlanModal onClose={() => setHelpOpen(false)} /> : null}
    </div>
  );
}

function BackupPlanModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="backup-plan-modal-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div id="backup-plan-modal" className="w-full max-w-2xl rounded-2xl border border-card bg-card shadow-elevated">
        <div className="flex items-start justify-between gap-3 border-b border-card p-5">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-700 dark:text-sky-300">Local-first workflow</div>
            <h2 id="backup-plan-modal-title" className="mt-1 text-xl font-semibold text-foreground">Backup plan</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-card bg-background px-2.5 py-1 text-lg leading-none text-foreground hover:bg-black/5 dark:hover:bg-white/5"
            aria-label="Close backup plan"
          >
            ×
          </button>
        </div>
        <ol className="m-5 list-decimal space-y-3 pl-5 text-sm leading-6 text-muted">
          <li>Create Local Backup reads every Prisma model into a temporary verified archive.</li>
          <li>The candidate and existing backup are normalized and compared with SHA-256; timestamps and row order do not create false changes.</li>
          <li>If the data is identical, the candidate is discarded and the old backup file remains untouched.</li>
          <li>If the data changed, the candidate atomically replaces the local backup. This step never uploads or pushes anything.</li>
          <li>The local and GitHub backup files are compared separately. Only Push Local Backup can commit and upload the local backup.</li>
        </ol>
        <div className="flex justify-end border-t border-card p-4">
          <button type="button" onClick={onClose} className="rounded border px-3 py-2 text-sm font-medium text-foreground hover:bg-black/5 dark:hover:bg-white/5">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function BackupSyncAlert({ report, loading }: { report: BackupSyncReport; loading: boolean }) {
  const needsPush = report.status === "local_changes" || report.status === "missing_github";
  const tone = needsPush
    ? "border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200"
    : report.status === "synced"
      ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-800 dark:text-emerald-200"
      : "border-card bg-card text-foreground";
  const title = needsPush
    ? "GitHub backup is behind the local backup"
    : report.status === "synced"
      ? "Local and GitHub backups are in sync"
      : report.status === "missing_local"
        ? "Create a local backup first"
        : "Backup sync status is unavailable";

  return (
    <section className={`rounded-2xl border p-4 shadow-elevated ${tone}`} aria-live="polite">
      <div className="flex items-start gap-3">
        <span aria-hidden className="mt-0.5 text-lg">{needsPush ? "⚠" : report.status === "synced" ? "✓" : "•"}</span>
        <div>
          <h2 className="font-semibold">{loading ? "Checking backup sync…" : title}</h2>
          <p className="mt-1 text-sm leading-6 opacity-80">{report.message}</p>
          {report.error ? <p className="mt-1 text-xs opacity-70">{report.error}</p> : null}
        </div>
      </div>
    </section>
  );
}

function Metric({ label, value, detail, tone = "neutral" }: { label: string; value: string; detail: string; tone?: "good" | "warn" | "neutral" }) {
  const valueClass = tone === "good" ? "text-emerald-700 dark:text-emerald-300" : tone === "warn" ? "text-amber-700 dark:text-amber-300" : "text-foreground";
  return <div className="bg-background p-4"><div className="text-xs font-medium uppercase tracking-wide text-muted">{label}</div><div className={`mt-2 break-words text-lg font-semibold ${valueClass}`}>{value}</div><div className="mt-1 text-xs text-muted">{detail}</div></div>;
}

function CommitCard({ source, head, subject, date }: { source: string; head: string | null; subject: string | null; date: string | null }) {
  return <div className="rounded-xl border border-card bg-background p-4"><div className="flex items-center justify-between gap-3"><span className="text-xs font-semibold tracking-[0.16em] text-muted">{source}</span><code className="rounded bg-card px-2 py-1 text-xs text-foreground">{head ?? "—"}</code></div><div className="mt-4 min-h-12 text-sm font-medium leading-6 text-foreground">{subject ?? "No commit information available"}</div><div className="mt-3 border-t border-card pt-3 text-xs text-muted">{formatDate(date)}</div></div>;
}
