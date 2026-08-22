#!/usr/bin/env node

import { execFile } from "node:child_process";
import {
  closeSync,
  mkdirSync,
  openSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { spawn } from "node:child_process";

const execFileAsync = promisify(execFile);
const projectRoot = realpathSync(join(dirname(fileURLToPath(import.meta.url)), ".."));
const runtimeDir = join(projectRoot, ".next");
const statePath = join(runtimeDir, "dev-server.json");
const logPath = join(runtimeDir, "dev-server.log");
const nextEntry = join(projectRoot, "node_modules", "next", "dist", "bin", "next");
const port = Number(process.env.DEV_SERVER_PORT ?? process.env.PORT ?? 3009);
const host = process.env.DEV_SERVER_HOST ?? "localhost";
const baseUrl = process.env.DEV_SERVER_URL ?? `http://${host.includes(":") ? `[${host}]` : host}:${port}`;
const force = process.argv.includes("--force");

function fail(message) {
  throw new Error(message);
}

function isAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    // A sandbox may deny signals while still allowing read-only process inspection.
    return error?.code === "EPERM";
  }
}

async function commandOutput(command, args) {
  try {
    const { stdout } = await execFileAsync(command, args, { encoding: "utf8" });
    return stdout.trim();
  } catch {
    return "";
  }
}

async function processCwd(pid) {
  if (process.platform === "linux") {
    try {
      return realpathSync(`/proc/${pid}/cwd`);
    } catch {
      return "";
    }
  }

  const output = await commandOutput("lsof", ["-a", "-p", String(pid), "-d", "cwd", "-Fn"]);
  const cwdLine = output.split("\n").find((line) => line.startsWith("n"));
  if (!cwdLine) return "";
  try {
    return realpathSync(cwdLine.slice(1));
  } catch {
    return "";
  }
}

async function processCommand(pid) {
  if (process.platform === "linux") {
    try {
      return readFileSync(`/proc/${pid}/cmdline`, "utf8").replaceAll("\0", " ");
    } catch {
      return "";
    }
  }
  return commandOutput("ps", ["-p", String(pid), "-o", "command="]);
}

async function hasNextDevLock(pid) {
  const lockPath = join(projectRoot, ".next", "dev", "lock");
  const output = await commandOutput("lsof", ["-a", "-p", String(pid), "-Fn", "--", lockPath]);
  return output.split("\n").some((line) => line === `n${lockPath}`);
}

async function verifyWorkspaceServer(pid, expectedPort, allowStarting = false) {
  if (!Number.isInteger(pid) || pid <= 1 || !isAlive(pid)) return false;
  if ((await processCwd(pid)) !== projectRoot) return false;

  const command = await processCommand(pid);
  const commandLooksRight =
    (command.includes(nextEntry) && /(?:^|\s)dev(?:\s|$)/.test(command)) ||
    command.includes("next-server");
  if (!commandLooksRight && !(await hasNextDevLock(pid))) return false;

  const listeners = await listenerPids(expectedPort);
  return allowStarting || listeners.includes(pid);
}

async function listenerPids(expectedPort) {
  const output = await commandOutput("lsof", [
    "-nP",
    `-iTCP:${expectedPort}`,
    "-sTCP:LISTEN",
    "-t",
  ]);
  return [...new Set(output.split(/\s+/).map(Number).filter(Number.isInteger))];
}

function readState() {
  try {
    const state = JSON.parse(readFileSync(statePath, "utf8"));
    if (state.projectRoot !== projectRoot) return null;
    return state;
  } catch {
    return null;
  }
}

function writeState(state) {
  mkdirSync(runtimeDir, { recursive: true });
  writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
}

function clearState() {
  rmSync(statePath, { force: true });
}

async function findListeningServer(expectedPort = port, expectedBaseUrl = baseUrl) {
  for (const pid of await listenerPids(expectedPort)) {
    if (await verifyWorkspaceServer(pid, expectedPort)) {
      return { pid, port: expectedPort, baseUrl: expectedBaseUrl, projectRoot };
    }
  }
  return null;
}

async function findServer() {
  const state = readState();
  if (state) {
    const valid = await verifyWorkspaceServer(state.pid, state.port);
    if (valid) return { ...state, tracked: true };
    clearState();
  }

  const server = await findListeningServer();
  return server ? { ...server, tracked: false, startedAt: null } : null;
}

async function waitForReady(url, pid, timeoutMs = 45_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!isAlive(pid)) fail(`Development server exited during startup. See ${logPath}`);
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1500) });
      if (response.status < 500) return;
    } catch {
      // The server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  fail(`Timed out waiting for ${url}. The server is still running; see ${logPath}`);
}

