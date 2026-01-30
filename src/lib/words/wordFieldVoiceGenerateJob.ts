import "server-only";

import fs from "node:fs";
import path from "node:path";

import { prisma } from "@/lib/prisma";
import { generateSpeechFromMixedText } from "@/lib/tts/cloudTts";
import {
  WORD_AUDIO_FIELDS,
  type WordAudioFieldKey,
  WORD_AUDIO_FILENAME_SEPARATOR,
  buildWordFieldAudioFilename,
  sanitizeWordAudioFilenamePart,
} from "@/lib/audio/wordFieldAudioNaming";
import { getWordFieldAudioAbsoluteDir, getWordFieldAudioAbsolutePath } from "@/lib/audio/wordFieldAudioPaths.server";

export type WordFieldVoiceJobStatus = {
  jobId: string;
  field: WordAudioFieldKey;
  running: boolean;
  done: boolean;
  startedAt: string | null;
  finishedAt: string | null;
  error: string | null;

  totalCandidates: number;
  processedCandidates: number;
  generated: number;
  skippedExists: number;
  skippedNoText: number;
  zeroByteFound: number;
  regeneratedZeroByte: number;
  currentId: number | null;
};

type JobState = WordFieldVoiceJobStatus & { _started: boolean };

function nowIso() {
  return new Date().toISOString();
}

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function getAllStates(): Record<WordAudioFieldKey, JobState> {
  const g = globalThis as unknown as { __wordFieldVoiceJobs?: Record<WordAudioFieldKey, JobState> };
  if (!g.__wordFieldVoiceJobs) {
    g.__wordFieldVoiceJobs = Object.fromEntries(
      WORD_AUDIO_FIELDS.map((field) => [
        field,
        {
          jobId: `word_field_voice_${field}_${Date.now()}`,
          field,
          running: false,
          done: false,
          startedAt: null,
          finishedAt: null,
          error: null,
          totalCandidates: 0,
          processedCandidates: 0,
          generated: 0,
          skippedExists: 0,
          skippedNoText: 0,
          zeroByteFound: 0,
          regeneratedZeroByte: 0,
          currentId: null,
          _started: false,
        } satisfies JobState,
      ])
    ) as Record<WordAudioFieldKey, JobState>;
  }
  return g.__wordFieldVoiceJobs;
}

function getState(field: WordAudioFieldKey): JobState {
  return getAllStates()[field];
}

export function getWordFieldVoiceJobStatus(field: WordAudioFieldKey): WordFieldVoiceJobStatus {
  const s = getState(field);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { _started: _ignored, ...pub } = s;
  return pub;
}

type ExistingFileInfo = { filename: string; timestampMs: number; size: number };

function indexExistingFiles(): Map<string, ExistingFileInfo> {
  const dir = getWordFieldAudioAbsoluteDir();
  let entries: string[] = [];
  try {
    entries = fs.readdirSync(dir);
  } catch {
    return new Map();
  }

  const fieldAlternation = WORD_AUDIO_FIELDS.join("|");
  const sep = WORD_AUDIO_FILENAME_SEPARATOR.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const reNew = new RegExp(
    `^(?<anki>.+?)${sep}(?<field>${fieldAlternation})${sep}(?<ts>\\d{8,})\\.mp3$`
  );
  // Legacy: underscore separator (kept for backward-compat so we don't re-generate).
  const reLegacy = new RegExp(`^(?<anki>.+)_(?<field>${fieldAlternation})_(?<ts>\\d{8,})\\.mp3$`);

  const latestByKey = new Map<string, ExistingFileInfo>();
  for (const filename of entries) {
    const m = reNew.exec(filename) ?? reLegacy.exec(filename);
    const field = m?.groups?.field as WordAudioFieldKey | undefined;
    const anki = m?.groups?.anki;
    const ts = Number(m?.groups?.ts);
    if (!anki || !field || !Number.isFinite(ts)) continue;

    let size = 0;
    try {
      size = fs.statSync(getWordFieldAudioAbsolutePath(filename)).size;
    } catch {
      continue;
    }

    const key = `${anki}::${field}`;
    const prev = latestByKey.get(key);
    if (!prev || Math.trunc(ts) > prev.timestampMs) {
      latestByKey.set(key, { filename, timestampMs: Math.trunc(ts), size });
    }
  }

  return latestByKey;
}

