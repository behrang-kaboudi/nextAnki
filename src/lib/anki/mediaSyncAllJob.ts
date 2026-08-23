import "server-only";

import fs from "node:fs";
import path from "node:path";

import { createAnkiConnectClient } from "@/lib/anki";
import {
  acquireWordSyncJobLock,
  getActiveWordSyncJob,
} from "@/lib/anki/wordSyncJobLock";

export type MediaSyncAllStatus = {
  jobId: string;
  running: boolean;
  done: boolean;
  startedAt: string | null;
  finishedAt: string | null;
  error: string | null;

  stopRequested: boolean;
  stoppedEarly: boolean;

  total: number;
  processed: number;
  updated: number;
  skippedSame: number;
  skippedNoLinkId: number;
  skippedNoWord: number;
  failed: number;
  failureSamples: Array<{ filename: string; error: string }>;
  mediaUploaded: number;
  mediaDeleted: number;
  currentNoteId: number | null;
  mode: "missing" | "changed";
};

type State = MediaSyncAllStatus & { _started: boolean };

function nowIso() {
  return new Date().toISOString();
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  const c = Math.max(1, Math.trunc(concurrency) || 1);
  let idx = 0;
  const runners = Array.from(
    { length: Math.min(c, items.length) },
    async () => {
      for (;;) {
        const i = idx;
        idx += 1;
        if (i >= items.length) return;
        await worker(items[i]);
      }
    },
  );
  await Promise.all(runners);
}

function escapeRegex(input: string) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getState(): State {
  const g = globalThis as unknown as { __mediaSyncAll?: State };
  if (!g.__mediaSyncAll) {
    g.__mediaSyncAll = {
      jobId: `media_sync_${Date.now()}`,
      running: false,
      done: true,
      startedAt: null,
      finishedAt: null,
      error: null,
      stopRequested: false,
      stoppedEarly: false,
      total: 0,
      processed: 0,
      updated: 0,
      skippedSame: 0,
      skippedNoLinkId: 0,
      skippedNoWord: 0,
      failed: 0,
      failureSamples: [],
      mediaUploaded: 0,
      mediaDeleted: 0,
      currentNoteId: null,
      mode: "missing",
      _started: false,
    };
  }
  return g.__mediaSyncAll;
}

export function getMediaSyncAllStatus(): MediaSyncAllStatus {
  const s = getState();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { _started: _ignored, ...pub } = s;
  return pub;
}

function listMediaFiles(): Array<{
  filename: string;
  absPath: string;
  size: number;
  mtimeMs: number;
}> {
  const rootDir = path.join(process.cwd(), "public", "audio");
  const byFilename = new Map<
    string,
    { absPath: string; size: number; mtimeMs: number }
  >();

  const visit = (dir: string) => {
    let entries: fs.Dirent[] = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (!entry.name || entry.name.startsWith(".")) continue;
      const absPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        visit(absPath);
        continue;
      }
      if (!entry.isFile()) continue;
      let st: fs.Stats | null = null;
      try {
        st = fs.statSync(absPath);
      } catch {
        continue;
      }
      if (!st.isFile() || st.size <= 0) continue;

      const prev = byFilename.get(entry.name);
      if (prev && prev.absPath !== absPath) {
        throw new Error(
          `Duplicate Anki media filename in public/audio: ${entry.name}`,
        );
      }
      byFilename.set(entry.name, {
        absPath,
        size: st.size,
        mtimeMs: st.mtimeMs,
      });
    }
  };

  visit(rootDir);

  return Array.from(byFilename.entries())
    .map(([filename, info]) => ({
      filename,
      absPath: info.absPath,
      size: info.size,
      mtimeMs: info.mtimeMs,
    }))
    .sort((a, b) => a.filename.localeCompare(b.filename));
}

async function storeMediaFile(
  filename: string,
  dataB64: string,
  anki: ReturnType<typeof createAnkiConnectClient>,
  deleteExisting = false,
) {
  const res = await anki.requestDetailed("storeMediaFile", {
    filename,
    data: dataB64,
    deleteExisting,
  });
  if (!res.ok) return { ok: false as const, error: res.error };
  return { ok: true as const };
}

function isFileAlreadyExistsError(message: string) {
  const m = (message ?? "").toLowerCase();
  return m.includes("already") && m.includes("exist");
}

