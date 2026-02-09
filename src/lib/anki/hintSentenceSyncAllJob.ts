import "server-only";

import fs from "node:fs";
import path from "node:path";

import { createAnkiConnectClient } from "@/lib/AnkiConnect";
import { WordAnkiConstants } from "@/lib/AnkiDeck/constants";
import { prisma } from "@/lib/prisma";
import { getAnkiLinkIdFromNoteFields } from "@/lib/anki/ankiLink";
import { buildLatestHintSentenceAudioIndex } from "@/lib/words/hintSentenceVoice";

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  return t ? t : null;
}

function extractFirstSoundFilename(value: string): string | null {
  const m = /\[sound:(?<fn>[^\]]+)\]/i.exec(value);
  const fn = m?.groups?.fn?.trim();
  return fn ? fn : null;
}

function parseHintAudioTimestampFromFilename(wordId: number, filename: string): number | null {
  const re = new RegExp(`^${wordId}_hint_(?<ts>\\d{8,})\\.mp3$`, "i");
  const m = re.exec(filename);
  const ts = Number(m?.groups?.ts);
  return Number.isFinite(ts) ? Math.trunc(ts) : null;
}

function upsertSoundTag(current: string, newFilename: string, wordId: number): string {
  const tag = `[sound:${newFilename}]`;
  const cur = current ?? "";
  const existing = extractFirstSoundFilename(cur);

  if (!existing) {
    const base = cur.trim();
    return base ? `${base} ${tag}` : tag;
  }

  const existingTs = parseHintAudioTimestampFromFilename(wordId, existing);
  const newTs = parseHintAudioTimestampFromFilename(wordId, newFilename);

  // If existing isn't our format, keep it and append ours.
  if (existingTs == null || newTs == null) {
    const base = cur.trim();
    if (base.includes(tag)) return base;
    return base ? `${base} ${tag}` : tag;
  }

  // Replace the first sound tag if ours is newer.
  if (newTs > existingTs) {
    return cur.replace(/\[sound:[^\]]+\]/i, tag);
  }

  return cur;
}

function asHintSentenceString(value: unknown): string {
  return typeof value === "string" ? value : String(value ?? "");
}

async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>
): Promise<void> {
  const c = Math.max(1, Math.trunc(concurrency) || 1);
  let idx = 0;
  const runners = Array.from({ length: Math.min(c, items.length) }, async () => {
    for (;;) {
      const i = idx;
      idx += 1;
      if (i >= items.length) return;
      await worker(items[i]);
    }
  });
  await Promise.all(runners);
}

export type HintSentenceSyncAllStatus = {
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
  skipped: number;
  failed: number;
  currentNoteId: number | null;
};

type State = HintSentenceSyncAllStatus & { _started: boolean };

function nowIso() {
  return new Date().toISOString();
}

function getState(): State {
  const g = globalThis as unknown as { __hintSentenceSyncAll?: State };
  if (!g.__hintSentenceSyncAll) {
    g.__hintSentenceSyncAll = {
      jobId: `hint_sync_${Date.now()}`,
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
      skipped: 0,
      failed: 0,
      currentNoteId: null,
      _started: false,
    };
  }
  return g.__hintSentenceSyncAll;
}

