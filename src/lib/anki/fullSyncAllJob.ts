import "server-only";

import { createAnkiConnectClient, type AnkiMultiAction } from "@/lib/anki";
import { AnkiNoteTypes, WordAnkiConstants } from "@/lib/anki";
import { ensureMetaLexVr9ModelFields } from "@/lib/anki/ensureMetaLexVr9ModelFields";
import { getAnkiStructureSettings } from "@/lib/anki/structureSettingsRepo";
import {
  generateWordAnkiFieldsForMetaLexVr9,
  assertSupportedWordAnkiFieldNames,
  getAnkiLinkIdFromNoteFields,
  getHydratedWordAnkiReadinessIssues,
  getWordAnkiManagedFieldNames,
} from "@/lib/anki/wordAnkiMapping";
import { REQUIRED_WORD_ANKI_FIELD_NAMES } from "@/lib/anki/wordAnkiSyncReadiness";
import {
  acquireWordSyncJobLock,
  getActiveWordSyncJob,
} from "@/lib/anki/wordSyncJobLock";
import { prisma } from "@/lib/prisma";
import { hydrateWordSensesWithPersianMeanings } from "@/lib/words/persianMeanings.server";
import { hydrateWordSensesWithEnglishFields } from "@/lib/english/wordSenseEnglishFields.server";
import { hydrateWordSensesWithEnglishSynonyms } from "@/lib/words/englishSynonyms.server";
import { hydrateWordsWithPrimarySentence } from "@/lib/words/primarySentences.server";
import { hydrateWordSensesWithActiveStory } from "@/lib/words/activeWordSenseStories.server";
import {
  consumeWordNoteInfoSnapshot,
  type WordNoteInfoSnapshotItem,
} from "@/lib/anki/wordNoteInfoSnapshot";