async function runJob(state: JobState) {
  state.running = true;
  state.done = false;
  state.error = null;
  state.startedAt = nowIso();
  state.finishedAt = null;
  state.processedCandidates = 0;
  state.generated = 0;
  state.skippedExists = 0;
  state.skippedNoText = 0;
  state.zeroByteFound = 0;
  state.regeneratedZeroByte = 0;
  state.currentId = null;

  const existingIndex = indexExistingFiles();

  const field = state.field;
  state.totalCandidates = await countCandidates(field);

  const take = 200;
  let cursorId: number | null = null;

  for (;;) {
    const rows = await fetchBatch(field, { take, cursorId });

    if (rows.length === 0) break;

    for (const r of rows) {
      state.currentId = r.id;

      const ankiLinkId = asNonEmptyString(r.anki_link_id);
      const text = asNonEmptyString(r.value);
      if (!ankiLinkId || !text) {
        state.skippedNoText += 1;
        continue;
      }

      const key = `${sanitizeWordAudioFilenamePart(ankiLinkId)}::${field}`;
      const existing = existingIndex.get(key);
      if (existing) {
        if (existing.size === 0) {
          state.zeroByteFound += 1;
          await generateSpeechFromMixedText(text, path.join("words", existing.filename), "azure");
          state.regeneratedZeroByte += 1;
        } else {
          state.skippedExists += 1;
        }
      } else {
        const filename = buildWordFieldAudioFilename({ ankiLinkId, field, timestampMs: Date.now() });
        await generateSpeechFromMixedText(text, path.join("words", filename), "azure");
        state.generated += 1;
        existingIndex.set(key, { filename, timestampMs: Date.now(), size: 1 });
      }

      state.processedCandidates += 1;
    }

    cursorId = rows[rows.length - 1].id;
  }

  state.running = false;
  state.done = true;
  state.finishedAt = nowIso();
  state.currentId = null;
}

type CandidateRow = { id: number; anki_link_id: string; value: string | null };

async function countCandidates(field: WordAudioFieldKey): Promise<number> {
  if (field === "other_meanings_fa") {
    return prisma.word.count({
      where: {
        AND: [{ other_meanings_fa: { not: null } }, { other_meanings_fa: { not: "" } }],
      },
    });
  }
  if (field === "sentence_en_meaning_fa") {
    return prisma.word.count({
      where: {
        AND: [
          { sentence_en_meaning_fa: { not: null } },
          { sentence_en_meaning_fa: { not: "" } },
        ],
      },
    });
  }
  if (field === "base_form") return prisma.word.count({ where: { base_form: { notIn: [""] } } });
  if (field === "meaning_fa") return prisma.word.count({ where: { meaning_fa: { notIn: [""] } } });
  return prisma.word.count({ where: { sentence_en: { notIn: [""] } } });
}

async function fetchBatch(
  field: WordAudioFieldKey,
  opts: { take: number; cursorId: number | null }
): Promise<CandidateRow[]> {
  const base = {
    orderBy: { id: "asc" as const },
    take: opts.take,
    ...(opts.cursorId ? { cursor: { id: opts.cursorId }, skip: 1 } : {}),
  };

  if (field === "base_form") {
    const rows = await prisma.word.findMany({ ...base, select: { id: true, anki_link_id: true, base_form: true } });
    return rows.map((r) => ({ id: r.id, anki_link_id: r.anki_link_id, value: r.base_form }));
  }
  if (field === "meaning_fa") {
    const rows = await prisma.word.findMany({ ...base, select: { id: true, anki_link_id: true, meaning_fa: true } });
    return rows.map((r) => ({ id: r.id, anki_link_id: r.anki_link_id, value: r.meaning_fa }));
  }
  if (field === "other_meanings_fa") {
    const rows = await prisma.word.findMany({
      ...base,
      select: { id: true, anki_link_id: true, other_meanings_fa: true },
    });
    return rows.map((r) => ({ id: r.id, anki_link_id: r.anki_link_id, value: r.other_meanings_fa ?? null }));
  }
  if (field === "sentence_en") {
    const rows = await prisma.word.findMany({ ...base, select: { id: true, anki_link_id: true, sentence_en: true } });
    return rows.map((r) => ({ id: r.id, anki_link_id: r.anki_link_id, value: r.sentence_en }));
  }

  const rows = await prisma.word.findMany({
    ...base,
    select: { id: true, anki_link_id: true, sentence_en_meaning_fa: true },
  });
  return rows.map((r) => ({ id: r.id, anki_link_id: r.anki_link_id, value: r.sentence_en_meaning_fa ?? null }));
}

export function startWordFieldVoiceJobIfNeeded(field: WordAudioFieldKey): WordFieldVoiceJobStatus {
  const state = getState(field);
  if (state.running) return getWordFieldVoiceJobStatus(field);
  if (state._started && !state.done) return getWordFieldVoiceJobStatus(field);

  state.jobId = `word_field_voice_${field}_${Date.now()}`;
  state._started = true;

  void runJob(state).catch((e) => {
    state.running = false;
    state.done = true;
    state.error = e instanceof Error ? e.message : String(e);
    state.finishedAt = nowIso();
    state.currentId = null;
  });

  return getWordFieldVoiceJobStatus(field);
}
