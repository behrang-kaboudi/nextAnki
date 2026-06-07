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
  const report = useMemo(() => buildReport(git), [git]);

  async function updateFromGithub() {
    setIsUpdating(true);
    setUpdateResult(null);
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
              <div className="rounded-xl border border-card bg-background p-3 text-sm text-foreground">
                {relationSummary(git)}
              </div>

              <pre className="max-h-[60vh] overflow-auto rounded-xl border border-card bg-background p-3 font-mono text-xs leading-6 text-foreground">
                {report}
              </pre>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={updateFromGithub}
                  disabled={isUpdating}
                  className="rounded-xl border border-card bg-background px-3 py-2 text-sm font-semibold text-foreground transition hover:bg-black/5 disabled:opacity-60 dark:hover:bg-white/5"
                >
                  {isUpdating ? "Fetching and updating..." : "Fetch and update from GitHub"}
                </button>
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