export type FullSyncAllStatus = {
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
  created: number;
  updated: number;
  skippedSame: number;
  skippedNoLinkId: number;
  skippedNoWord: number;
  skippedNotReady: number;
  readinessFailureSamples: Array<{
    wordSenseId: number;
    ankiLinkId: string;
    issues: Array<{ field: string; reason: "missing" | "invalid" }>;
  }>;
  failed: number;
  failureSamples: Array<{ noteId: number | null; error: string }>;
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

function normalizeFieldValueForCompare(value: string): string {
  return String(value ?? "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trim();
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
      stopRequested: false,
      stoppedEarly: false,
      total: 0,
      processed: 0,
      created: 0,
      updated: 0,
      skippedSame: 0,
      skippedNoLinkId: 0,
      skippedNoWord: 0,
      skippedNotReady: 0,
      readinessFailureSamples: [],
      failed: 0,
      failureSamples: [],
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

function addWordNoteAction(fields: Record<string, string>): AnkiMultiAction {
  const deckName = WordAnkiConstants.decks.tempRoot;
  const modelName = AnkiNoteTypes.META_LEX_VR9;
  return {
    action: "addNote",
    params: {
      note: {
        deckName,
        modelName,
        fields,
        options: {
          allowDuplicate: false,
          duplicateScope: "collection",
          duplicateScopeOptions: {
            deckName,
            checkChildren: true,
            checkAllModels: true,
          },
        },
      },
    },
  };
}

type PendingWrite = {
  kind: "create" | "update";
  noteId: number | null;
  action: AnkiMultiAction;
};

const MAX_MULTI_ACTIONS = 1000;
const MAX_MULTI_PAYLOAD_BYTES = 1_000_000;
const NOTES_INFO_BATCH_SIZE = 5000;
const DATABASE_PAGE_SIZE = 5000;

function chunkWrites(writes: PendingWrite[]): PendingWrite[][] {
  const batches: PendingWrite[][] = [];
  let batch: PendingWrite[] = [];
  let bytes = 0;
  for (const write of writes) {
    const writeBytes = Buffer.byteLength(JSON.stringify(write.action), "utf8");
    if (
      batch.length &&
      (batch.length >= MAX_MULTI_ACTIONS ||
        bytes + writeBytes > MAX_MULTI_PAYLOAD_BYTES)
    ) {
      batches.push(batch);
      batch = [];
      bytes = 0;
    }
    batch.push(write);
    bytes += writeBytes;
  }
  if (batch.length) batches.push(batch);
  return batches;
}

function nestedMultiError(result: unknown): string | null {
  if (!result || typeof result !== "object" || !("error" in result))
    return null;
  const error = (result as { error?: unknown }).error;
  return error == null ? null : String(error);
}

function recordWriteResult(
  state: State,
  write: PendingWrite,
  error: string | null,
) {
  if (error) {
    state.failed += 1;
    if (state.failureSamples.length < 20) {
      state.failureSamples.push({ noteId: write.noteId, error });
    }
  } else if (write.kind === "create") state.created += 1;
  else state.updated += 1;
  state.processed += 1;
}

function shouldSplitFailedBatch(error: string) {
  return /\b413\b|payload|request entity|body.*large|too large/i.test(error);
}

async function executeWriteBatch(
  state: State,
  writes: PendingWrite[],
  anki: ReturnType<typeof createAnkiConnectClient>,
): Promise<void> {
  if (!writes.length) return;
  state.currentNoteId =
    writes.find((write) => write.noteId !== null)?.noteId ?? null;
  const response = await anki.requestDetailed("multi", {
    actions: writes.map((write) => write.action),
  });
  if (!response.ok || !Array.isArray(response.result)) {
    const error = response.ok ? "Invalid multi response" : response.error;
    if (writes.length > 1 && shouldSplitFailedBatch(error)) {
      const middle = Math.ceil(writes.length / 2);
      await executeWriteBatch(state, writes.slice(0, middle), anki);
      await executeWriteBatch(state, writes.slice(middle), anki);
      return;
    }
    for (const write of writes) recordWriteResult(state, write, error);
    return;
  }

  for (let index = 0; index < writes.length; index += 1) {
    const result = response.result[index];
    const error =
      index >= response.result.length
        ? "Missing multi result"
        : nestedMultiError(result);
    recordWriteResult(state, writes[index]!, error);
  }
}

type ExistingAnkiNoteInfo = {
  noteId: number;
  fieldsByName: Partial<Record<string, string>>;
};

async function runJob(state: State, options?: { snapshotId?: string }) {
  const releaseLock = acquireWordSyncJobLock("full sync DB → Anki");
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
    state.created = 0;
    state.updated = 0;
    state.skippedSame = 0;
    state.skippedNoLinkId = 0;
    state.skippedNoWord = 0;
    state.skippedNotReady = 0;
    state.readinessFailureSamples = [];
    state.failed = 0;
    state.failureSamples = [];
    state.mediaUploaded = 0;
    state.mediaDeleted = 0;
    state.currentNoteId = null;

    state.total = await prisma.wordSense.count();

    const modelName = AnkiNoteTypes.META_LEX_VR9;
    const query = `note:"${modelName.replaceAll('"', '\\"')}"`;

    const ankiFinder = createAnkiConnectClient({
      timeoutMs: 30000,
      retryDelayMs: 1000,
    });

    // Ensure temp deck exists (no-op if already created).
    await ankiFinder.requestDetailed("createDeck", {
      deck: WordAnkiConstants.decks.tempRoot,
    });

    const structureSettings = await getAnkiStructureSettings();
    const configuredFields = structureSettings.config.noteType.fields;
    assertSupportedWordAnkiFieldNames(configuredFields);
    const missingRequiredConfiguredFields = REQUIRED_WORD_ANKI_FIELD_NAMES.filter(
      (field) => !configuredFields.includes(field),
    );
    if (missingRequiredConfiguredFields.length) {
      throw new Error(
        `Required Word sync field(s) are not configured on the Anki note type: ${missingRequiredConfiguredFields.join(", ")}`,
      );
    }
    // Validate before mutating the model, then make Anki match Structure Builder.
    await ensureMetaLexVr9ModelFields(ankiFinder);
    const managedFields = getWordAnkiManagedFieldNames(configuredFields).filter(
      (field) => field !== "selfGuide" && field !== "anki_link_id",
    );

    const reusableSnapshot = options?.snapshotId
      ? consumeWordNoteInfoSnapshot(options.snapshotId)
      : null;
    const snapshotNotes =
      reusableSnapshot?.query === query &&
      reusableSnapshot.notes.length === reusableSnapshot.totalNotes
        ? reusableSnapshot.notes
        : null;

    const noteByAnkiLinkId = new Map<string, ExistingAnkiNoteInfo>();
    const collectNoteInfo = (notes: WordNoteInfoSnapshotItem[]) => {
      for (const n of notes) {
        const ankiLinkId = getAnkiLinkIdFromNoteFields(n);
        if (!ankiLinkId) continue;
        if (noteByAnkiLinkId.has(ankiLinkId)) continue;

        const fieldsByName: Partial<Record<string, string>> = {};
        for (const f of managedFields) {
          fieldsByName[f] = normalizeFieldValueForCompare(
            String(n.fields?.[f]?.value ?? ""),
          );
        }
        noteByAnkiLinkId.set(ankiLinkId, { noteId: n.noteId, fieldsByName });
      }
    };

    if (snapshotNotes) {
      collectNoteInfo(snapshotNotes);
    } else {
      const idsRes = await ankiFinder.requestDetailed("findNotes", { query });
      if (!idsRes.ok) throw new Error(idsRes.error);
      const noteIds = idsRes.result ?? [];
      for (const batch of chunk(noteIds, NOTES_INFO_BATCH_SIZE)) {
        const infoRes = await ankiFinder.requestDetailed("notesInfo", {
          notes: batch,
        });
        if (!infoRes.ok) throw new Error(infoRes.error);
        collectNoteInfo(infoRes.result ?? []);
      }
    }

    let lastId = 0;
    for (;;) {
      if (state.stopRequested) break;

      const rows = await prisma.wordSense.findMany({
        where: { id: { gt: lastId } },
        orderBy: { id: "asc" },
        take: DATABASE_PAGE_SIZE,
      });
      if (!rows.length) break;
      lastId = rows[rows.length - 1]!.id;

      const hydratedRows = await hydrateWordSensesWithActiveStory(
        await hydrateWordsWithPrimarySentence(
          await hydrateWordSensesWithEnglishSynonyms(
            await hydrateWordSensesWithPersianMeanings(
              await hydrateWordSensesWithEnglishFields(rows),
            ),
          ),
        ),
      );
      const generatedRows = await Promise.all(
        hydratedRows.map(async (word) => ({
          word,
          fields: await generateWordAnkiFieldsForMetaLexVr9(
            word,
            configuredFields,
          ),
        })),
      );
      const pendingWrites: PendingWrite[] = [];
      for (const { word, fields } of generatedRows) {
        if (state.stopRequested) break;

        const readinessIssues = getHydratedWordAnkiReadinessIssues(word, fields);
        if (readinessIssues.length) {
          state.skippedNotReady += 1;
          state.processed += 1;
          if (state.readinessFailureSamples.length < 20) {
            state.readinessFailureSamples.push({
              wordSenseId: word.id,
              ankiLinkId: word.anki_link_id,
              issues: readinessIssues,
            });
          }
          continue;
        }

        const existing = noteByAnkiLinkId.get(word.anki_link_id) ?? null;
        state.currentNoteId = existing?.noteId ?? null;

        if (!existing) {
          pendingWrites.push({
            kind: "create",
            noteId: null,
            action: addWordNoteAction(fields),
          });
          continue;
        }

        const before = existing.fieldsByName;
        const changedFields: Record<string, string> = {};
        for (const f of managedFields) {
          const prev = normalizeFieldValueForCompare(String(before[f] ?? ""));
          const next = normalizeFieldValueForCompare(String(fields[f] ?? ""));
          if (prev !== next) changedFields[f] = fields[f] ?? "";
        }

        if (!Object.keys(changedFields).length) {
          state.skippedSame += 1;
          state.processed += 1;
          continue;
        }

        pendingWrites.push({
          kind: "update",
          noteId: existing.noteId,
          action: {
            action: "updateNoteFields",
            params: { note: { id: existing.noteId, fields: changedFields } },
          },
        });
      }

      for (const batch of chunkWrites(pendingWrites)) {
        if (state.stopRequested) break;
        await executeWriteBatch(state, batch, ankiFinder);
      }
    }

    if (state.stopRequested && state.processed < state.total) {
      state.stoppedEarly = true;
    }

    state.running = false;
    state.done = true;
    state.finishedAt = nowIso();
    state.currentNoteId = null;
  } finally {
    releaseLock();
  }
}

export function startFullSyncAllIfNeeded(options?: {
  snapshotId?: string;
}): FullSyncAllStatus {
  const state = getState();
  if (state.running) return getFullSyncAllStatus();
  if (state._started && !state.done) return getFullSyncAllStatus();
  const active = getActiveWordSyncJob();
  if (active) {
    state.running = false;
    state.done = true;
    state.error = `Anki word sync job "${active.name}" is already running (started ${active.startedAt}).`;
    return getFullSyncAllStatus();
  }

  state.jobId = `full_sync_${Date.now()}`;
  state._started = true;
  state.stopRequested = false;
  state.stoppedEarly = false;

  void runJob(state, options).catch((e) => {
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
