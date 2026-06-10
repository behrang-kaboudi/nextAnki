import "server-only";

import fs from "node:fs";

import { prisma } from "@/lib/prisma";
import { createAnkiConnectClient } from "@/lib/AnkiConnect";
import { AnkiNoteTypes, SentenceAnkiConstants } from "@/lib/AnkiDeck";
import { chunkArray } from "@/lib/AnkiDeck/workflowHelpers";
import { quoteAnkiSearchValue } from "@/lib/AnkiDeck/queries";
import {
  sanitizeWordAudioFilenamePart,
  WORD_AUDIO_FILENAME_SEPARATOR,
} from "@/lib/audio/wordFieldAudioNaming";
import {
  getWordFieldAudioAbsoluteDir,
  getWordFieldAudioAbsolutePath,
} from "@/lib/audio/wordFieldAudioPaths.server";

const SENTENCE_DECK_NAME = SentenceAnkiConstants.decks.EnSentences;
const SENTENCE_MODEL_NAME = AnkiNoteTypes.EN_SENTENCES;

type SentenceCandidate = {
  id: number;
  sentence_en: string;
  sentence_en_meaning_fa: string | null;
  updatedAt: Date;
};

type ExistingFileInfo = { filename: string; timestampMs: number; size: number };

export type SentenceDeckSyncAllStatus = {
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
  targetAddCount: number;
  eligible: number;
  added: number;
  skippedAlreadyInDeck: number;
  failed: number;
  currentSentenceId: number | null;
  logs: string[];
};

export type SelectedSentenceDeckSyncResult =
  | {
      ok: true;
      requested: number;
      matched: number;
      notFound: number;
      eligible: number;
      added: number;
      skippedAlreadyInDeck: number;
      failed: number;
      logs: string[];
      addedItems: Array<{
        sentenceId: number;
        sentence_en: string;
        noteId: number;
      }>;
      notFoundItems: string[];
    }
  | {
      ok: false;
      error: string;
      logs: string[];
    };

type State = SentenceDeckSyncAllStatus & { _started: boolean };

function nowIso() {
  return new Date().toISOString();
}

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function indexLatestAudioByField(
  field: "sentence_en" | "sentence_en_meaning_fa",
): Map<string, ExistingFileInfo> {
  const dir = getWordFieldAudioAbsoluteDir();
  let entries: string[] = [];
  try {
    entries = fs.readdirSync(dir);
  } catch {
    return new Map();
  }

  const sep = escapeRegExp(WORD_AUDIO_FILENAME_SEPARATOR);
  const reNew = new RegExp(
    `^(?<id>.+?)${sep}${field}${sep}(?<ts>\\d{8,})\\.mp3$`,
  );
  const reLegacy = new RegExp(`^(?<id>.+)_${field}_(?<ts>\\d{8,})\\.mp3$`);

  const latestById = new Map<string, ExistingFileInfo>();
  for (const filename of entries) {
    const m = reNew.exec(filename) ?? reLegacy.exec(filename);
    const id = m?.groups?.id;
    const ts = Number(m?.groups?.ts);
    if (!id || !Number.isFinite(ts)) continue;

    const normalized = sanitizeWordAudioFilenamePart(id);

    let size = 0;
    try {
      size = fs.statSync(getWordFieldAudioAbsolutePath(filename)).size;
    } catch {
      continue;
    }

    const prev = latestById.get(normalized);
    if (!prev || Math.trunc(ts) > prev.timestampMs) {
      latestById.set(normalized, {
        filename,
        timestampMs: Math.trunc(ts),
        size,
      });
    }
  }

  return latestById;
}

function toSoundTag(info: ExistingFileInfo | undefined): string {
  if (!info || info.size <= 0) return "";
  return `[sound:${info.filename}]`;
}

