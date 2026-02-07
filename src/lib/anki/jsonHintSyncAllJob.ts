import "server-only";

import fs from "node:fs";
import path from "node:path";

import { createAnkiConnectClient } from "@/lib/AnkiConnect";
import { WordAnkiConstants } from "@/lib/AnkiDeck";
import { WORD_ANKI_FIELD_GENERATORS, getAnkiLinkIdFromNoteFields } from "@/lib/anki/wordAnkiMapping";
import { getWordFieldAudioAbsolutePath } from "@/lib/audio/wordFieldAudioPaths.server";
import { prisma } from "@/lib/prisma";

export type JsonHintSyncAllStatus = {
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

type State = JsonHintSyncAllStatus & { _started: boolean };

function nowIso() {
  return new Date().toISOString();
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function escapeRegex(input: string) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractSoundFilenames(value: string): string[] {
  const out: string[] = [];
  const re = /\[sound:(?<fn>[^\]]+)\]/gi;
  for (;;) {
    const m = re.exec(value);
    if (!m) break;
    const fn = m.groups?.fn?.trim();
    if (fn) out.push(fn);
  }
  return out;
}

function resolveLocalAudioAbsPath(filename: string): string | null {
  const candidates: string[] = [];
  try {
    candidates.push(getWordFieldAudioAbsolutePath(filename));
  } catch {
    // ignore
  }

  candidates.push(path.join(process.cwd(), "public", "audio", "pictureWord", filename));
  candidates.push(path.join(process.cwd(), "public", "audio", filename));

  for (const abs of candidates) {
    try {
      const st = fs.statSync(abs);
      if (st.isFile() && st.size > 0) return abs;
    } catch {
      // ignore
    }
  }
  return null;
}

async function storeMediaFile(
  filename: string,
  dataB64: string,
  anki: ReturnType<typeof createAnkiConnectClient>,
) {
  const res = await anki.requestDetailed("storeMediaFile", {
    filename,
    data: dataB64,
    deleteExisting: true,
  });
  if (!res.ok) return { ok: false as const, error: res.error };
  return { ok: true as const };
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

function getState(): State {
  const g = globalThis as unknown as { __jsonHintSyncAll?: State };
  if (!g.__jsonHintSyncAll) {
    g.__jsonHintSyncAll = {
      jobId: `json_hint_sync_${Date.now()}`,
      running: false,
      done: false,
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
  return g.__jsonHintSyncAll;
}

export function getJsonHintSyncAllStatus(): JsonHintSyncAllStatus {
  const s = getState();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { _started: _ignored, ...pub } = s;
  return pub;
}

class AnkiMediaSync {
  private knownExists = new Set<string>();
  private inflight = new Map<string, Promise<boolean>>();
  private dataB64Cache = new Map<string, string>();
  private readonly anki: ReturnType<typeof createAnkiConnectClient>;
  private readonly uploaders: Array<ReturnType<typeof createAnkiConnectClient>>;
  private readonly onUploaded: (count: number) => void;
  private readonly onUploadFailed: () => void;

  constructor(options: {
    anki: ReturnType<typeof createAnkiConnectClient>;
    uploaders: Array<ReturnType<typeof createAnkiConnectClient>>;
    onUploaded: (count: number) => void;
    onUploadFailed: () => void;
  }) {
    this.anki = options.anki;
    this.uploaders = options.uploaders;
    this.onUploaded = options.onUploaded;
    this.onUploadFailed = options.onUploadFailed;
  }

  async ensureUploadedForValues(values: string[]): Promise<void> {
    const filenames = Array.from(
      new Set(values.flatMap((v) => extractSoundFilenames(v))),
    );
    if (!filenames.length) return;
    await this.ensureUploadedFilenames(filenames);
  }

  private async ensureUploadedFilenames(filenames: string[]): Promise<void> {
    const unique = Array.from(
      new Set(filenames.map((x) => String(x ?? "").trim()).filter(Boolean)),
    );
    if (!unique.length) return;

    const toCheck = unique.filter((fn) => !this.knownExists.has(fn));
    if (!toCheck.length) return;

    for (const group of chunk(toCheck, 50)) {
      const existing = await this.getExistingMediaNames(group);
      for (const fn of existing) this.knownExists.add(fn);
    }

    const missing = unique.filter((fn) => !this.knownExists.has(fn));
    if (!missing.length) return;

    await runWithConcurrency(missing, Math.min(12, this.uploaders.length || 1), async (fn) => {
      await this.ensureUploadedOne(fn);
    });
  }

  private async ensureUploadedOne(filename: string): Promise<boolean> {
    const fn = filename.trim();
    if (!fn) return true;
    if (this.knownExists.has(fn)) return true;

    const existing = this.inflight.get(fn);
    if (existing) return existing;

    const promise = (async () => {
      const existing = await this.getExistingMediaNames([fn]);
      if (existing.has(fn)) {
        this.knownExists.add(fn);
        return true;
      }

      const absPath = resolveLocalAudioAbsPath(fn);
      if (!absPath) {
        this.onUploadFailed();
        return false;
      }

      let dataB64 = this.dataB64Cache.get(fn) ?? "";
      if (!dataB64) {
        try {
          dataB64 = fs.readFileSync(absPath).toString("base64");
        } catch {
          this.onUploadFailed();
          return false;
        }
        if (!dataB64) {
          this.onUploadFailed();
          return false;
        }
        if (this.dataB64Cache.size > 250) this.dataB64Cache.clear();
        this.dataB64Cache.set(fn, dataB64);
      }

      const uploader = this.uploaders[Math.abs(hashString(fn)) % this.uploaders.length]!;
      const uploaded = await storeMediaFile(fn, dataB64, uploader);
      if (!uploaded.ok) {
        this.onUploadFailed();
        return false;
      }

      this.knownExists.add(fn);
      this.onUploaded(1);
      return true;
    })().finally(() => {
      this.inflight.delete(fn);
    });

    this.inflight.set(fn, promise);
    return promise;
  }

  private async getExistingMediaNames(filenames: string[]): Promise<Set<string>> {
    const safeNames = filenames.map((x) => x.trim()).filter(Boolean);
    if (!safeNames.length) return new Set();

    const pattern = `^(?:${safeNames.map((n) => escapeRegex(n)).join("|")})$`;
    const res = await this.anki.requestDetailed("getMediaFilesNames", { pattern });
    if (res.ok) {
      const names = (res.result ?? []).map((x) => String(x ?? "").trim()).filter(Boolean);
      return new Set(names);
    }

    // Fallback: check individually (still capped by our 50-batch loop).
    const out = new Set<string>();
    for (const fn of safeNames) {
      const one = await this.anki.requestDetailed("getMediaFilesNames", { pattern: fn });
      if (!one.ok) continue;
      const names = (one.result ?? []).map((x) => String(x ?? "").trim()).filter(Boolean);
      if (names.includes(fn)) out.add(fn);
    }
    return out;
  }
}

function hashString(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i += 1) {
    h = (h * 31 + input.charCodeAt(i)) | 0;
  }
  return h;
}

async function updateNoteJsonHintAndFirstLetterHints(
  noteId: number,
  fields: {
    json_hint: string;
    first_letter_fa_hint: string;
    first_letter_en_hint: string;
  },
  anki: ReturnType<typeof createAnkiConnectClient>,
) {
  const res = await anki.requestDetailed("updateNoteFields", {
    note: { id: noteId, fields },
  });
  if (!res.ok) return { ok: false as const, error: res.error };
  return { ok: true as const };
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

  const modelName = WordAnkiConstants.noteTypes.META_LEX_VR9;
  const query = `note:"${modelName.replaceAll('"', '\\"')}"`;

  const ankiFinder = createAnkiConnectClient({ timeoutMs: 30000, retryDelayMs: 1000 });
  const idsRes = await ankiFinder.requestDetailed("findNotes", { query });
  if (!idsRes.ok) throw new Error(idsRes.error);
  const ids = idsRes.result ?? [];
  state.total = ids.length;

  // Preload current fields + anki_link_id to avoid extra notesInfo per note.
  const beforeByNoteId = new Map<
    number,
    {
      ankiLinkId: string | null;
      jsonHint: string;
      firstLetterFaHint: string;
      firstLetterEnHint: string;
    }
  >();
  for (const batch of chunk(ids, 250)) {
    const infoRes = await ankiFinder.requestDetailed("notesInfo", { notes: batch });
    if (!infoRes.ok) throw new Error(infoRes.error);
    for (const n of infoRes.result ?? []) {
      const ankiLinkId = getAnkiLinkIdFromNoteFields(n);
      beforeByNoteId.set(n.noteId, {
        ankiLinkId,
        jsonHint: String(n.fields?.json_hint?.value ?? ""),
        firstLetterFaHint: String(n.fields?.first_letter_fa_hint?.value ?? ""),
        firstLetterEnHint: String(n.fields?.first_letter_en_hint?.value ?? ""),
      });
    }
  }

  // Preload DB words (read-only) for faster bulk processing.
  const allIds = Array.from(
    new Set(
      Array.from(beforeByNoteId.values())
        .map((x) => x.ankiLinkId)
        .filter((x): x is string => Boolean(x)),
    ),
  );

  const wordByAnkiLinkId = new Map<string, Awaited<ReturnType<typeof prisma.word.findFirst>>>();
  for (const group of chunk(allIds, 1000)) {
    const rows = await prisma.word.findMany({
      where: { anki_link_id: { in: group } },
    });
    for (const r of rows) wordByAnkiLinkId.set(r.anki_link_id, r);
  }

  const concurrency = 20;
  const clients = Array.from({ length: concurrency }, () =>
    createAnkiConnectClient({ timeoutMs: 30000, retryDelayMs: 1000 }),
  );

  const mediaSync = new AnkiMediaSync({
    anki: ankiFinder,
    uploaders: clients,
    onUploaded: (count) => {
      state.mediaUploaded += count;
    },
    onUploadFailed: () => {
      state.failed += 1;
    },
  });

  await runWithConcurrency(ids, concurrency, async (noteId) => {
    if (state.stopRequested) return;
    state.currentNoteId = noteId;

    const before = beforeByNoteId.get(noteId);
    const ankiLinkId = before?.ankiLinkId ?? null;
    if (!ankiLinkId) {
      state.skippedNoLinkId += 1;
      state.processed += 1;
      return;
    }

    const word = wordByAnkiLinkId.get(ankiLinkId) ?? null;
    if (!word) {
      state.skippedNoWord += 1;
      state.processed += 1;
      return;
    }

    const [jsonHint, firstLetterFaHint, firstLetterEnHint] = await Promise.all([
      WORD_ANKI_FIELD_GENERATORS.json_hint(word),
      WORD_ANKI_FIELD_GENERATORS.first_letter_fa_hint(word),
      WORD_ANKI_FIELD_GENERATORS.first_letter_en_hint(word),
    ]);

    await mediaSync.ensureUploadedForValues([jsonHint, firstLetterFaHint, firstLetterEnHint]);

    const same =
      jsonHint === (before?.jsonHint ?? "") &&
      firstLetterFaHint === (before?.firstLetterFaHint ?? "") &&
      firstLetterEnHint === (before?.firstLetterEnHint ?? "");

    if (same) {
      state.skippedSame += 1;
      state.processed += 1;
      return;
    }

    await mediaSync.ensureUploadedForValues([jsonHint, firstLetterFaHint, firstLetterEnHint]);

    const anki = clients[Math.abs(noteId) % clients.length]!;
    const updated = await updateNoteJsonHintAndFirstLetterHints(
      noteId,
      {
        json_hint: jsonHint,
        first_letter_fa_hint: firstLetterFaHint,
        first_letter_en_hint: firstLetterEnHint,
      },
      anki,
    );
    if (!updated.ok) state.failed += 1;
    else state.updated += 1;

    state.processed += 1;
  });

  if (state.stopRequested && state.processed < state.total) {
    state.stoppedEarly = true;
  }

  state.running = false;
  state.done = true;
  state.finishedAt = nowIso();
  state.currentNoteId = null;
}

export function startJsonHintSyncAllIfNeeded(): JsonHintSyncAllStatus {
  const state = getState();
  if (state.running) return getJsonHintSyncAllStatus();
  if (state._started && !state.done) return getJsonHintSyncAllStatus();

  state.jobId = `json_hint_sync_${Date.now()}`;
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

  return getJsonHintSyncAllStatus();
}

export function requestStopJsonHintSyncAll(): JsonHintSyncAllStatus {
  const state = getState();
  state.stopRequested = true;
  return getJsonHintSyncAllStatus();
}