async function startServer() {
  const existing = await findServer();
  if (existing) {
    if (!existing.tracked) {
      writeState({
        pid: existing.pid,
        port: existing.port,
        baseUrl: existing.baseUrl,
        projectRoot,
        startedAt: null,
        adopted: true,
      });
    }
    console.log(`Development server is already running (PID ${existing.pid}) at ${existing.baseUrl}.`);
    return;
  }

  mkdirSync(runtimeDir, { recursive: true });
  const logFd = openSync(logPath, "a");
  const child = spawn(process.execPath, [nextEntry, "dev", "--webpack"], {
    cwd: projectRoot,
    detached: true,
    env: { ...process.env, PORT: String(port) },
    stdio: ["ignore", logFd, logFd],
  });
  closeSync(logFd);
  child.unref();

  writeState({
    pid: child.pid,
    port,
    baseUrl,
    projectRoot,
    startedAt: new Date().toISOString(),
    adopted: false,
  });

  try {
    await waitForReady(baseUrl, child.pid);
    const server = await findListeningServer();
    if (!server) fail("The server responded, but its listening PID could not be verified.");
    writeState({
      pid: server.pid,
      launcherPid: child.pid,
      port,
      baseUrl,
      projectRoot,
      startedAt: new Date().toISOString(),
      adopted: false,
    });
    console.log(`Development server is ready (PID ${server.pid}) at ${baseUrl}.`);
    console.log(`Log: ${logPath}`);
  } catch (error) {
    clearState();
    throw error;
  }
}

async function runForeground() {
  const existing = await findServer();
  if (existing) {
    console.log(
      `Switching the existing development server (PID ${existing.pid}) to this terminal...`,
    );
    await stopServer();
  }

  clearState();
  const child = spawn(process.execPath, [nextEntry, "dev", "--webpack"], {
    cwd: projectRoot,
    env: { ...process.env, PORT: String(port) },
    stdio: "inherit",
  });

  const exitCode = await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (signal === "SIGINT") resolve(0);
      else resolve(code ?? 1);
    });
  });
  process.exitCode = exitCode;
}

function runningJobNames(statuses) {
  return Object.entries(statuses ?? {})
    .filter(([, status]) => status && typeof status === "object" && status.running === true)
    .map(([name]) => name);
}

async function fetchRunningJobs(url) {
  const response = await fetch(`${url}/api/progress/stream`, {
    headers: { Accept: "text/event-stream" },
    signal: AbortSignal.timeout(7000),
  });
  if (!response.ok || !response.body) fail(`Job status endpoint returned HTTP ${response.status}.`);

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      for (const block of buffer.split("\n\n")) {
        if (!block.includes("event: snapshot")) continue;
        const dataLine = block.split("\n").find((line) => line.startsWith("data: "));
        if (dataLine) return runningJobNames(JSON.parse(dataLine.slice(6)).statuses);
      }
      const lastBoundary = buffer.lastIndexOf("\n\n");
      if (lastBoundary >= 0) buffer = buffer.slice(lastBoundary + 2);
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  fail("Job status endpoint closed without a snapshot.");
}

async function waitForExit(pid, timeoutMs = 12_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!isAlive(pid)) return true;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  return !isAlive(pid);
}

async function stopServer() {
  const server = await findServer();
  if (!server) {
    console.log("Development server is not running for this workspace.");
    return;
  }

  if (!force) {
    let jobs;
    try {
      jobs = await fetchRunningJobs(server.baseUrl);
    } catch (error) {
      fail(
        `Refusing to stop because active-job status could not be verified: ${error.message} ` +
          "Retry when the server is ready, or use `npm run dev:stop -- --force` after checking jobs manually.",
      );
    }
    if (jobs.length > 0) {
      fail(`Refusing to stop while these in-memory jobs are running: ${jobs.join(", ")}`);
    }
  }

  if (!(await verifyWorkspaceServer(server.pid, server.port))) {
    fail(`PID ${server.pid} no longer belongs to this workspace's Next.js development server.`);
  }

  process.kill(server.pid, "SIGINT");
  if (!(await waitForExit(server.pid))) {
    fail(`PID ${server.pid} did not exit after SIGINT; it was not force-killed.`);
  }
  clearState();
  console.log(`Development server stopped gracefully (PID ${server.pid}).`);
}

async function showStatus() {
  const server = await findServer();
  if (!server) {
    console.log("Development server: stopped");
    process.exitCode = 1;
    return;
  }
  console.log(`Development server: running (PID ${server.pid}, ${server.baseUrl})`);
  console.log(server.tracked ? "Ownership: tracked by this workspace" : "Ownership: verified from workspace cwd, Next.js lock, and listening port");
}

const action = process.argv[2];
try {
  if (action === "foreground") await runForeground();
  else if (action === "start") await startServer();
  else if (action === "stop") await stopServer();
  else if (action === "restart") {
    await stopServer();
    await startServer();
  } else if (action === "status") await showStatus();
  else fail("Usage: node scripts/dev-server.mjs <foreground|start|stop|restart|status> [--force]");
} catch (error) {
  console.error(`dev-server: ${error.message}`);
  process.exitCode = 1;
}
