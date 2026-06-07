import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type GitComparison = {
  branch: string | null;
  localHead: string | null;
  upstream: string | null;
  upstreamHead: string | null;
  githubHead: string | null;
  ahead: number | null;
  behind: number | null;
  dirtyFiles: number;
  relation: "same" | "different" | "unknown";
  error: string | null;
};

async function git(args: string[]) {
  const { stdout } = await execFileAsync("git", args, {
    cwd: process.cwd(),
    timeout: 8000,
    maxBuffer: 1024 * 1024,
  });
  return stdout.trim();
}

async function optionalGit(args: string[]) {
  try {
    return await git(args);
  } catch {
    return null;
  }
}

function parseAheadBehind(value: string | null) {
  if (!value) return { ahead: null, behind: null };
  const [aheadRaw, behindRaw] = value.split(/\s+/);
  const ahead = Number(aheadRaw);
  const behind = Number(behindRaw);
  return {
    ahead: Number.isFinite(ahead) ? ahead : null,
    behind: Number.isFinite(behind) ? behind : null,
  };
}

export async function getGitComparison(): Promise<GitComparison> {
  try {
    const branch = await optionalGit(["branch", "--show-current"]);
    const localHead = await optionalGit(["rev-parse", "--short=12", "HEAD"]);
    const upstream = await optionalGit(["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"]);
    const upstreamHead = upstream ? await optionalGit(["rev-parse", "--short=12", upstream]) : null;
    const remoteBranch = branch ? `refs/heads/${branch}` : null;
    const remoteLine = remoteBranch ? await optionalGit(["ls-remote", "origin", remoteBranch]) : null;
    const githubHead = remoteLine?.split(/\s+/)[0]?.slice(0, 12) ?? null;
    const status = await optionalGit(["status", "--porcelain"]);
    const dirtyFiles = status ? status.split("\n").filter(Boolean).length : 0;
    const counts = parseAheadBehind(upstream ? await optionalGit(["rev-list", "--left-right", "--count", `HEAD...${upstream}`]) : null);

    return {
      branch: branch || null,
      localHead,
      upstream,
      upstreamHead,
      githubHead,
      ahead: counts.ahead,
      behind: counts.behind,
      dirtyFiles,
      relation: localHead && githubHead ? (localHead === githubHead ? "same" : "different") : "unknown",
      error: null,
    };
  } catch (error) {
    return {
      branch: null,
      localHead: null,
      upstream: null,
      upstreamHead: null,
      githubHead: null,
      ahead: null,
      behind: null,
      dirtyFiles: 0,
      relation: "unknown",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