export function getHintSentenceSyncAllStatus(): HintSentenceSyncAllStatus {
  const s = getState();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { _started: _ignored, ...pub } = s;
  return pub;
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
  state.skipped = 0;
  state.failed = 0;
  state.currentNoteId = null;

  const anki = createAnkiConnectClient({ timeoutMs: 30000, retryDelayMs: 1000 });
  const modelName = WordAnkiConstants.noteTypes.META_LEX_VR9;
  const query = `note:"${modelName.replaceAll('"', '\\"')}"`;

  const idsRes = await anki.requestDetailed("findNotes", { query });
  if (!idsRes.ok) throw new Error(idsRes.error);
  const ids = idsRes.result ?? [];
  state.total = ids.length;

  const noteById = new Map<number, { ankiLinkId: string | null; currentHint: string }>();
  const allAnkiLinkIds: string[] = [];
  for (const batch of chunk(ids, 250)) {
    const infoRes = await anki.requestDetailed("notesInfo", { notes: batch });
    if (!infoRes.ok) throw new Error(infoRes.error);
    for (const n of infoRes.result ?? []) {
      const ankiLinkId = getAnkiLinkIdFromNoteFields(n);
      const currentHint = asHintSentenceString(n.fields?.hint_sentence?.value ?? "");
      noteById.set(n.noteId, { ankiLinkId, currentHint });
      if (ankiLinkId) allAnkiLinkIds.push(ankiLinkId);
    }
  }

  const uniqueAnkiLinkIds = Array.from(new Set(allAnkiLinkIds));
  const wordByAnkiLinkId = new Map<string, { id: number; hint_sentence: string | null }>();
  for (const batch of chunk(uniqueAnkiLinkIds, 500)) {
    const rows = await prisma.word.findMany({
      where: { anki_link_id: { in: batch } },
      select: { id: true, anki_link_id: true, hint_sentence: true },
    });
    for (const w of rows) wordByAnkiLinkId.set(w.anki_link_id, { id: w.id, hint_sentence: w.hint_sentence });
  }

  const latestAudioByWordId = buildLatestHintSentenceAudioIndex();
  const uploaded = new Set<string>();
  const uploadInFlight = new Map<string, Promise<{ ok: true } | { ok: false; error: string }>>();

  const ensureUploaded = (filename: string) => {
    if (uploaded.has(filename)) return Promise.resolve({ ok: true } as const);
    const existing = uploadInFlight.get(filename);
    if (existing) return existing;

    const p = (async () => {
      const absPath = path.join(process.cwd(), "public", "audio", filename);
      let bytes: Buffer;
      try {
        bytes = fs.readFileSync(absPath);
      } catch (e) {
        return { ok: false as const, error: `Failed to read local audio: ${filename} (${e instanceof Error ? e.message : String(e)})` };
      }
      if (bytes.length === 0) return { ok: false as const, error: `Local audio is zero-byte: ${filename}` };

      const data = bytes.toString("base64");
      const mediaRes = await anki.requestDetailed("storeMediaFile", {
        filename,
        data,
        deleteExisting: true,
      });
      if (!mediaRes.ok) return { ok: false as const, error: mediaRes.error };
      uploaded.add(filename);
      return { ok: true as const };
    })().finally(() => {
      uploadInFlight.delete(filename);
    });

    uploadInFlight.set(filename, p);
    return p;
  };

  const concurrency = 8;
  await runWithConcurrency(ids, concurrency, async (noteId) => {
    if (state.stopRequested) return;
    state.currentNoteId = noteId;

    const note = noteById.get(noteId);
    if (!note) {
      state.failed += 1;
      state.processed += 1;
      return;
    }

    const ankiLinkId = note.ankiLinkId;
    if (!ankiLinkId) {
      state.failed += 1;
      state.processed += 1;
      return;
    }

    const word = wordByAnkiLinkId.get(ankiLinkId);
    if (!word) {
      state.failed += 1;
      state.processed += 1;
      return;
    }

    const current = note.currentHint;
    const dbHint = asNonEmptyString(word.hint_sentence) ?? "";
    const hasHint = Boolean(asNonEmptyString(current));
    let nextValue = current;

    if (!hasHint) nextValue = dbHint || "";

    const latest = latestAudioByWordId.get(word.id) ?? null;
    if (latest && latest.size > 0) {
      const maybeUpdated = upsertSoundTag(nextValue, latest.filename, word.id);
      if (maybeUpdated !== nextValue) {
        if (state.stopRequested) return;
        const upload = await ensureUploaded(latest.filename);
        if (!upload.ok) {
          state.failed += 1;
          state.processed += 1;
          return;
        }
        nextValue = maybeUpdated;
      }
    }

    if (nextValue !== current) {
      if (state.stopRequested) return;
      const updRes = await anki.requestDetailed("updateNoteFields", {
        note: { id: noteId, fields: { hint_sentence: nextValue } },
      });
      if (!updRes.ok) {
        state.failed += 1;
        state.processed += 1;
        return;
      }
      state.updated += 1;
    } else {
      state.skipped += 1;
    }

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

export function startHintSentenceSyncAllIfNeeded(): HintSentenceSyncAllStatus {
  const state = getState();
  if (state.running) return getHintSentenceSyncAllStatus();
  if (state._started && !state.done) return getHintSentenceSyncAllStatus();

  state.jobId = `hint_sync_${Date.now()}`;
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

  return getHintSentenceSyncAllStatus();
}

export function requestStopHintSentenceSyncAll(): HintSentenceSyncAllStatus {
  const state = getState();
  state.stopRequested = true;
  return getHintSentenceSyncAllStatus();
}
