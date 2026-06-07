"use client";

import { useMemo, useState } from "react";

import type { GitComparison } from "@/lib/dbCompare/gitCompare";

type UpdateResult = {
  ok: boolean;
  didFetch?: boolean;
  didUpdate?: boolean;
  message?: string;
  error?: string;
  branch?: string;
  upstream?: string;
  beforeHead?: string;
  afterHead?: string;
  ahead?: number;
  behind?: number;
  dirtyFiles?: number;
  fetchOutput?: string;
  pullOutput?: string;
};

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZoneName: "short",
  });
}

function relationSummary(git: GitComparison) {
  if (git.error) return "Git comparison failed.";
  if (!git.localHead || !git.githubHead) return "Version comparison is incomplete.";
  if (git.localHead !== git.githubHead) return "Current local commit is different from GitHub.";
  if (git.dirtyFiles > 0) return "Current commit matches GitHub, but local files have uncommitted changes.";
  return "Current version matches GitHub branch head.";
}

function canUpdateFromGithub(git: GitComparison) {
  return Boolean(
    git.localHead &&
      git.githubHead &&
      git.localHead !== git.githubHead &&
      git.dirtyFiles === 0 &&
      (git.ahead === 0 || git.ahead === null),
  );
}

function needsLocalCommit(git: GitComparison) {
  return git.dirtyFiles > 0 || (git.ahead !== null && git.ahead > 0);
}

function isFullyUpdated(git: GitComparison) {
  return Boolean(git.localHead && git.githubHead && git.localHead === git.githubHead && git.dirtyFiles === 0);
}

function updateDisabledReason(git: GitComparison) {
  if (!git.localHead || !git.githubHead) return "GitHub comparison is incomplete.";
  if (git.localHead === git.githubHead) return "Already up to date.";
  if (git.dirtyFiles > 0) return "Commit local file changes before getting updates.";
  if (git.ahead !== null && git.ahead > 0) return "Local branch is ahead; commit/push or resolve it before pulling.";
  return "Available when GitHub has a different branch head.";
}

function resultClassName(git: GitComparison) {
  if (git.localHead && git.githubHead && git.localHead !== git.githubHead) {
    return "border-red-500/20 bg-red-500/10 text-red-800";
  }
  if (git.error || !git.localHead || !git.githubHead || git.dirtyFiles > 0) {
    return "border-yellow-500/20 bg-yellow-500/10 text-yellow-800";
  }
  return "border-green-500/20 bg-green-500/10 text-green-800";
}

function buildReport(git: GitComparison) {
  return [
    `Version comparison report`,
    ``,
    `Result: ${relationSummary(git)}`,
    ``,
    `Branch: ${git.branch ?? "—"}`,
    `Upstream: ${git.upstream ?? "—"}`,
    `Local HEAD: ${git.localHead ?? "—"}`,
    `GitHub HEAD: ${git.githubHead ?? git.upstreamHead ?? "—"}`,
    `Local committed at: ${formatDate(git.localCommittedAt)}`,
    `GitHub updated at: ${formatDate(git.githubCommittedAt)}`,
    `Ahead: ${git.ahead ?? "—"}`,
    `Behind: ${git.behind ?? "—"}`,
    `Dirty files: ${git.dirtyFiles}`,
    git.error ? `Error: ${git.error}` : null,
  ]
    .filter((line) => line !== null)
    .join("\n");
}