async function loadExistingSentenceSet(
  anki: ReturnType<typeof createAnkiConnectClient>,
) {
  const query = `deck:${quoteAnkiSearchValue(SENTENCE_DECK_NAME)} note:${quoteAnkiSearchValue(SENTENCE_MODEL_NAME)}`;
  const noteIdsRes = await anki.requestDetailed("findNotes", { query });
  if (!noteIdsRes.ok) {
    throw new Error(
      `AnkiConnect findNotes failed while loading existing sentence notes: ${noteIdsRes.error}`,
    );
  }

  const noteIds = noteIdsRes.result ?? [];
  const existing = new Set<string>();

  for (const chunk of chunkArray(noteIds, 200)) {
    if (!chunk.length) continue;
    const infoRes = await anki.requestDetailed("notesInfo", { notes: chunk });
    if (!infoRes.ok) {
      throw new Error(
        `AnkiConnect notesInfo failed while loading existing sentence notes: ${infoRes.error}`,
      );
    }

    for (const note of infoRes.result ?? []) {
      const sentenceEn = asNonEmptyString(note.fields?.sentence_en?.value);
      if (sentenceEn) existing.add(sentenceEn);
    }
  }

  return existing;
}

function getState(): State {
  const g = globalThis as unknown as { __sentenceDeckSyncAll?: State };
  if (!g.__sentenceDeckSyncAll) {
    g.__sentenceDeckSyncAll = {
      jobId: `sentence_deck_sync_${Date.now()}`,
      running: false,
      done: true,
      startedAt: null,
      finishedAt: null,
      error: null,
      stopRequested: false,
      stoppedEarly: false,
      total: 0,
      processed: 0,
      targetAddCount: 10,
      eligible: 0,
      added: 0,
      skippedAlreadyInDeck: 0,
      failed: 0,
      currentSentenceId: null,
      logs: [],
      _started: false,
    };
  }
  return g.__sentenceDeckSyncAll;
}

