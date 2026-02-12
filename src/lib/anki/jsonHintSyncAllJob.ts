import "server-only";

import { createAnkiConnectClient } from "@/lib/AnkiConnect";
import { WordAnkiConstants } from "@/lib/AnkiDeck";
import { WORD_ANKI_FIELD_GENERATORS, getAnkiLinkIdFromNoteFields } from "@/lib/anki/wordAnkiMapping";
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

    const same =
      jsonHint === (before?.jsonHint ?? "") &&
      firstLetterFaHint === (before?.firstLetterFaHint ?? "") &&
      firstLetterEnHint === (before?.firstLetterEnHint ?? "");

    if (same) {
      state.skippedSame += 1;
      state.processed += 1;
      return;
    }

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
