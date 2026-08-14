import "server-only";

import type { WordSense } from "@prisma/client";

import { createAnkiConnectClient, type AnkiMultiAction } from "@/lib/anki";
import { AnkiNoteTypes } from "@/lib/anki";
import {
  generateWordAnkiFieldsForMetaLexVr9,
  getAnkiLinkIdFromNoteFields,
  type WordAnkiManagedFieldName,
} from "@/lib/anki/wordAnkiMapping";
import {
  acquireWordSyncJobLock,
  getActiveWordSyncJob,
} from "@/lib/anki/wordSyncJobLock";
import { getAnkiStructureSettings } from "@/lib/anki/structureSettingsRepo";
import { hydrateWordSensesWithEnglishFields } from "@/lib/english/wordSenseEnglishFields.server";
import { prisma } from "@/lib/prisma";
import { hydrateWordSensesWithEnglishSynonyms } from "@/lib/words/englishSynonyms.server";
import { hydrateWordSensesWithPersianMeanings } from "@/lib/words/persianMeanings.server";
import { hydrateWordsWithPrimarySentence } from "@/lib/words/primarySentences.server";

export type WordFieldsSyncFailure = {
  noteId: number | null;
  error: string;
};

export type WordFieldsSyncAllStatus = {
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
  failureSamples: WordFieldsSyncFailure[];
  mediaUploaded: number;
  mediaDeleted: number;
  currentNoteId: number | null;
};

type State = WordFieldsSyncAllStatus & { _started: boolean };

type JobOptions = {
  stateKey: string;
  jobIdPrefix: string;
  jobName: string;
  fields: readonly WordAnkiManagedFieldName[];
};

const MAX_FAILURE_SAMPLES = 20;
const MAX_MULTI_ACTIONS = 50;
const MAX_MULTI_PAYLOAD_BYTES = 1_000_000;

function nowIso() {
  return new Date().toISOString();
}

function chunk<T>(items: readonly T[], size: number): T[][] {
  const groups: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    groups.push(items.slice(index, index + size));
  }
  return groups;
}

function chunkWrites(
  writes: Array<{ noteId: number; action: AnkiMultiAction }>,
): Array<Array<{ noteId: number; action: AnkiMultiAction }>> {
  const groups: Array<Array<{ noteId: number; action: AnkiMultiAction }>> = [];
  let group: Array<{ noteId: number; action: AnkiMultiAction }> = [];
  let bytes = 0;
  for (const write of writes) {
    const writeBytes = Buffer.byteLength(JSON.stringify(write.action), "utf8");
    if (
      group.length &&
      (group.length >= MAX_MULTI_ACTIONS ||
        bytes + writeBytes > MAX_MULTI_PAYLOAD_BYTES)
    ) {
      groups.push(group);
      group = [];
      bytes = 0;
    }
    group.push(write);
    bytes += writeBytes;
  }
  if (group.length) groups.push(group);
  return groups;
}

