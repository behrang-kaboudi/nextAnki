import "server-only";

import fs from "node:fs";

import { prisma } from "@/lib/prisma";
import { createAnkiConnectClient } from "@/lib/anki";
import { AnkiNoteTypes, SentenceAnkiConstants } from "@/lib/anki";
import { chunkArray } from "@/lib/anki";
import { quoteAnkiSearchValue } from "@/lib/anki";
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

type ExistingSentenceNote = {
  noteId: number;
  fields: {
    sentence_en: string;
    sentence_en_sound: string;
    sentence_en_meaning_fa: string;
    sentence_en_meaning_fa_sound: string;
    updatedAt: string;
  };
};

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
  updated: number;
  skippedSame: number;
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
      updated: number;
      skippedSame: number;
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

function normalizeCompare(value: unknown) {
  return String(value ?? "").trim();
}

function buildSentenceNoteFields(
  row: SentenceCandidate,
  sentenceEnAudioById: Map<string, ExistingFileInfo>,
  sentenceFaAudioById: Map<string, ExistingFileInfo>,
) {
  const sentenceKey = sanitizeWordAudioFilenamePart(String(row.id));
  return {
    sentence_en: row.sentence_en,
    sentence_en_sound: toSoundTag(sentenceEnAudioById.get(sentenceKey)),
    sentence_en_meaning_fa: row.sentence_en_meaning_fa ?? "",
    sentence_en_meaning_fa_sound: toSoundTag(sentenceFaAudioById.get(sentenceKey)),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function fieldsAreSame(
  existing: ExistingSentenceNote["fields"],
  next: ExistingSentenceNote["fields"],
) {
  return (Object.keys(next) as Array<keyof ExistingSentenceNote["fields"]>).every(
    (key) => normalizeCompare(existing[key]) === normalizeCompare(next[key]),
  );
}

async function loadExistingSentenceNotes(
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
  const existing = new Map<string, ExistingSentenceNote>();

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
      if (!sentenceEn) continue;
      existing.set(sentenceEn, {
        noteId: note.noteId,
        fields: {
          sentence_en: String(note.fields?.sentence_en?.value ?? ""),
          sentence_en_sound: String(note.fields?.sentence_en_sound?.value ?? ""),
          sentence_en_meaning_fa: String(note.fields?.sentence_en_meaning_fa?.value ?? ""),
          sentence_en_meaning_fa_sound: String(note.fields?.sentence_en_meaning_fa_sound?.value ?? ""),
          updatedAt: String(note.fields?.updatedAt?.value ?? ""),
        },
      });
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
      updated: 0,
      skippedSame: 0,
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
  state.updated = 0;
  state.skippedSame = 0;
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

    const existingSentences = await loadExistingSentenceNotes(addClient);
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
        const nextFields = buildSentenceNoteFields(row, sentenceEnAudioById, sentenceFaAudioById);
        const existing = existingSentences.get(row.sentence_en);

        if (existing) {
          if (fieldsAreSame(existing.fields, nextFields)) {
            state.skippedSame += 1;
            state.skippedAlreadyInDeck += 1;
            state.processed += 1;
            log(`Skip sentence ${row.id}: existing note ${existing.noteId} is already up to date.`);
            continue;
          }

          const updateRes = await addClient.requestDetailed("updateNoteFields", {
            note: {
              id: existing.noteId,
              fields: nextFields,
            },
          });
          if (!updateRes.ok) {
            throw new Error(`AnkiConnect updateNoteFields failed: ${updateRes.error}`);
          }

          existingSentences.set(row.sentence_en, { noteId: existing.noteId, fields: nextFields });
          state.updated += 1;
          state.skippedAlreadyInDeck += 1;
          state.processed += 1;
          log(`Updated sentence ${row.id} on existing note ${existing.noteId}.`);
          continue;
        }

        state.eligible += 1;

        const addRes = await addClient.requestDetailed("addNote", {
          note: {
            deckName: SENTENCE_DECK_NAME,
            modelName: SENTENCE_MODEL_NAME,
            fields: nextFields,
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

        existingSentences.set(row.sentence_en, { noteId, fields: nextFields });
        state.added += 1;
        state.processed += 1;
        log(
          `Added sentence ${row.id} as note ${noteId}. sound_en=${nextFields.sentence_en_sound ? "yes" : "no"}, sound_fa=${nextFields.sentence_en_meaning_fa_sound ? "yes" : "no"}.`,
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
      `Done. scanned=${state.total}, processed=${state.processed}, eligible=${state.eligible}, added=${state.added}, updated=${state.updated}, skippedSame=${state.skippedSame}, skippedAlreadyInDeck=${state.skippedAlreadyInDeck}, failed=${state.failed}`,
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

    const existingSentences = await loadExistingSentenceNotes(addClient);
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
    let updated = 0;
    let skippedSame = 0;
    let skippedAlreadyInDeck = 0;
    let failed = 0;
    const addedItems: Array<{
      sentenceId: number;
      sentence_en: string;
      noteId: number;
    }> = [];

    for (const row of orderedRows) {
      try {
        const nextFields = buildSentenceNoteFields(row, sentenceEnAudioById, sentenceFaAudioById);
        const existing = existingSentences.get(row.sentence_en);

        if (existing) {
          skippedAlreadyInDeck += 1;
          if (fieldsAreSame(existing.fields, nextFields)) {
            skippedSame += 1;
            log(`Skip sentence ${row.id}: existing note ${existing.noteId} is already up to date.`);
            continue;
          }

          const updateRes = await addClient.requestDetailed("updateNoteFields", {
            note: {
              id: existing.noteId,
              fields: nextFields,
            },
          });
          if (!updateRes.ok) {
            throw new Error(`AnkiConnect updateNoteFields failed: ${updateRes.error}`);
          }

          existingSentences.set(row.sentence_en, { noteId: existing.noteId, fields: nextFields });
          updated += 1;
          log(`Updated sentence ${row.id} on existing note ${existing.noteId}.`);
          continue;
        }

        eligible += 1;

        const addRes = await addClient.requestDetailed("addNote", {
          note: {
            deckName: SENTENCE_DECK_NAME,
            modelName: SENTENCE_MODEL_NAME,
            fields: nextFields,
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

        existingSentences.set(row.sentence_en, { noteId, fields: nextFields });
        added += 1;
        addedItems.push({
          sentenceId: row.id,
          sentence_en: row.sentence_en,
          noteId,
        });
        log(
          `Added sentence ${row.id} as note ${noteId}. sound_en=${nextFields.sentence_en_sound ? "yes" : "no"}, sound_fa=${nextFields.sentence_en_meaning_fa_sound ? "yes" : "no"}.`,
        );
      } catch (error) {
        failed += 1;
        const message = error instanceof Error ? error.message : String(error);
        log(`Failed sentence ${row.id}: ${message}`);
      }
    }

    log(
      `Done. requested=${unique.length}, matched=${orderedRows.length}, notFound=${notFoundItems.length}, eligible=${eligible}, added=${added}, updated=${updated}, skippedSame=${skippedSame}, skippedAlreadyInDeck=${skippedAlreadyInDeck}, failed=${failed}`,
    );

    return {
      ok: true,
      requested: unique.length,
      matched: orderedRows.length,
      notFound: notFoundItems.length,
      eligible,
      added,
      updated,
      skippedSame,
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
