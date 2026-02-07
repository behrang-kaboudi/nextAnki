import "server-only";

import { createAnkiConnectClient } from "@/lib/AnkiConnect";
import { WordAnkiConstants } from "@/lib/AnkiDeck";
import { getAnkiLinkIdFromNoteFields } from "@/lib/anki/wordAnkiMapping";

export type AnkiLinkIdDedupStatus = {
  jobId: string;
  running: boolean;
  done: boolean;
  startedAt: string | null;
  finishedAt: string | null;
  error: string | null;

  stopRequested: boolean;
  stoppedEarly: boolean;

  total: number; // total notes to delete
  processed: number; // deleted attempts
  updated: number; // deleted ok
  skippedSame: number; // kept
  skippedNoLinkId: number;
  skippedNoWord: number;
  failed: number;
  mediaUploaded: number;
  mediaDeleted: number;
  currentNoteId: number | null;
};

type State = AnkiLinkIdDedupStatus & { _started: boolean };

function nowIso() {
  return new Date().toISOString();
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function getState(): State {
  const g = globalThis as unknown as { __ankiLinkIdDedup?: State };
  if (!g.__ankiLinkIdDedup) {
    g.__ankiLinkIdDedup = {
      jobId: `anki_link_id_dedup_${Date.now()}`,
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
  return g.__ankiLinkIdDedup;
}

export function getAnkiLinkIdDedupStatus(): AnkiLinkIdDedupStatus {
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
  state.skippedSame = 0;
  state.skippedNoLinkId = 0;
  state.skippedNoWord = 0;
  state.failed = 0;
  state.mediaUploaded = 0;
  state.mediaDeleted = 0;
  state.currentNoteId = null;

  const anki = createAnkiConnectClient({ timeoutMs: 30_000, retryDelayMs: 1000 });
  const modelName = WordAnkiConstants.noteTypes.META_LEX_VR9;
  const query = `note:"${modelName.replaceAll('"', '\\"')}"`;

  const found = await anki.requestDetailed("findNotes", { query });
  if (!found.ok) throw new Error(found.error);
  const noteIds = found.result ?? [];

  const byLinkId = new Map<string, number[]>();

  for (const batch of chunk(noteIds, 250)) {
    if (state.stopRequested) break;
    const info = await anki.requestDetailed("notesInfo", { notes: batch });
    if (!info.ok) throw new Error(info.error);

    for (const n of info.result ?? []) {
      const linkId = getAnkiLinkIdFromNoteFields(n);
      if (!linkId) {
        state.skippedNoLinkId += 1;
        continue;
      }
      const prev = byLinkId.get(linkId);
      if (prev) prev.push(n.noteId);
      else byLinkId.set(linkId, [n.noteId]);
    }
  }

  const toDelete: number[] = [];
  for (const [, ids] of byLinkId.entries()) {
    if (ids.length <= 1) continue;
    ids.sort((a, b) => a - b);
    state.skippedSame += 1; // kept oldest
    toDelete.push(...ids.slice(1));
  }

  state.total = toDelete.length;

  for (const batch of chunk(toDelete, 100)) {
    if (state.stopRequested) break;
    state.currentNoteId = batch[0] ?? null;

    const res = await anki.requestDetailed("deleteNotes", { notes: batch });
    if (!res.ok) {
      state.failed += batch.length;
      state.processed += batch.length;
      continue;
    }

    state.updated += batch.length;
    state.processed += batch.length;
  }

  if (state.stopRequested && state.processed < state.total) {
    state.stoppedEarly = true;
  }

  state.running = false;
  state.done = true;
  state.finishedAt = nowIso();
  state.currentNoteId = null;
}

export function startAnkiLinkIdDedupIfNeeded(): AnkiLinkIdDedupStatus {
  const state = getState();
  if (state.running) return getAnkiLinkIdDedupStatus();
  if (state._started && !state.done) return getAnkiLinkIdDedupStatus();

  state.jobId = `anki_link_id_dedup_${Date.now()}`;
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

  return getAnkiLinkIdDedupStatus();
}

export function requestStopAnkiLinkIdDedup(): AnkiLinkIdDedupStatus {
  const state = getState();
  state.stopRequested = true;
  return getAnkiLinkIdDedupStatus();
}