function normalizeForCompare(value: string): string {
  return String(value ?? "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trim();
}

function nestedMultiError(result: unknown): string | null {
  if (!result || typeof result !== "object" || !("error" in result))
    return null;
  const error = (result as { error?: unknown }).error;
  return error == null ? null : String(error);
}

function recordFailure(state: State, noteId: number | null, error: string) {
  state.failed += 1;
  if (state.failureSamples.length < MAX_FAILURE_SAMPLES) {
    state.failureSamples.push({ noteId, error });
  }
}

async function hydrateWords(words: WordSense[]) {
  return hydrateWordsWithPrimarySentence(
    await hydrateWordSensesWithEnglishSynonyms(
      await hydrateWordSensesWithPersianMeanings(
        await hydrateWordSensesWithEnglishFields(words),
      ),
    ),
  );
}

async function runJob(state: State, options: JobOptions) {
  const releaseLock = acquireWordSyncJobLock(options.jobName);
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
      timeoutMs: 30_000,
      retryDelayMs: 1000,
    });
    const structureSettings = await getAnkiStructureSettings();
    const missingFields = options.fields.filter(
      (field) => !structureSettings.config.noteType.fields.includes(field),
    );
    if (missingFields.length) {
      throw new Error(
        `Specialized sync field(s) are not configured on the Anki note type: ${missingFields.join(", ")}`,
      );
    }
    const modelName = AnkiNoteTypes.META_LEX_VR9;
    const found = await anki.requestDetailed("findNotes", {
      query: `note:"${modelName.replaceAll('"', '\\"')}"`,
    });
    if (!found.ok) throw new Error(found.error);
    const noteIds = found.result ?? [];
    state.total = noteIds.length;

    const beforeByNoteId = new Map<
      number,
      { ankiLinkId: string | null; fields: Record<string, string> }
    >();
    for (const group of chunk(noteIds, 1000)) {
      if (state.stopRequested) break;
      const info = await anki.requestDetailed("notesInfo", { notes: group });
      if (!info.ok) throw new Error(info.error);
      for (const note of info.result ?? []) {
        beforeByNoteId.set(note.noteId, {
          ankiLinkId: getAnkiLinkIdFromNoteFields(note),
          fields: Object.fromEntries(
            options.fields.map((field) => [
              field,
              String(note.fields?.[field]?.value ?? ""),
            ]),
          ),
        });
      }
    }

    const ankiLinkIds = [
      ...new Set(
        [...beforeByNoteId.values()]
          .map((value) => value.ankiLinkId)
          .filter((value): value is string => Boolean(value)),
      ),
    ];
    const wordByAnkiLinkId = new Map<
      string,
      Awaited<ReturnType<typeof hydrateWords>>[number]
    >();
    for (const group of chunk(ankiLinkIds, 500)) {
      if (state.stopRequested) break;
      const words = await hydrateWords(
        await prisma.wordSense.findMany({ where: { anki_link_id: { in: group } } }),
      );
      for (const word of words) wordByAnkiLinkId.set(word.anki_link_id, word);
    }

    const writes: Array<{ noteId: number; action: AnkiMultiAction }> = [];
    for (const noteId of noteIds) {
      if (state.stopRequested) break;
      state.currentNoteId = noteId;
      const before = beforeByNoteId.get(noteId);
      const ankiLinkId = before?.ankiLinkId ?? null;
      if (!ankiLinkId) {
        state.skippedNoLinkId += 1;
        state.processed += 1;
        continue;
      }

      const word = wordByAnkiLinkId.get(ankiLinkId);
      if (!word) {
        state.skippedNoWord += 1;
        state.processed += 1;
        continue;
      }

      const generated = await generateWordAnkiFieldsForMetaLexVr9(
        word,
        options.fields,
      );
      const changedFields = Object.fromEntries(
        options.fields
          .filter(
            (field) =>
              normalizeForCompare(before?.fields[field] ?? "") !==
              normalizeForCompare(generated[field] ?? ""),
          )
          .map((field) => [field, generated[field] ?? ""]),
      );
      if (!Object.keys(changedFields).length) {
        state.skippedSame += 1;
        state.processed += 1;
        continue;
      }

      writes.push({
        noteId,
        action: {
          action: "updateNoteFields",
          params: { note: { id: noteId, fields: changedFields } },
        },
      });
    }

    for (const group of chunkWrites(writes)) {
      if (state.stopRequested) break;
      state.currentNoteId = group[0]?.noteId ?? null;
      const response = await anki.requestDetailed("multi", {
        actions: group.map((write) => write.action),
      });
      if (!response.ok || !Array.isArray(response.result)) {
        const error = response.ok ? "Invalid multi response" : response.error;
        for (const write of group) {
          recordFailure(state, write.noteId, error);
          state.processed += 1;
        }
        continue;
      }

      for (let index = 0; index < group.length; index += 1) {
        const write = group[index]!;
        const error =
          index >= response.result.length
            ? "Missing multi result"
            : nestedMultiError(response.result[index]);
        if (error) recordFailure(state, write.noteId, error);
        else state.updated += 1;
        state.processed += 1;
      }
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

export function createWordFieldsSyncAllJob(options: JobOptions) {
  function getState(): State {
    const globalState = globalThis as unknown as Record<
      string,
      State | undefined
    >;
    if (!globalState[options.stateKey]) {
      globalState[options.stateKey] = {
        jobId: `${options.jobIdPrefix}_${Date.now()}`,
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
        _started: false,
      };
    }
    return globalState[options.stateKey]!;
  }

  function getStatus(): WordFieldsSyncAllStatus {
    const { _started: _ignored, ...status } = getState();
    void _ignored;
    return status;
  }

  function start(): WordFieldsSyncAllStatus {
    const state = getState();
    if (state.running || (state._started && !state.done)) return getStatus();
    const active = getActiveWordSyncJob();
    if (active) {
      state.running = false;
      state.done = true;
      state.error = `Anki word sync job "${active.name}" is already running (started ${active.startedAt}).`;
      return getStatus();
    }
    state.jobId = `${options.jobIdPrefix}_${Date.now()}`;
    state._started = true;
    state.stopRequested = false;
    state.stoppedEarly = false;

    void runJob(state, options).catch((error) => {
      state.running = false;
      state.done = true;
      state.error = error instanceof Error ? error.message : String(error);
      state.finishedAt = nowIso();
      state.currentNoteId = null;
    });
    return getStatus();
  }

  function stop(): WordFieldsSyncAllStatus {
    getState().stopRequested = true;
    return getStatus();
  }

  return { getStatus, start, stop };
}
