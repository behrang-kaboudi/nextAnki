import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";

import { NextResponse } from "next/server";

import { requireApiRole } from "@/lib/auth/apiAuth";
import { archivesHaveSameData, parseArchive } from "@/lib/backup/archiveFingerprint.mjs";
import { getGitComparison } from "@/lib/dbCompare/gitCompare";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const execFileAsync = promisify(execFile);
const MAX_OUTPUT = 24_000;
const BACKUP_PATH = "dbBackupToWork/database_backup.archive";

type CommandResult = { command: string; output: string };

async function run(command: string, args: string[], timeout = 300_000): Promise<CommandResult> {
  const { stdout, stderr } = await execFileAsync(command, args, {
    cwd: process.cwd(),
    timeout,
    maxBuffer: 4 * 1024 * 1024,
    env: process.env,
  });
  const output = `${stdout}${stderr ? `\n${stderr}` : ""}`.trim();
  return { command: [command, ...args].join(" "), output: output.slice(-MAX_OUTPUT) };
}

async function changedSince(beforeHead: string, paths: string[]) {
  const { output } = await run("git", ["diff", "--name-only", `${beforeHead}..HEAD`, "--", ...paths]);
  return Boolean(output.trim());
}

async function ensureCleanWorktree() {
  const { output } = await run("git", ["status", "--porcelain"]);
  if (output) throw new Error("Git pull was not run because this working tree has uncommitted changes.");
}

async function readGitHubArchive(remoteRef: string) {
  const { stdout } = await execFileAsync("git", ["show", `${remoteRef}:${BACKUP_PATH}`], {
    cwd: process.cwd(),
    timeout: 30_000,
    maxBuffer: 64 * 1024 * 1024,
    env: process.env,
  });
  return parseArchive(stdout);
}

async function currentBranch() {
  const branch = (await run("git", ["branch", "--show-current"])).output.trim();
  if (!branch) throw new Error("A checked-out Git branch is required.");
  return branch;
}

async function compareLocalBackupToGitHub(remoteRef: string) {
  const localArchive = parseArchive(await readFile(BACKUP_PATH, "utf8"));
  try {
    const githubArchive = await readGitHubArchive(remoteRef);
    return archivesHaveSameData(localArchive, githubArchive) ? "same" as const : "different" as const;
  } catch {
    return "missing_remote" as const;
  }
}

async function getBackupSyncReport() {
  try {
    const branch = await currentBranch();
    await run("git", ["fetch", "origin", branch], 120_000);

    try {
      await readFile(BACKUP_PATH, "utf8");
    } catch {
      return { status: "missing_local" as const, message: "No local backup exists yet. Create one before pushing.", error: null };
    }

    try {
      const comparison = await compareLocalBackupToGitHub("FETCH_HEAD");
      if (comparison === "missing_remote") {
        return { status: "missing_github" as const, message: "GitHub has no readable backup for this branch. The local backup is ready to push.", error: null };
      }
      return comparison === "same"
        ? { status: "synced" as const, message: "The local backup matches the backup on GitHub.", error: null }
        : { status: "local_changes" as const, message: "The local backup differs from GitHub. Nothing will be uploaded until you press Push.", error: null };
    } catch {
      return { status: "unknown" as const, message: "The local backup could not be compared with GitHub.", error: null };
    }
  } catch (error) {
    return {
      status: "unknown" as const,
      message: "Backup sync status could not be determined.",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function GET() {
  const auth = await requireApiRole("admin");
  if (!auth.ok) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: auth.status });
  const [report, backupSync] = await Promise.all([getGitComparison(), getBackupSyncReport()]);
  return NextResponse.json({ ok: true, report, backupSync });
}

export async function POST(request: Request) {
  const auth = await requireApiRole("admin");
  if (!auth.ok) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: auth.status });
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ ok: false, error: "Database backup controls are available only in a local development checkout." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as { action?: unknown; commitMessage?: unknown } | null;
  const action = body?.action;
  if (action !== "backup" && action !== "push" && action !== "restore") {
    return NextResponse.json({ ok: false, error: "Unsupported action." }, { status: 400 });
  }

  const steps: CommandResult[] = [];
  try {
    if (action === "backup") {
      const backupStep = await run("npm", ["run", "db:backup:if-changed"]);
      steps.push(backupStep);
      const unchanged = backupStep.output.includes("BACKUP_STATUS=unchanged");
      return NextResponse.json({
        ok: true,
        action,
        outcome: unchanged ? "local_backup_unchanged" : "local_backup_updated",
        message: unchanged
          ? "Database data has not changed. The existing local backup was preserved without rewriting it."
          : "Database changes were detected and the local backup was updated. Nothing was uploaded to GitHub.",
        steps,
      });
    }

    if (action === "push") {
      const commitMessage = typeof body?.commitMessage === "string" && body.commitMessage.trim()
        ? body.commitMessage.trim()
        : "chore: back up local database";
      const branch = await currentBranch();

      steps.push(await run("git", ["fetch", "origin", branch], 120_000));

      if (await compareLocalBackupToGitHub("FETCH_HEAD") === "same") {
        return NextResponse.json({
          ok: true,
          action,
          outcome: "push_already_synced",
          message: "The local backup already matches GitHub. No commit or push was needed.",
          steps,
        });
      }

      steps.push(await run("git", ["add", "-A"]));
      const status = await run("git", ["status", "--porcelain"]);
      if (status.output) steps.push(await run("git", ["commit", "-m", commitMessage]));
      steps.push(await run("git", ["push"], 120_000));
      return NextResponse.json({
        ok: true,
        action,
        outcome: "pushed",
        message: "Database changes not yet present on GitHub were detected. The backup and all project changes were committed and pushed.",
        steps,
      });
    }

    await ensureCleanWorktree();
    const beforeHead = (await run("git", ["rev-parse", "HEAD"])).output.trim();
    steps.push(await run("git", ["pull", "--ff-only"], 120_000));

    if (await changedSince(beforeHead, ["package.json", "package-lock.json"])) {
      steps.push(await run("npm", ["install"], 300_000));
    }
    if (await changedSince(beforeHead, ["prisma/schema.prisma", "prisma/migrations"])) {
      steps.push(await run("npx", ["prisma", "migrate", "deploy"], 300_000));
    }
    steps.push(await run("npm", ["run", "db:restore"], 300_000));
    return NextResponse.json({ ok: true, action, steps });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        action,
        error: error instanceof Error ? error.message : String(error),
        steps,
      },
      { status: 500 }
    );
  }
}
