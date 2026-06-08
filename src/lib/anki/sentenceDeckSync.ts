import "server-only";

import { prisma } from "@/lib/prisma";
import { createAnkiConnectClient } from "@/lib/AnkiConnect";
import { SentenceAnkiConstants, WordAnkiConstants } from "@/lib/AnkiDeck";
import { chunkArray } from "@/lib/AnkiDeck/workflowHelpers";
import { quoteAnkiSearchValue } from "@/lib/AnkiDeck/queries";

const SENTENCE_DECK_NAME = SentenceAnkiConstants.decks.EnSentences;
const SENTENCE_MODEL_NAME = SentenceAnkiConstants.noteTypes.EN_SENTENCES;

type SentenceCandidate = {
  id: number;
  sentence_en: string;
  sentence_en_meaning_fa: string | null;
  items: unknown;
  updatedAt: Date;
};

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

async function loadExistingSentenceSet() {
  const anki = createAnkiConnectClient({ timeoutMs: 20_000, retryDelayMs: 750 });
  const query = `deck:${quoteAnkiSearchValue(SENTENCE_DECK_NAME)} note:${quoteAnkiSearchValue(SENTENCE_MODEL_NAME)}`;
  const noteIdsRes = await anki.requestDetailed("findNotes", { query });
  if (!noteIdsRes.ok) {
    throw new Error(`AnkiConnect findNotes failed while loading existing sentence notes: ${noteIdsRes.error}`);
  }

  const noteIds = noteIdsRes.result ?? [];
  const existing = new Set<string>();

  for (const chunk of chunkArray(noteIds, 200)) {
    if (!chunk.length) continue;
    const infoRes = await anki.requestDetailed("notesInfo", { notes: chunk });
    if (!infoRes.ok) {
      throw new Error(`AnkiConnect notesInfo failed while loading existing sentence notes: ${infoRes.error}`);
    }

    for (const note of infoRes.result ?? []) {
      const sentenceEn = asNonEmptyString(note.fields?.sentence_en?.value);
      if (sentenceEn) existing.add(sentenceEn);
    }
  }

  return existing;
}

async function allItemsHaveFaToEnReviewCards(ankiLinkIds: string[]) {
  const anki = createAnkiConnectClient({ timeoutMs: 20_000, retryDelayMs: 750 });

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
      throw new Error(`AnkiConnect findCards failed for anki_link_id=${ankiLinkId}: ${cardIdsRes.error}`);
    }

    if (!(cardIdsRes.result?.length)) {
      return { ok: false as const, missingAnkiLinkId: ankiLinkId };
    }
  }

  return { ok: true as const };
}

export type SentenceDeckSyncResult = {
  ok: true;
  scanned: number;
  eligible: number;
  added: number;
  skippedEmptyItems: number;
  skippedAlreadyInDeck: number;
  skippedMissingFaToEnReview: number;
  logs: string[];
  addedItems: Array<{ sentenceId: number; sentence_en: string; noteId: number }>;
} | {
  ok: false;
  error: string;
  logs: string[];
};

export async function syncSentencesToSentenceDeck(): Promise<SentenceDeckSyncResult> {
  const logs: string[] = [];
  const log = (line: string) => {
    logs.push(line);
  };

  try {
    log("Loading candidate sentences from DB...");

    const rows = await prisma.sentence.findMany({
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
    }) as SentenceCandidate[];

    log(`Loaded ${rows.length} sentence row(s) from DB.`);

    const existingSentences = await loadExistingSentenceSet();
    log(`Loaded ${existingSentences.size} existing note(s) from deck ${SENTENCE_DECK_NAME}.`);

    const anki = createAnkiConnectClient({ timeoutMs: 20_000, retryDelayMs: 750 });

    let eligible = 0;
    let added = 0;
    let skippedEmptyItems = 0;
    let skippedAlreadyInDeck = 0;
    let skippedMissingFaToEnReview = 0;
    const addedItems: Array<{ sentenceId: number; sentence_en: string; noteId: number }> = [];

    for (const row of rows) {
      const items = parseSentenceItems(row.items);
      if (!items.length) {
        skippedEmptyItems += 1;
        log(`Skip sentence ${row.id}: items is empty.`);
        continue;
      }

      if (existingSentences.has(row.sentence_en)) {
        skippedAlreadyInDeck += 1;
        log(`Skip sentence ${row.id}: sentence_en already exists in ${SENTENCE_DECK_NAME}.`);
        continue;
      }

      const reviewCheck = await allItemsHaveFaToEnReviewCards(items);
      if (!reviewCheck.ok) {
        skippedMissingFaToEnReview += 1;
        log(
          `Skip sentence ${row.id}: FaToEn review card missing for anki_link_id=${reviewCheck.missingAnkiLinkId}.`,
        );
        continue;
      }

      eligible += 1;

      const addRes = await anki.requestDetailed("addNote", {
        note: {
          deckName: SENTENCE_DECK_NAME,
          modelName: SENTENCE_MODEL_NAME,
          fields: {
            sentence_en: row.sentence_en,
            sentence_en_sound: "",
            sentence_en_meaning_fa: row.sentence_en_meaning_fa ?? "",
            sentence_en_meaning_fa_sound: "",
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
        throw new Error(`AnkiConnect addNote failed for sentence ${row.id}: ${addRes.error}`);
      }

      const noteId = addRes.result;
      if (noteId == null) {
        throw new Error(`AnkiConnect addNote returned null for sentence ${row.id}.`);
      }

      existingSentences.add(row.sentence_en);
      added += 1;
      addedItems.push({ sentenceId: row.id, sentence_en: row.sentence_en, noteId });
      log(`Added sentence ${row.id} as note ${noteId}.`);
    }

    log(
      `Done. scanned=${rows.length}, eligible=${eligible}, added=${added}, skippedEmptyItems=${skippedEmptyItems}, skippedAlreadyInDeck=${skippedAlreadyInDeck}, skippedMissingFaToEnReview=${skippedMissingFaToEnReview}`,
    );

    return {
      ok: true,
      scanned: rows.length,
      eligible,
      added,
      skippedEmptyItems,
      skippedAlreadyInDeck,
      skippedMissingFaToEnReview,
      logs,
      addedItems,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logs.push(`Error: ${message}`);
    return { ok: false, error: message, logs };
  }
}
