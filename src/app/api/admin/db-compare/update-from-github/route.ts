import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { NextResponse } from "next/server";

const execFileAsync = promisify(execFile);

type RunResult = {
  stdout: string;
  stderr: string;
};

async function git(args: string[]): Promise<RunResult> {
  const { stdout, stderr } = await execFileAsync("git", args, {
    cwd: process.cwd(),
    timeout: 30000,
    maxBuffer: 1024 * 1024,
  });
  return { stdout: stdout.trim(), stderr: stderr.trim() };
}

function parseAheadBehind(value: string) {
  const [aheadRaw, behindRaw] = value.trim().split(/\s+/);
  const ahead = Number(aheadRaw);
  const behind = Number(behindRaw);
  return {
    ahead: Number.isFinite(ahead) ? ahead : 0,
    behind: Number.isFinite(behind) ? behind : 0,
  };
}

export async function POST() {
  try {
    const branch = (await git(["branch", "--show-current"])).stdout;
    if (!branch) {
      return NextResponse.json({ ok: false, error: "Not on a named branch." }, { status: 400 });
    }

    const upstream = (await git(["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"])).stdout;
    const status = (await git(["status", "--porcelain"])).stdout;
    const dirtyFiles = status ? status.split("\n").filter(Boolean).length : 0;

    const fetchResult = await git(["fetch", "--prune", "origin"]);
    const beforeHead = (await git(["rev-parse", "--short=12", "HEAD"])).stdout;
    const countsBefore = parseAheadBehind((await git(["rev-list", "--left-right", "--count", `HEAD...${upstream}`])).stdout);

    if (countsBefore.behind === 0) {
      return NextResponse.json({
        ok: true,
        didFetch: true,
        didUpdate: false,
        message: "Already up to date after fetch.",
        branch,
        upstream,
        beforeHead,
        afterHead: beforeHead,
        ahead: countsBefore.ahead,
        behind: countsBefore.behind,
        dirtyFiles,
        fetchOutput: fetchResult.stderr || fetchResult.stdout,
      });
    }

    if (dirtyFiles > 0) {
      return NextResponse.json(
        {
          ok: false,
          didFetch: true,
          didUpdate: false,
          error: "Fetch completed, but update was skipped because the working tree has uncommitted changes.",
          branch,
          upstream,
          beforeHead,
          afterHead: beforeHead,
          ahead: countsBefore.ahead,
          behind: countsBefore.behind,
          dirtyFiles,
          fetchOutput: fetchResult.stderr || fetchResult.stdout,
        },
        { status: 409 }
      );
    }

    const pullResult = await git(["pull", "--ff-only"]);
    const afterHead = (await git(["rev-parse", "--short=12", "HEAD"])).stdout;
    const countsAfter = parseAheadBehind((await git(["rev-list", "--left-right", "--count", `HEAD...${upstream}`])).stdout);

    return NextResponse.json({
      ok: true,
      didFetch: true,
      didUpdate: beforeHead !== afterHead,
      message: beforeHead === afterHead ? "Already up to date." : "Updated from GitHub with fast-forward.",
      branch,
      upstream,
      beforeHead,
      afterHead,
      ahead: countsAfter.ahead,
      behind: countsAfter.behind,
      dirtyFiles,
      fetchOutput: fetchResult.stderr || fetchResult.stdout,
      pullOutput: pullResult.stdout || pullResult.stderr,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
