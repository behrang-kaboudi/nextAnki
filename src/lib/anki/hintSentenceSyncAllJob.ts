import "server-only";

import { createAnkiConnectClient } from "@/lib/AnkiConnect";
import { WordAnkiConstants } from "@/lib/AnkiDeck/constants";
import { syncHintSentenceForAnkiNote } from "@/lib/anki/hintSentenceSync";

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

  // Preload current hint_sentence values to avoid an extra notesInfo call per note.
  const beforeByNoteId = new Map<number, string>();
  for (const batch of chunk(ids, 250)) {
    const infoRes = await anki.requestDetailed("notesInfo", { notes: batch });
    if (!infoRes.ok) throw new Error(infoRes.error);
    for (const n of infoRes.result ?? []) {
      beforeByNoteId.set(n.noteId, String(n.fields?.hint_sentence?.value ?? ""));
    }
  }

  const concurrency = 20;
  await runWithConcurrency(ids, concurrency, async (noteId) => {
    if (state.stopRequested) return;
    state.currentNoteId = noteId;

    const synced = await syncHintSentenceForAnkiNote(noteId);
    if (!synced.ok) {
      state.failed += 1;
      state.processed += 1;
      return;
    }

    const before = beforeByNoteId.get(noteId) ?? "";
    const after = String(synced.note.fields?.hint_sentence?.value ?? "");
    if (after !== before) state.updated += 1;
    else state.skipped += 1;

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
