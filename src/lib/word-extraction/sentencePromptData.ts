import "server-only";

import { createAnkiOperations } from "@/lib/anki";
import { AnkiNoteTypes, SentenceAnkiConstants } from "@/lib/anki";
import { quoteAnkiSearchValue } from "@/lib/anki";
import { chunkArray } from "@/lib/anki";
import { prisma } from "@/lib/prisma";

const SENTENCE_DECK_NAME = SentenceAnkiConstants.decks.EnSentences;
const SENTENCE_MODEL_NAME = AnkiNoteTypes.EN_SENTENCES;

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

async function loadExistingAnkiSentenceSet() {
  const anki = createAnkiOperations({ timeoutMs: 20_000, retryDelayMs: 750 });
  const query = `deck:${quoteAnkiSearchValue(SENTENCE_DECK_NAME)} note:${quoteAnkiSearchValue(SENTENCE_MODEL_NAME)}`;
  const noteIdsRes = await anki.findNotes({ query });
  if (!noteIdsRes.ok) {
    throw new Error(
      `AnkiConnect findNotes failed while loading existing sentence notes: ${noteIdsRes.error}`,
    );
  }

  const existing = new Set<string>();
  for (const chunk of chunkArray(noteIdsRes.result ?? [], 200)) {
    if (!chunk.length) continue;
    const infoRes = await anki.notesInfo({ notes: chunk });
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

export async function listSentencesMissingAnkiSentenceNotes(limit: number) {
  const existingSentences = await loadExistingAnkiSentenceSet();
  const rows = await prisma.sentence.findMany({
    where: { sentence_en: { not: "" } },
    orderBy: { id: "asc" },
    select: { sentence_en: true },
  });

  const items: Array<{ sentence_en: string }> = [];
  let skippedAlreadyInAnki = 0;
  let skippedBlank = 0;

  for (const row of rows) {
    const sentenceEn = asNonEmptyString(row.sentence_en);
    if (!sentenceEn) {
      skippedBlank += 1;
      continue;
    }

    if (existingSentences.has(sentenceEn)) {
      skippedAlreadyInAnki += 1;
      continue;
    }

    items.push({ sentence_en: sentenceEn });
    if (items.length >= limit) break;
  }

  return {
    items,
    scanned: rows.length,
    existingAnkiNotes: existingSentences.size,
    skippedAlreadyInAnki,
    skippedBlank,
  };
}
