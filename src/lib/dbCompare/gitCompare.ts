import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type GitComparison = {
  branch: string | null;
  localHead: string | null;
  localCommittedAt: string | null;
  upstream: string | null;
  upstreamHead: string | null;
  githubHead: string | null;
  githubCommittedAt: string | null;
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

function parseGitHubRepo(remoteUrl: string | null) {
  if (!remoteUrl) return null;

  const sshMatch = remoteUrl.match(/^git@github\.com:([^/]+)\/(.+?)(?:\.git)?$/);
  if (sshMatch) return { owner: sshMatch[1]!, repo: sshMatch[2]! };

  try {
    const url = new URL(remoteUrl);
    if (url.hostname !== "github.com") return null;
    const [owner, repoRaw] = url.pathname.replace(/^\/+/, "").split("/");
    if (!owner || !repoRaw) return null;
    return { owner, repo: repoRaw.replace(/\.git$/, "") };
  } catch {
    return null;
  }
}

async function getGitHubCommitInfo(remoteUrl: string | null, branch: string | null) {
  const repo = parseGitHubRepo(remoteUrl);
  if (!repo || !branch) return { head: null, committedAt: null };

  try {
    const url = `https://api.github.com/repos/${repo.owner}/${repo.repo}/commits/${encodeURIComponent(branch)}`;
    const response = await fetch(url, {
      headers: { Accept: "application/vnd.github+json" },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return { head: null, committedAt: null };

    const data = (await response.json()) as {
      sha?: string;
      commit?: { committer?: { date?: string }; author?: { date?: string } };
    };

    return {
      head: data.sha?.slice(0, 12) ?? null,
      committedAt: data.commit?.committer?.date ?? data.commit?.author?.date ?? null,
    };
  } catch {
    return { head: null, committedAt: null };
  }
}

export async function getGitComparison(): Promise<GitComparison> {
  try {
    const branch = await optionalGit(["branch", "--show-current"]);
    const localHead = await optionalGit(["rev-parse", "--short=12", "HEAD"]);
    const localCommittedAt = await optionalGit(["log", "-1", "--format=%cI", "HEAD"]);
    const upstream = await optionalGit(["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"]);
    const upstreamHead = upstream ? await optionalGit(["rev-parse", "--short=12", upstream]) : null;
    const remoteUrl = await optionalGit(["remote", "get-url", "origin"]);
    const githubInfo = await getGitHubCommitInfo(remoteUrl, branch || null);
    const remoteBranch = branch ? `refs/heads/${branch}` : null;
    const remoteLine = remoteBranch ? await optionalGit(["ls-remote", "origin", remoteBranch]) : null;
    const githubHead = githubInfo.head ?? remoteLine?.split(/\s+/)[0]?.slice(0, 12) ?? null;
    const status = await optionalGit(["status", "--porcelain"]);
    const dirtyFiles = status ? status.split("\n").filter(Boolean).length : 0;
    const counts = parseAheadBehind(upstream ? await optionalGit(["rev-list", "--left-right", "--count", `HEAD...${upstream}`]) : null);

    return {
      branch: branch || null,
      localHead,
      localCommittedAt,
      upstream,
      upstreamHead,
      githubHead,
      githubCommittedAt: githubInfo.committedAt,
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
      localCommittedAt: null,
      upstream: null,
      upstreamHead: null,
      githubHead: null,
      githubCommittedAt: null,
      ahead: null,
      behind: null,
      dirtyFiles: 0,
      relation: "unknown",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
