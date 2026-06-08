import "server-only";

import { createAnkiConnectClient } from "@/lib/AnkiConnect";
import { AnkiNoteTypes, WordAnkiConstants, type WordNoteFieldName } from "@/lib/AnkiDeck";
import { ensureMetaLexVr9ModelFields } from "@/lib/anki/ensureMetaLexVr9ModelFields";
import { generateWordAnkiFieldsForMetaLexVr9, getAnkiLinkIdFromNoteFields } from "@/lib/anki/wordAnkiMapping";
import { prisma } from "@/lib/prisma";

export type FullSyncAllStatus = {
  jobId: string;
  running: boolean;
  done: boolean;
  startedAt: string | null;
  finishedAt: string | null;
  error: string | null;
  ignoreUpdatedAt: boolean;

  stopRequested: boolean;
  stoppedEarly: boolean;

  total: number;
  processed: number;
  created: number;
  updated: number;
  skippedSame: number;
  skippedNoLinkId: number;
  skippedNoWord: number;
  failed: number;
  mediaUploaded: number;
  mediaDeleted: number;
  currentNoteId: number | null;
};

type State = FullSyncAllStatus & { _started: boolean };

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

function normalizeFieldValueForCompare(value: string): string {
  return String(value ?? "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trim();
}

function wordUpdatedAtForAnkiField(updatedAt: Date): string {
  return updatedAt.toISOString();
}

function getState(): State {
  const g = globalThis as unknown as { __fullSyncAll?: State };
  if (!g.__fullSyncAll) {
    g.__fullSyncAll = {
      jobId: `full_sync_${Date.now()}`,
      running: false,
      done: true,
      startedAt: null,
      finishedAt: null,
      error: null,
      ignoreUpdatedAt: false,
      stopRequested: false,
      stoppedEarly: false,
      total: 0,
      processed: 0,
      created: 0,
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
  return g.__fullSyncAll;
}

export function getFullSyncAllStatus(): FullSyncAllStatus {
  const s = getState();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { _started: _ignored, ...pub } = s;
  return pub;
}

async function updateNoteFields(
  noteId: number,
  fields: Partial<Record<WordNoteFieldName, string>>,
  anki: ReturnType<typeof createAnkiConnectClient>,
) {
  const res = await anki.requestDetailed("updateNoteFields", { note: { id: noteId, fields } });
  if (!res.ok) return { ok: false as const, error: res.error };
  return { ok: true as const };
}

async function addWordNote(
  fields: Record<WordNoteFieldName, string>,
  anki: ReturnType<typeof createAnkiConnectClient>,
) {
  const deckName = WordAnkiConstants.decks.tempRoot;
  const modelName = AnkiNoteTypes.META_LEX_VR9;

  const res = await anki.requestDetailed("addNote", {
    note: {
      deckName,
      modelName,
      fields,
      options: {
        allowDuplicate: false,
        duplicateScope: "collection",
        duplicateScopeOptions: { deckName, checkChildren: true, checkAllModels: true },
      },
    },
  });
  if (!res.ok) return { ok: false as const, error: res.error };
  return { ok: true as const, noteId: res.result ?? null };
}

type ExistingAnkiNoteInfo = {
  noteId: number;
  fieldsByName: Partial<Record<WordNoteFieldName, string>>;
};

async function runJob(state: State) {
  state.running = true;
  state.done = false;
  state.error = null;
  state.ignoreUpdatedAt = Boolean(state.ignoreUpdatedAt);
  state.stopRequested = false;
  state.stoppedEarly = false;
  state.startedAt = nowIso();
  state.finishedAt = null;
  state.total = 0;
  state.processed = 0;
  state.created = 0;
  state.updated = 0;
  state.skippedSame = 0;
  state.skippedNoLinkId = 0;
  state.skippedNoWord = 0;
  state.failed = 0;
  state.mediaUploaded = 0;
  state.mediaDeleted = 0;
  state.currentNoteId = null;

  state.total = await prisma.word.count();

  const modelName = AnkiNoteTypes.META_LEX_VR9;
  const query = `note:"${modelName.replaceAll('"', '\\"')}"`;

  const ankiFinder = createAnkiConnectClient({ timeoutMs: 30000, retryDelayMs: 1000 });

  // Ensure temp deck exists (no-op if already created).
  await ankiFinder.requestDetailed("createDeck", { deck: WordAnkiConstants.decks.tempRoot });

  // Ensure the note type exists and has the expected fields (including `updatedAt`).
  await ensureMetaLexVr9ModelFields(ankiFinder);

  const idsRes = await ankiFinder.requestDetailed("findNotes", { query });
  if (!idsRes.ok) throw new Error(idsRes.error);
  const noteIds = idsRes.result ?? [];

  const noteByAnkiLinkId = new Map<string, ExistingAnkiNoteInfo>();
  const wantedFields = WordAnkiConstants.noteFields.META_LEX_VR9;
  const managedFields = wantedFields.filter(
    (f) => f !== "selfGuide",
  ) as WordNoteFieldName[];

  for (const batch of chunk(noteIds, 250)) {
    const infoRes = await ankiFinder.requestDetailed("notesInfo", { notes: batch });
    if (!infoRes.ok) throw new Error(infoRes.error);
    for (const n of infoRes.result ?? []) {
      const ankiLinkId = getAnkiLinkIdFromNoteFields(n);
      if (!ankiLinkId) continue;
      if (noteByAnkiLinkId.has(ankiLinkId)) continue;

      const fieldsByName: Partial<Record<WordNoteFieldName, string>> = {};
      for (const f of managedFields) {
        fieldsByName[f] = normalizeFieldValueForCompare(String(n.fields?.[f]?.value ?? ""));
      }
      noteByAnkiLinkId.set(ankiLinkId, { noteId: n.noteId, fieldsByName });
    }
  }

  const concurrency = 12;
  const clients = Array.from({ length: concurrency }, () =>
    createAnkiConnectClient({ timeoutMs: 30000, retryDelayMs: 1000 }),
  );

  let lastId = 0;
  const pageSize = 250;
  for (;;) {
    if (state.stopRequested) break;

    const rows = await prisma.word.findMany({
      where: { id: { gt: lastId } },
      orderBy: { id: "asc" },
      take: pageSize,
    });
    if (!rows.length) break;
    lastId = rows[rows.length - 1]!.id;

    await runWithConcurrency(rows, concurrency, async (word) => {
      if (state.stopRequested) return;

      const existing = noteByAnkiLinkId.get(word.anki_link_id) ?? null;
      state.currentNoteId = existing?.noteId ?? null;

      // Fast path: If our `updatedAt` field matches, treat the note as up-to-date and skip.
      // This avoids generating and comparing every field on every run.
      if (existing && !state.ignoreUpdatedAt) {
        const prevUpdatedAt = normalizeFieldValueForCompare(String(existing.fieldsByName.updatedAt ?? ""));
        const nextUpdatedAt = normalizeFieldValueForCompare(wordUpdatedAtForAnkiField(word.updatedAt));
        if (prevUpdatedAt && prevUpdatedAt === nextUpdatedAt) {
          state.skippedSame += 1;
          state.processed += 1;
          return;
        }
      }

      const fields = await generateWordAnkiFieldsForMetaLexVr9(word);

      if (!existing) {
        const client = clients[Math.abs(word.id) % clients.length]!;
        const added = await addWordNote(fields, client);
        if (!added.ok) state.failed += 1;
        else state.created += 1;
        state.processed += 1;
        return;
      }

      const before = existing.fieldsByName;
      let same = true;
      for (const f of managedFields) {
        const prev = normalizeFieldValueForCompare(String(before[f] ?? ""));
        const next = normalizeFieldValueForCompare(String(fields[f] ?? ""));
        if (prev !== next) {
          same = false;
          break;
        }
      }

      if (same) {
        state.skippedSame += 1;
        state.processed += 1;
        return;
      }

      const client = clients[Math.abs(existing.noteId) % clients.length]!;
      const managedUpdateFields = Object.fromEntries(
        managedFields.map((f) => [f, fields[f]] as const),
      ) as Partial<Record<WordNoteFieldName, string>>;
      const updated = await updateNoteFields(existing.noteId, managedUpdateFields, client);
      if (!updated.ok) state.failed += 1;
      else state.updated += 1;

      state.processed += 1;
    });
  }

  if (state.stopRequested && state.processed < state.total) {
    state.stoppedEarly = true;
  }

  state.running = false;
  state.done = true;
  state.finishedAt = nowIso();
  state.currentNoteId = null;
}

export function startFullSyncAllIfNeeded(opts?: { ignoreUpdatedAt?: boolean }): FullSyncAllStatus {
  const state = getState();
  if (state.running) return getFullSyncAllStatus();
  if (state._started && !state.done) return getFullSyncAllStatus();

  state.jobId = `full_sync_${Date.now()}`;
  state._started = true;
  state.ignoreUpdatedAt = Boolean(opts?.ignoreUpdatedAt);
  state.stopRequested = false;
  state.stoppedEarly = false;

  void runJob(state).catch((e) => {
    state.running = false;
    state.done = true;
    state.error = e instanceof Error ? e.message : String(e);
    state.finishedAt = nowIso();
    state.currentNoteId = null;
  });

  return getFullSyncAllStatus();
}

export function requestStopFullSyncAll(): FullSyncAllStatus {
  const state = getState();
  state.stopRequested = true;
  return getFullSyncAllStatus();
}
