import "server-only";

import fs from "node:fs";
import path from "node:path";

import { createAnkiConnectClient } from "@/lib/AnkiConnect";

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
  mediaUploaded: number;
  mediaDeleted: number;
  currentNoteId: number | null;
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
      mediaUploaded: 0,
      mediaDeleted: 0,
      currentNoteId: null,
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

function listMediaFiles(): Array<{ filename: string; absPath: string; size: number }> {
  const dirs = [
    path.join(process.cwd(), "public", "audio", "pictureWord"),
    path.join(process.cwd(), "public", "audio", "words"),
  ];

  const byFilename = new Map<string, { absPath: string; size: number }>();

  for (const dir of dirs) {
    let entries: string[] = [];
    try {
      entries = fs.readdirSync(dir).filter((x) => x && !x.startsWith("."));
    } catch {
      continue;
    }

    for (const filename of entries) {
      const absPath = path.join(dir, filename);
      let st: fs.Stats | null = null;
      try {
        st = fs.statSync(absPath);
      } catch {
        continue;
      }
      if (!st.isFile() || st.size <= 0) continue;

      const prev = byFilename.get(filename);
      if (!prev || st.size > prev.size) {
        byFilename.set(filename, { absPath, size: st.size });
      }
    }
  }

  return Array.from(byFilename.entries())
    .map(([filename, info]) => ({ filename, absPath: info.absPath, size: info.size }))
    .sort((a, b) => a.filename.localeCompare(b.filename));
}

async function storeMediaFile(
  filename: string,
  dataB64: string,
  anki: ReturnType<typeof createAnkiConnectClient>,
) {
  const res = await anki.requestDetailed("storeMediaFile", {
    filename,
    data: dataB64,
    deleteExisting: false,
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

async function runJob(state: State) {
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
  state.mediaUploaded = 0;
  state.mediaDeleted = 0;
  state.currentNoteId = null;

  const anki = createAnkiConnectClient({ timeoutMs: 30000, retryDelayMs: 1000 });
  const files = listMediaFiles();
  state.total = files.length;

  const mediaDirRes = await anki.requestDetailed("getMediaDirPath");
  const mediaDir = mediaDirRes.ok ? String(mediaDirRes.result ?? "").trim() : "";

  if (mediaDir) {
    const existing = listAnkiMediaDirNames(mediaDir);
    const missing = files.filter((f) => !existing.has(f.filename));
    const alreadyCount = Math.max(0, files.length - missing.length);
    state.skippedSame = alreadyCount;
    state.processed = alreadyCount;

    const concurrency = 32;
    await runWithConcurrency(missing, concurrency, async (file) => {
      if (state.stopRequested) return;
      state.currentNoteId = null;

      const outPath = path.join(mediaDir, file.filename);
      try {
        fs.copyFileSync(file.absPath, outPath, fs.constants.COPYFILE_EXCL);
      } catch (e) {
        const code = (e as NodeJS.ErrnoException | null)?.code ?? "";
        if (code === "EEXIST") {
          state.skippedSame += 1;
        } else {
          state.failed += 1;
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
    const filenameGroups = chunk(files.map((f) => f.filename), 50);
    const exists = new Set<string>();
    for (const group of filenameGroups) {
      if (state.stopRequested) break;
      const safeNames = group.map((x) => x.trim()).filter(Boolean);
      if (!safeNames.length) continue;
      const pattern = `^(?:${safeNames.map((n) => escapeRegex(n)).join("|")})$`;
      const res = await anki.requestDetailed("getMediaFilesNames", { pattern });
      if (!res.ok) continue;
      const names = (res.result ?? []).map((x) => String(x ?? "").trim()).filter(Boolean);
      for (const fn of names) exists.add(fn);
    }

    const missing = files.filter((f) => !exists.has(f.filename));
    const alreadyCount = Math.max(0, files.length - missing.length);
    state.skippedSame = alreadyCount;
    state.processed = alreadyCount;

    const concurrency = 12;
    const clients = Array.from({ length: concurrency }, () =>
      createAnkiConnectClient({ timeoutMs: 30000, retryDelayMs: 1000 }),
    );

    await runWithConcurrency(missing, concurrency, async (file) => {
      if (state.stopRequested) return;
      state.currentNoteId = null;

      let dataB64 = "";
      try {
        dataB64 = fs.readFileSync(file.absPath).toString("base64");
      } catch {
        state.failed += 1;
        state.processed += 1;
        return;
      }
      if (!dataB64) {
        state.failed += 1;
        state.processed += 1;
        return;
      }

      const client = clients[Math.abs(hashString(file.filename)) % clients.length]!;
      const res = await storeMediaFile(file.filename, dataB64, client);
      if (!res.ok) {
        if (isFileAlreadyExistsError(res.error)) state.skippedSame += 1;
        else state.failed += 1;
      } else {
        state.updated += 1;
        state.mediaUploaded += 1;
      }

      state.processed += 1;
    });
  }

  if (state.stopRequested && state.processed < state.total) state.stoppedEarly = true;
  state.running = false;
  state.done = true;
  state.finishedAt = nowIso();
  state.currentNoteId = null;
}

function hashString(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i += 1) {
    h = (h * 31 + input.charCodeAt(i)) | 0;
  }
  return h;
}

export function startMediaSyncAllIfNeeded(): MediaSyncAllStatus {
  const state = getState();
  if (state.running) return getMediaSyncAllStatus();
  if (state._started && !state.done) return getMediaSyncAllStatus();

  state.jobId = `media_sync_${Date.now()}`;
  state._started = true;
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