function listAnkiMediaDirNames(mediaDir: string): Set<string> {
  let entries: string[] = [];
  try {
    entries = fs.readdirSync(mediaDir).filter((x) => x && !x.startsWith("."));
  } catch {
    return new Set();
  }
  return new Set(entries);
}

function mediaFileContentDiffers(
  sourcePath: string,
  targetPath: string,
): boolean {
  try {
    const source = fs.readFileSync(sourcePath);
    const target = fs.readFileSync(targetPath);
    return source.length !== target.length || !source.equals(target);
  } catch {
    return false;
  }
}

async function runJob(state: State) {
  const releaseLock = acquireWordSyncJobLock(
    state.mode === "changed"
      ? "copy changed Anki media"
      : "copy missing Anki media",
    "media",
  );
  try {
    state.running = true;
    state.done = false;
    state.error = null;
    state.stopRequested = false;
    state.stoppedEarly = false;
    state.startedAt = nowIso();
    state.finishedAt = null;
    state.total = 0;
    state.processed = 0;
    state.updated = 0;
    state.skippedSame = 0;
    state.skippedNoLinkId = 0;
    state.skippedNoWord = 0;
    state.failed = 0;
    state.failureSamples = [];
    state.mediaUploaded = 0;
    state.mediaDeleted = 0;
    state.currentNoteId = null;

    const anki = createAnkiConnectClient({
      timeoutMs: 30000,
      retryDelayMs: 1000,
    });
    const files = listMediaFiles();
    state.total = files.length;

    const mediaDirRes = await anki.requestDetailed("getMediaDirPath");
    const mediaDir = mediaDirRes.ok
      ? String(mediaDirRes.result ?? "").trim()
      : "";

    if (mediaDir) {
      const existing = listAnkiMediaDirNames(mediaDir);
      const candidates =
        state.mode === "changed"
          ? files.filter((file) => {
              if (!existing.has(file.filename)) return false;
              try {
                const target = fs.statSync(path.join(mediaDir, file.filename));
                return (
                  target.isFile() &&
                  mediaFileContentDiffers(
                    file.absPath,
                    path.join(mediaDir, file.filename),
                  )
                );
              } catch {
                return false;
              }
            })
          : files.filter((f) => !existing.has(f.filename));
      const alreadyCount = Math.max(0, files.length - candidates.length);
      state.skippedSame = alreadyCount;
      state.processed = alreadyCount;

      const concurrency = 32;
      const changedClients =
        state.mode === "changed"
          ? Array.from({ length: 12 }, () =>
              createAnkiConnectClient({ timeoutMs: 30000, retryDelayMs: 1000 }),
            )
          : [];
      await runWithConcurrency(candidates, concurrency, async (file) => {
        if (state.stopRequested) return;
        state.currentNoteId = null;

        const outPath = path.join(mediaDir, file.filename);
        try {
          if (state.mode === "changed") {
            const dataB64 = (await fs.promises.readFile(file.absPath)).toString(
              "base64",
            );
            const client =
              changedClients[
                Math.abs(hashString(file.filename)) % changedClients.length
              ]!;
            const uploaded = await storeMediaFile(
              file.filename,
              dataB64,
              client,
              true,
            );
            if (!uploaded.ok) {
              state.failed += 1;
              if (state.failureSamples.length < 20) {
                state.failureSamples.push({
                  filename: file.filename,
                  error: uploaded.error,
                });
              }
              state.processed += 1;
              return;
            }
          } else {
            await fs.promises.copyFile(
              file.absPath,
              outPath,
              fs.constants.COPYFILE_EXCL,
            );
            await fs.promises.utimes(
              outPath,
              file.mtimeMs / 1000,
              file.mtimeMs / 1000,
            );
          }
        } catch (e) {
          const code = (e as NodeJS.ErrnoException | null)?.code ?? "";
          if (code === "EEXIST") {
            state.skippedSame += 1;
          } else {
            state.failed += 1;
            if (state.failureSamples.length < 20) {
              state.failureSamples.push({
                filename: file.filename,
                error: e instanceof Error ? e.message : String(e),
              });
            }
          }
          state.processed += 1;
          return;
        }

        state.updated += 1;
        state.mediaUploaded += 1;
        state.processed += 1;
      });
    } else {
      // Fallback: use AnkiConnect API uploads.
      const filenameGroups = chunk(
        files.map((f) => f.filename),
        50,
      );
      const exists = new Set<string>();
      for (const group of filenameGroups) {
        if (state.stopRequested) break;
        const safeNames = group.map((x) => x.trim()).filter(Boolean);
        if (!safeNames.length) continue;
        const pattern = `^(?:${safeNames.map((n) => escapeRegex(n)).join("|")})$`;
        const res = await anki.requestDetailed("getMediaFilesNames", {
          pattern,
        });
        if (!res.ok) continue;
        const names = (res.result ?? [])
          .map((x) => String(x ?? "").trim())
          .filter(Boolean);
        for (const fn of names) exists.add(fn);
      }

      const missing = files.filter((f) => !exists.has(f.filename));
      // Without direct access to Anki's media directory there is no content hash
      // to compare. Changed mode therefore safely overwrites every local file.
      const candidates = state.mode === "changed" ? files : missing;
      const alreadyCount =
        state.mode === "changed"
          ? 0
          : Math.max(0, files.length - missing.length);
      state.skippedSame = alreadyCount;
      state.processed = alreadyCount;

      const concurrency = 12;
      const clients = Array.from({ length: concurrency }, () =>
        createAnkiConnectClient({ timeoutMs: 30000, retryDelayMs: 1000 }),
      );

      await runWithConcurrency(candidates, concurrency, async (file) => {
        if (state.stopRequested) return;
        state.currentNoteId = null;

        let dataB64 = "";
        try {
          dataB64 = (await fs.promises.readFile(file.absPath)).toString(
            "base64",
          );
        } catch (error) {
          state.failed += 1;
          if (state.failureSamples.length < 20) {
            state.failureSamples.push({
              filename: file.filename,
              error: error instanceof Error ? error.message : String(error),
            });
          }
          state.processed += 1;
          return;
        }
        if (!dataB64) {
          state.failed += 1;
          if (state.failureSamples.length < 20) {
            state.failureSamples.push({
              filename: file.filename,
              error: "Local media file is empty.",
            });
          }
          state.processed += 1;
          return;
        }

        const client =
          clients[Math.abs(hashString(file.filename)) % clients.length]!;
        const res = await storeMediaFile(
          file.filename,
          dataB64,
          client,
          state.mode === "changed",
        );
        if (!res.ok) {
          if (isFileAlreadyExistsError(res.error)) state.skippedSame += 1;
          else {
            state.failed += 1;
            if (state.failureSamples.length < 20) {
              state.failureSamples.push({
                filename: file.filename,
                error: res.error,
              });
            }
          }
        } else {
          state.updated += 1;
          state.mediaUploaded += 1;
        }

        state.processed += 1;
      });
    }

    if (state.stopRequested && state.processed < state.total)
      state.stoppedEarly = true;
    state.running = false;
    state.done = true;
    state.finishedAt = nowIso();
    state.currentNoteId = null;
  } finally {
    releaseLock();
  }
}

function hashString(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i += 1) {
    h = (h * 31 + input.charCodeAt(i)) | 0;
  }
  return h;
}

export function startMediaSyncAllIfNeeded(opts?: {
  mode?: "missing" | "changed";
}): MediaSyncAllStatus {
  const state = getState();
  if (state.running) return getMediaSyncAllStatus();
  if (state._started && !state.done) return getMediaSyncAllStatus();
  const active = getActiveWordSyncJob("media");
  if (active) {
    state.running = false;
    state.done = true;
    state.error = `Anki word sync job "${active.name}" is already running (started ${active.startedAt}).`;
    return getMediaSyncAllStatus();
  }

  state.jobId = `media_sync_${Date.now()}`;
  state._started = true;
  state.mode = opts?.mode ?? "missing";
  state.stopRequested = false;
  state.stoppedEarly = false;

  void runJob(state).catch((e) => {
    state.running = false;
    state.done = true;
    state.error = e instanceof Error ? e.message : String(e);
    state.finishedAt = nowIso();
    state.currentNoteId = null;
  });

  return getMediaSyncAllStatus();
}

export function requestStopMediaSyncAll(): MediaSyncAllStatus {
  const state = getState();
  state.stopRequested = true;
  return getMediaSyncAllStatus();
}
