"use client";

import { useState } from "react";

type Step = { command: string; output: string };
type Result = { ok: boolean; action?: string; error?: string; steps?: Step[] };

export function DatabaseBackupClient() {
  const [running, setRunning] = useState<"backup" | "restore" | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [commitMessage, setCommitMessage] = useState("");

  async function execute(action: "backup" | "restore") {
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
    }
  }

  const isRunning = running !== null;
  return (
    <div className="grid gap-6">
      <section className="grid gap-4 rounded-2xl border border-card bg-card p-5 shadow-elevated lg:grid-cols-2">
        <div className="grid content-start gap-3 rounded-xl border border-card bg-background p-4">
          <div>
            <h2 className="font-semibold text-foreground">Create and push backup</h2>
            <p className="mt-1 text-sm leading-6 text-muted">
              Creates a verified full archive from every Prisma model, stages all project changes, commits them, and pushes the current branch.
            </p>
          </div>
          <label className="grid gap-1.5 text-sm font-medium text-foreground">
            Commit description <span className="font-normal text-muted">(optional)</span>
            <textarea
              value={commitMessage}
              onChange={(event) => setCommitMessage(event.target.value)}
              rows={4}
              disabled={isRunning}
              placeholder="chore: back up local database"
              className="min-h-28 resize-y rounded border border-card bg-card px-3 py-2 text-sm font-normal text-foreground outline-none placeholder:text-muted focus:border-foreground/40 disabled:opacity-50"
            />
          </label>
          <button
            type="button"
            className="w-fit rounded border px-3 py-2 text-sm font-medium hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-white/5"
            disabled={isRunning}
            onClick={() => execute("backup")}
          >
            {running === "backup" ? "Creating backup…" : "Create backup and push"}
          </button>
        </div>

        <div className="grid content-start gap-3 rounded-xl border border-red-500/30 bg-red-500/5 p-4">
          <div>
            <h2 className="font-semibold text-foreground">Get backup from GitHub</h2>
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
        </div>
      </section>

      {result ? (
        <section className={`rounded-2xl border p-4 ${result.ok ? "border-emerald-500/30 bg-emerald-500/5" : "border-red-500/30 bg-red-500/5"}`}>
          <h2 className="font-semibold text-foreground">{result.ok ? "Completed" : "Operation failed"}</h2>
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
    </div>
  );
}
