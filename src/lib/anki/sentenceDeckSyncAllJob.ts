import "server-only";

import fs from "node:fs";

import { prisma } from "@/lib/prisma";
import { createAnkiConnectClient } from "@/lib/AnkiConnect";
import { SentenceAnkiConstants, WordAnkiConstants } from "@/lib/AnkiDeck";
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
const SENTENCE_MODEL_NAME = SentenceAnkiConstants.noteTypes.EN_SENTENCES;

type SentenceCandidate = {
  id: number;
  sentence_en: string;
  sentence_en_meaning_fa: string | null;
  items: unknown;
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
  skippedEmptyItems: number;
  skippedAlreadyInDeck: number;
  skippedMissingFaToEnReview: number;
  failed: number;
  currentSentenceId: number | null;
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

function parseSentenceItems(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  const out: string[] = [];
  const seen = new Set<string>();

  for (const item of value) {
    const next = asNonEmptyString(item);
    if (!next || seen.has(next)) continue;
    seen.add(next);
    out.push(next);
  }

  return out;
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

async function allItemsHaveFaToEnReviewCards(
  ankiLinkIds: string[],
  anki: ReturnType<typeof createAnkiConnectClient>,
): Promise<{ ok: true } | { ok: false; missingAnkiLinkId: string }> {
  for (const ankiLinkId of ankiLinkIds) {
    const query = [
      `deck:${quoteAnkiSearchValue(WordAnkiConstants.decks.FaToEn)}`,
      `note:${quoteAnkiSearchValue(WordAnkiConstants.noteTypes.META_LEX_VR9)}`,
      `card:${quoteAnkiSearchValue(WordAnkiConstants.cardTypes.FaToEn)}`,
      `anki_link_id:${quoteAnkiSearchValue(ankiLinkId)}`,
      "is:review",
    ].join(" ");

    const cardIdsRes = await anki.requestDetailed("findCards", { query });
    if (!cardIdsRes.ok) {
      throw new Error(
        `AnkiConnect findCards failed for anki_link_id=${ankiLinkId}: ${cardIdsRes.error}`,
      );
    }

    if (!cardIdsRes.result?.length) {
      return { ok: false, missingAnkiLinkId: ankiLinkId };
    }
  }

  return { ok: true };
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
      skippedEmptyItems: 0,
      skippedAlreadyInDeck: 0,
      skippedMissingFaToEnReview: 0,
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
  state.skippedEmptyItems = 0;
  state.skippedAlreadyInDeck = 0;
  state.skippedMissingFaToEnReview = 0;
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
        items: true,
        updatedAt: true,
      },
      orderBy: { id: "asc" },
    })) as SentenceCandidate[];

    state.total = rows.length;
    log(
      `Loaded ${rows.length} sentence row(s) from DB. targetAddCount=${maxAddCount}`,
    );

    const reviewChecker = createAnkiConnectClient({
      timeoutMs: 20_000,
      retryDelayMs: 750,
    });
    const addClient = createAnkiConnectClient({
      timeoutMs: 20_000,
      retryDelayMs: 750,
    });

    const existingSentences = await loadExistingSentenceSet(reviewChecker);
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
        const items = parseSentenceItems(row.items);
        if (!items.length) {
          state.skippedEmptyItems += 1;
          state.processed += 1;
          log(`Skip sentence ${row.id}: items is empty.`);
          continue;
        }

        if (existingSentences.has(row.sentence_en)) {
          state.skippedAlreadyInDeck += 1;
          state.processed += 1;
          log(
            `Skip sentence ${row.id}: sentence_en already exists in ${SENTENCE_DECK_NAME}.`,
          );
          continue;
        }

        const reviewCheck = await allItemsHaveFaToEnReviewCards(
          items,
          reviewChecker,
        );
        if (!reviewCheck.ok) {
          state.skippedMissingFaToEnReview += 1;
          state.processed += 1;
          log(
            `Skip sentence ${row.id}: FaToEn review card missing for anki_link_id=${reviewCheck.missingAnkiLinkId}.`,
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
      `Done. scanned=${state.total}, processed=${state.processed}, eligible=${state.eligible}, added=${state.added}, skippedEmptyItems=${state.skippedEmptyItems}, skippedAlreadyInDeck=${state.skippedAlreadyInDeck}, skippedMissingFaToEnReview=${state.skippedMissingFaToEnReview}, failed=${state.failed}`,
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
