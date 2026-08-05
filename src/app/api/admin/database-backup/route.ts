import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { NextResponse } from "next/server";

import { requireApiRole } from "@/lib/auth/apiAuth";
import { getGitComparison } from "@/lib/dbCompare/gitCompare";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const execFileAsync = promisify(execFile);
const MAX_OUTPUT = 24_000;

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

export async function GET() {
  const auth = await requireApiRole("admin");
  if (!auth.ok) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: auth.status });
  return NextResponse.json({ ok: true, report: await getGitComparison() });
}

export async function POST(request: Request) {
  const auth = await requireApiRole("admin");
  if (!auth.ok) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: auth.status });
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ ok: false, error: "Database backup controls are available only in a local development checkout." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as { action?: unknown; commitMessage?: unknown } | null;
  const action = body?.action;
  if (action !== "backup" && action !== "restore") {
    return NextResponse.json({ ok: false, error: "Unsupported action." }, { status: 400 });
  }

  const steps: CommandResult[] = [];
  try {
    if (action === "backup") {
      const commitMessage = typeof body?.commitMessage === "string" && body.commitMessage.trim()
        ? body.commitMessage.trim()
        : "chore: back up local database";
      steps.push(await run("npm", ["run", "db:backup"]));
      steps.push(await run("git", ["add", "-A"]));
      steps.push(await run("git", ["commit", "-m", commitMessage]));
      steps.push(await run("git", ["push"], 120_000));
      return NextResponse.json({ ok: true, action, steps });
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
