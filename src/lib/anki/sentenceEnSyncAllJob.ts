import "server-only";

import fs from "node:fs";

import { createAnkiConnectClient } from "@/lib/AnkiConnect";
import { WordAnkiConstants } from "@/lib/AnkiDeck";
import { sanitizeWordAudioFilenamePart, WORD_AUDIO_FILENAME_SEPARATOR } from "@/lib/audio/wordFieldAudioNaming";
import { getWordFieldAudioAbsoluteDir, getWordFieldAudioAbsolutePath } from "@/lib/audio/wordFieldAudioPaths.server";
import { getAnkiLinkIdFromNoteFields } from "@/lib/anki/wordAnkiMapping";
import { prisma } from "@/lib/prisma";

export type SentenceEnSyncAllStatus = {
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

type State = SentenceEnSyncAllStatus & { _started: boolean };

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

function getState(): State {
  const g = globalThis as unknown as { __sentenceEnSyncAll?: State };
  if (!g.__sentenceEnSyncAll) {
    g.__sentenceEnSyncAll = {
      jobId: `sentence_en_sync_${Date.now()}`,
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
  return g.__sentenceEnSyncAll;
}

export function getSentenceEnSyncAllStatus(): SentenceEnSyncAllStatus {
  const s = getState();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { _started: _ignored, ...pub } = s;
  return pub;
}

type ExistingFileInfo = { filename: string; timestampMs: number; size: number };

function indexLatestAudioForSentenceEn(): Map<string, ExistingFileInfo> {
  const dir = getWordFieldAudioAbsoluteDir();
  let entries: string[] = [];
  try {
    entries = fs.readdirSync(dir);
  } catch {
    return new Map();
  }

  const sep = WORD_AUDIO_FILENAME_SEPARATOR.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const reNew = new RegExp(`^(?<anki>.+?)${sep}sentence_en${sep}(?<ts>\\d{8,})\\.mp3$`);
  const reLegacy = new RegExp(`^(?<anki>.+)_sentence_en_(?<ts>\\d{8,})\\.mp3$`);

  const latestById = new Map<string, ExistingFileInfo>();
  for (const filename of entries) {
    const m = reNew.exec(filename) ?? reLegacy.exec(filename);
    const anki = m?.groups?.anki;
    const ts = Number(m?.groups?.ts);
    if (!anki || !Number.isFinite(ts)) continue;

    let size = 0;
    try {
      size = fs.statSync(getWordFieldAudioAbsolutePath(filename)).size;
    } catch {
      continue;
    }

    const prev = latestById.get(anki);
    if (!prev || Math.trunc(ts) > prev.timestampMs) {
      latestById.set(anki, { filename, timestampMs: Math.trunc(ts), size });
    }
  }

  return latestById;
}

function generateSentenceEnValue(dbSentenceEn: string, audioKey: string, audioIndex: Map<string, ExistingFileInfo>): string {
  const text = String(dbSentenceEn ?? "");
  const key = sanitizeWordAudioFilenamePart(audioKey);
  const audio = audioIndex.get(key);
  if (!audio || audio.size <= 0) return text;
  const tag = `[sound:${audio.filename}]`;
  if (text.includes(tag)) return text;
  const base = text.trim();
  return base ? `${base} ${tag}` : tag;
}

async function updateNoteSentenceEn(noteId: number, value: string, anki: ReturnType<typeof createAnkiConnectClient>) {
  const res = await anki.requestDetailed("updateNoteFields", { note: { id: noteId, fields: { sentence_en: value } } });
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

  const audioIndex = indexLatestAudioForSentenceEn();

  // Preload current sentence_en + anki_link_id to avoid extra notesInfo per note.
  const beforeByNoteId = new Map<number, { ankiLinkId: string | null; sentenceEn: string }>();
  for (const batch of chunk(ids, 250)) {
    const infoRes = await ankiFinder.requestDetailed("notesInfo", { notes: batch });
    if (!infoRes.ok) throw new Error(infoRes.error);
    for (const n of infoRes.result ?? []) {
      const ankiLinkId = getAnkiLinkIdFromNoteFields(n);
      const sentenceEn = String(n.fields?.sentence_en?.value ?? "");
      beforeByNoteId.set(n.noteId, { ankiLinkId, sentenceEn });
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

  const dbSentenceByAnkiLinkId = new Map<string, { sentenceEn: string; audioKey: string }>();
  for (const group of chunk(allIds, 1000)) {
    const rows = await prisma.sentence.findMany({
      where: { anki_link_id: { in: group } },
      select: { id: true, anki_link_id: true, sentence_en: true },
    });
    for (const r of rows) {
      if (!r.anki_link_id) continue;
      dbSentenceByAnkiLinkId.set(r.anki_link_id, { sentenceEn: r.sentence_en, audioKey: String(r.id) });
    }
  }

  const concurrency = 20;
  const clients = Array.from({ length: concurrency }, () =>
    createAnkiConnectClient({ timeoutMs: 30000, retryDelayMs: 1000 }),
  );

  await runWithConcurrency(
    ids,
    concurrency,
    async (noteId) => {
      if (state.stopRequested) return;
      state.currentNoteId = noteId;

      const before = beforeByNoteId.get(noteId);
      const ankiLinkId = before?.ankiLinkId ?? null;
      const oldValue = before?.sentenceEn ?? "";

      if (!ankiLinkId) {
        state.skippedNoLinkId += 1;
        state.processed += 1;
        return;
      }

      const dbSentence = dbSentenceByAnkiLinkId.get(ankiLinkId);
      if (!dbSentence) {
        state.skippedNoWord += 1;
        state.processed += 1;
        return;
      }

      const newValue = generateSentenceEnValue(dbSentence.sentenceEn, dbSentence.audioKey, audioIndex);
      if (newValue === oldValue) {
        state.skippedSame += 1;
        state.processed += 1;
        return;
      }

      const client = clients[noteId % clients.length]!;

      const upd = await updateNoteSentenceEn(noteId, newValue, client);
      if (!upd.ok) {
        state.failed += 1;
        state.processed += 1;
        return;
      }

      state.updated += 1;
      state.processed += 1;
    },
  );

  if (state.stopRequested && state.processed < state.total) {
    state.stoppedEarly = true;
  }

  state.running = false;
  state.done = true;
  state.finishedAt = nowIso();
  state.currentNoteId = null;
}

export function startSentenceEnSyncAllIfNeeded(): SentenceEnSyncAllStatus {
  const state = getState();
  if (state.running) return getSentenceEnSyncAllStatus();
  if (state._started && !state.done) return getSentenceEnSyncAllStatus();

  state.jobId = `sentence_en_sync_${Date.now()}`;
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

  return getSentenceEnSyncAllStatus();
}

export function requestStopSentenceEnSyncAll(): SentenceEnSyncAllStatus {
  const state = getState();
  state.stopRequested = true;
  return getSentenceEnSyncAllStatus();
}