function pushLog(state: State, line: string) {
  state.logs.push(line);
  if (state.logs.length > 500) {
    state.logs.splice(0, state.logs.length - 500);
  }
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
  state.eligible = 0;
  state.added = 0;
  state.skippedAlreadyInDeck = 0;
  state.failed = 0;
  state.currentSentenceId = null;
  state.logs = [];

  const log = (line: string) => pushLog(state, line);
  const maxAddCount = Math.max(1, Math.trunc(state.targetAddCount || 1));

  try {
    log("Loading candidate sentences from DB...");

    const rows = (await prisma.sentence.findMany({
      where: {
        sentence_en: { not: "" },
      },
      select: {
        id: true,
        sentence_en: true,
        sentence_en_meaning_fa: true,
        updatedAt: true,
      },
      orderBy: { id: "asc" },
    })) as SentenceCandidate[];

    state.total = rows.length;
    log(
      `Loaded ${rows.length} sentence row(s) from DB. targetAddCount=${maxAddCount}`,
    );

    const addClient = createAnkiConnectClient({
      timeoutMs: 20_000,
      retryDelayMs: 750,
    });

    const existingSentences = await loadExistingSentenceSet(addClient);
    log(
      `Loaded ${existingSentences.size} existing note(s) from deck ${SENTENCE_DECK_NAME}.`,
    );

    const sentenceEnAudioById = indexLatestAudioByField("sentence_en");
    const sentenceFaAudioById = indexLatestAudioByField(
      "sentence_en_meaning_fa",
    );
    log(
      `Indexed local audio files: sentence_en=${sentenceEnAudioById.size}, sentence_en_meaning_fa=${sentenceFaAudioById.size}.`,
    );

    for (const row of rows) {
      if (state.stopRequested) {
        state.stoppedEarly = true;
        log("Stop requested. Finishing early...");
        break;
      }

      state.currentSentenceId = row.id;

      try {
        if (existingSentences.has(row.sentence_en)) {
          state.skippedAlreadyInDeck += 1;
          state.processed += 1;
          log(
            `Skip sentence ${row.id}: sentence_en already exists in ${SENTENCE_DECK_NAME}.`,
          );
          continue;
        }

        state.eligible += 1;

        const sentenceKey = sanitizeWordAudioFilenamePart(String(row.id));
        const sentenceEnSound = toSoundTag(
          sentenceEnAudioById.get(sentenceKey),
        );
        const sentenceEnMeaningFaSound = toSoundTag(
          sentenceFaAudioById.get(sentenceKey),
        );

        const addRes = await addClient.requestDetailed("addNote", {
          note: {
            deckName: SENTENCE_DECK_NAME,
            modelName: SENTENCE_MODEL_NAME,
            fields: {
              sentence_en: row.sentence_en,
              sentence_en_sound: sentenceEnSound,
              sentence_en_meaning_fa: row.sentence_en_meaning_fa ?? "",
              sentence_en_meaning_fa_sound: sentenceEnMeaningFaSound,
              updatedAt: row.updatedAt.toISOString(),
            },
            options: {
              allowDuplicate: false,
              duplicateScope: "deck",
              duplicateScopeOptions: {
                deckName: SENTENCE_DECK_NAME,
                checkChildren: false,
                checkAllModels: false,
              },
            },
          },
        });

        if (!addRes.ok) {
          throw new Error(`AnkiConnect addNote failed: ${addRes.error}`);
        }

        const noteId = addRes.result;
        if (noteId == null) {
          throw new Error("AnkiConnect addNote returned null.");
        }

        existingSentences.add(row.sentence_en);
        state.added += 1;
        state.processed += 1;
        log(
          `Added sentence ${row.id} as note ${noteId}. sound_en=${sentenceEnSound ? "yes" : "no"}, sound_fa=${sentenceEnMeaningFaSound ? "yes" : "no"}.`,
        );

        if (state.added >= maxAddCount) {
          state.stoppedEarly = true;
          log(`Reached target add count (${maxAddCount}). Finishing early...`);
          break;
        }
      } catch (error) {
        state.failed += 1;
        state.processed += 1;
        const message = error instanceof Error ? error.message : String(error);
        log(`Failed sentence ${row.id}: ${message}`);
      }
    }

    log(
      `Done. scanned=${state.total}, processed=${state.processed}, eligible=${state.eligible}, added=${state.added}, skippedAlreadyInDeck=${state.skippedAlreadyInDeck}, failed=${state.failed}`,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    state.error = message;
    pushLog(state, `Error: ${message}`);
  } finally {
    state.running = false;
    state.done = true;
    state.finishedAt = nowIso();
    state.currentSentenceId = null;
  }
}

export function getSentenceDeckSyncAllStatus(): SentenceDeckSyncAllStatus {
  const s = getState();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { _started: _ignored, ...pub } = s;
  return pub;
}

export function startSentenceDeckSyncAllIfNeeded(
  targetAddCount?: number,
): SentenceDeckSyncAllStatus {
  const state = getState();
  if (state.running) return getSentenceDeckSyncAllStatus();
  if (state._started && !state.done) return getSentenceDeckSyncAllStatus();

  state.jobId = `sentence_deck_sync_${Date.now()}`;
  state._started = true;
  state.stopRequested = false;
  state.stoppedEarly = false;
  state.targetAddCount = Math.max(1, Math.trunc(targetAddCount ?? 10));

  void runJob(state).catch((e) => {
    state.running = false;
    state.done = true;
    state.error = e instanceof Error ? e.message : String(e);
    state.finishedAt = nowIso();
    state.currentSentenceId = null;
    pushLog(state, `Error: ${state.error}`);
  });

  return getSentenceDeckSyncAllStatus();
}

export function requestStopSentenceDeckSyncAll(): SentenceDeckSyncAllStatus {
  const state = getState();
  state.stopRequested = true;
  pushLog(state, "Stop requested by user.");
  return getSentenceDeckSyncAllStatus();
}

export async function syncSelectedSentencesToSentenceDeck(
  requestedSentenceEns: string[],
): Promise<SelectedSentenceDeckSyncResult> {
  const logs: string[] = [];
  const log = (line: string) => logs.push(line);

  try {
    const normalized = requestedSentenceEns
      .map(asNonEmptyString)
      .filter((value): value is string => Boolean(value));
    const unique = Array.from(new Set(normalized));

    log(
      `Received ${requestedSentenceEns.length} requested row(s), ${unique.length} unique non-empty sentence_en value(s).`,
    );

    if (!unique.length) {
      return {
        ok: false,
        error: "No valid sentence_en values were provided.",
        logs,
      };
    }

    const rows = (await prisma.sentence.findMany({
      where: {
        sentence_en: { in: unique },
      },
      select: {
        id: true,
        sentence_en: true,
        sentence_en_meaning_fa: true,
        updatedAt: true,
      },
    })) as SentenceCandidate[];

    const rowBySentence = new Map(rows.map((row) => [row.sentence_en, row]));
    const orderedRows = unique
      .map((sentenceEn) => rowBySentence.get(sentenceEn))
      .filter((row): row is SentenceCandidate => Boolean(row));
    const notFoundItems = unique.filter(
      (sentenceEn) => !rowBySentence.has(sentenceEn),
    );

    log(
      `Matched ${orderedRows.length} sentence row(s) in DB. notFound=${notFoundItems.length}.`,
    );
    for (const sentenceEn of notFoundItems) {
      log(`Not found in DB: ${sentenceEn}`);
    }

    const addClient = createAnkiConnectClient({
      timeoutMs: 20_000,
      retryDelayMs: 750,
    });

    const existingSentences = await loadExistingSentenceSet(addClient);
    log(
      `Loaded ${existingSentences.size} existing note(s) from deck ${SENTENCE_DECK_NAME}.`,
    );

    const sentenceEnAudioById = indexLatestAudioByField("sentence_en");
    const sentenceFaAudioById = indexLatestAudioByField(
      "sentence_en_meaning_fa",
    );
    log(
      `Indexed local audio files: sentence_en=${sentenceEnAudioById.size}, sentence_en_meaning_fa=${sentenceFaAudioById.size}.`,
    );

    let eligible = 0;
    let added = 0;
    let skippedAlreadyInDeck = 0;
    let failed = 0;
    const addedItems: Array<{
      sentenceId: number;
      sentence_en: string;
      noteId: number;
    }> = [];

    for (const row of orderedRows) {
      try {
        if (existingSentences.has(row.sentence_en)) {
          skippedAlreadyInDeck += 1;
          log(
            `Skip sentence ${row.id}: sentence_en already exists in ${SENTENCE_DECK_NAME}.`,
          );
          continue;
        }

        eligible += 1;

        const sentenceKey = sanitizeWordAudioFilenamePart(String(row.id));
        const sentenceEnSound = toSoundTag(
          sentenceEnAudioById.get(sentenceKey),
        );
        const sentenceEnMeaningFaSound = toSoundTag(
          sentenceFaAudioById.get(sentenceKey),
        );

        const addRes = await addClient.requestDetailed("addNote", {
          note: {
            deckName: SENTENCE_DECK_NAME,
            modelName: SENTENCE_MODEL_NAME,
            fields: {
              sentence_en: row.sentence_en,
              sentence_en_sound: sentenceEnSound,
              sentence_en_meaning_fa: row.sentence_en_meaning_fa ?? "",
              sentence_en_meaning_fa_sound: sentenceEnMeaningFaSound,
              updatedAt: row.updatedAt.toISOString(),
            },
            options: {
              allowDuplicate: false,
              duplicateScope: "deck",
              duplicateScopeOptions: {
                deckName: SENTENCE_DECK_NAME,
                checkChildren: false,
                checkAllModels: false,
              },
            },
          },
        });

        if (!addRes.ok) {
          throw new Error(`AnkiConnect addNote failed: ${addRes.error}`);
        }

        const noteId = addRes.result;
        if (noteId == null) {
          throw new Error("AnkiConnect addNote returned null.");
        }

        existingSentences.add(row.sentence_en);
        added += 1;
        addedItems.push({
          sentenceId: row.id,
          sentence_en: row.sentence_en,
          noteId,
        });
        log(
          `Added sentence ${row.id} as note ${noteId}. sound_en=${sentenceEnSound ? "yes" : "no"}, sound_fa=${sentenceEnMeaningFaSound ? "yes" : "no"}.`,
        );
      } catch (error) {
        failed += 1;
        const message = error instanceof Error ? error.message : String(error);
        log(`Failed sentence ${row.id}: ${message}`);
      }
    }

    log(
      `Done. requested=${unique.length}, matched=${orderedRows.length}, notFound=${notFoundItems.length}, eligible=${eligible}, added=${added}, skippedAlreadyInDeck=${skippedAlreadyInDeck}, failed=${failed}`,
    );

    return {
      ok: true,
      requested: unique.length,
      matched: orderedRows.length,
      notFound: notFoundItems.length,
      eligible,
      added,
      skippedAlreadyInDeck,
      failed,
      logs,
      addedItems,
      notFoundItems,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logs.push(`Error: ${message}`);
    return { ok: false, error: message, logs };
  }
}