export function VersionCompareReportButton({ git }: { git: GitComparison }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateResult, setUpdateResult] = useState<UpdateResult | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const report = useMemo(() => buildReport(git), [git]);
  const canUpdate = canUpdateFromGithub(git);
  const shouldCommit = needsLocalCommit(git);
  const allUpdated = isFullyUpdated(git);

  async function updateFromGithub() {
    setIsUpdating(true);
    setUpdateResult(null);
    setActionMessage(null);
    try {
      const response = await fetch("/api/admin/db-compare/update-from-github", {
        method: "POST",
      });
      const data = (await response.json()) as UpdateResult;
      setUpdateResult(data);
    } catch (error) {
      setUpdateResult({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setIsUpdating(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="rounded-xl border border-card bg-background px-3 py-2 text-sm font-semibold text-foreground transition hover:bg-black/5 dark:hover:bg-white/5"
      >
        Compare version report
      </button>

      {isOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="version-compare-report-title"
        >
          <div className="w-full max-w-2xl rounded-2xl border border-card bg-card shadow-elevated">
            <div className="flex items-start justify-between gap-3 border-b border-card p-4">
              <div>
                <h3 id="version-compare-report-title" className="text-base font-semibold text-foreground">
                  Version Compare Report
                </h3>
                <p className="mt-1 text-xs text-muted">
                  Current local checkout compared with the GitHub branch head.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-lg border border-card bg-background px-2 py-1 text-sm text-foreground hover:bg-black/5 dark:hover:bg-white/5"
              >
                Close
              </button>
            </div>

            <div className="grid gap-4 p-4">
              <div className={`rounded-xl border p-3 text-sm font-semibold ${resultClassName(git)}`}>
                {relationSummary(git)}
              </div>

              <div className="grid gap-2 sm:grid-cols-3">
                <button
                  type="button"
                  onClick={() => {
                    setActionMessage("Please commit your local changes first.");
                    setUpdateResult(null);
                  }}
                  disabled={!shouldCommit}
                  className="flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition enabled:border-yellow-600 enabled:bg-yellow-500 enabled:text-yellow-950 enabled:shadow-lg enabled:shadow-yellow-500/25 enabled:ring-2 enabled:ring-yellow-300 enabled:hover:bg-yellow-400 disabled:cursor-not-allowed disabled:border-yellow-500/20 disabled:bg-yellow-500/10 disabled:text-yellow-800 disabled:opacity-40"
                  title={shouldCommit ? "Local changes or local commits need attention." : "No local commit action is needed."}
                >
                  <span aria-hidden="true">↑</span>
                  Commit needed
                </button>
                <button
                  type="button"
                  onClick={updateFromGithub}
                  disabled={isUpdating || !canUpdate}
                  className="flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition enabled:border-blue-700 enabled:bg-blue-600 enabled:text-white enabled:shadow-lg enabled:shadow-blue-600/30 enabled:ring-2 enabled:ring-blue-300 enabled:hover:bg-blue-500 disabled:cursor-not-allowed disabled:border-blue-500/20 disabled:bg-blue-500/10 disabled:text-blue-800 disabled:opacity-40"
                  title={canUpdate ? "Fetch and fast-forward from GitHub." : updateDisabledReason(git)}
                >
                  <span aria-hidden="true">↓</span>
                  {isUpdating ? "Getting updates..." : "Get updates"}
                </button>
                <button
                  type="button"
                  disabled={!allUpdated}
                  className="flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition enabled:border-green-700 enabled:bg-green-600 enabled:text-white enabled:shadow-lg enabled:shadow-green-600/30 enabled:ring-2 enabled:ring-green-300 disabled:cursor-not-allowed disabled:border-green-500/20 disabled:bg-green-500/10 disabled:text-green-800 disabled:opacity-40"
                  title={allUpdated ? "Local checkout matches GitHub." : "Enabled only when everything is up to date."}
                >
                  <span aria-hidden="true">✓</span>
                  All up to date
                </button>
              </div>

              {actionMessage ? (
                <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/10 p-3 text-sm font-semibold text-yellow-800">
                  {actionMessage}
                </div>
              ) : null}

              <pre className="max-h-[60vh] overflow-auto rounded-xl border border-card bg-background p-3 font-mono text-xs leading-6 text-foreground">
                {report}
              </pre>

              <div className="flex flex-wrap items-center gap-2">
                {!canUpdate && !allUpdated ? (
                  <span className="text-xs text-muted">
                    {updateDisabledReason(git)}
                  </span>
                ) : null}
                {updateResult?.ok && updateResult.didUpdate ? (
                  <button
                    type="button"
                    onClick={() => window.location.reload()}
                    className="rounded-xl border border-card bg-background px-3 py-2 text-sm font-semibold text-foreground transition hover:bg-black/5 dark:hover:bg-white/5"
                  >
                    Refresh page
                  </button>
                ) : null}
              </div>

              {updateResult ? (
                <div
                  className={`rounded-xl border p-3 text-sm ${
                    updateResult.ok
                      ? "border-green-500/20 bg-green-500/10 text-green-800"
                      : "border-red-500/20 bg-red-500/10 text-red-800"
                  }`}
                >
                  <div className="font-semibold">
                    {updateResult.ok ? updateResult.message ?? "Update check completed." : updateResult.error ?? "Update failed."}
                  </div>
                  <pre className="mt-2 overflow-auto whitespace-pre-wrap font-mono text-xs leading-6">
                    {[
                      `Branch: ${updateResult.branch ?? "—"}`,
                      `Upstream: ${updateResult.upstream ?? "—"}`,
                      `Before: ${updateResult.beforeHead ?? "—"}`,
                      `After: ${updateResult.afterHead ?? "—"}`,
                      `Ahead: ${updateResult.ahead ?? "—"}`,
                      `Behind: ${updateResult.behind ?? "—"}`,
                      `Dirty files: ${updateResult.dirtyFiles ?? "—"}`,
                      updateResult.fetchOutput ? `Fetch:\n${updateResult.fetchOutput}` : null,
                      updateResult.pullOutput ? `Pull:\n${updateResult.pullOutput}` : null,
                    ]
                      .filter(Boolean)
                      .join("\n")}
                  </pre>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
