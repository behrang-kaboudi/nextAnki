import "server-only";

import { prisma } from "@/lib/prisma";

import { generatePersianWordCanonicalTextAudio } from "./persianWordAudio.server";

export type PersianWordAudioJobStatus = {
  jobId: string;
  running: boolean;
  done: boolean;
  startedAt: string | null;
  finishedAt: string | null;
  error: string | null;
  totalCandidates: number;
  processedCandidates: number;
  generated: number;
  skippedNoText: number;
  currentId: number | null;
  currentText: string | null;
  currentFilename: string | null;
};

type JobState = PersianWordAudioJobStatus & { _started: boolean };

const missingAudioWhere = { OR: [{ audio_file_name: null }, { audio_file_name: "" }] };

function nowIso() {
  return new Date().toISOString();
}

function getState(): JobState {
  const globalState = globalThis as unknown as { __persianWordAudioJob?: JobState };
  if (!globalState.__persianWordAudioJob) {
    globalState.__persianWordAudioJob = {
      jobId: `persian_word_audio_${Date.now()}`,
      running: false,
      done: false,
      startedAt: null,
      finishedAt: null,
      error: null,
      totalCandidates: 0,
      processedCandidates: 0,
      generated: 0,
      skippedNoText: 0,
      currentId: null,
      currentText: null,
      currentFilename: null,
      _started: false,
    };
  }
  return globalState.__persianWordAudioJob;
}

export function getPersianWordAudioJobStatus(): PersianWordAudioJobStatus {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { _started: _ignored, ...status } = getState();
  return status;
}

async function runJob(state: JobState) {
  state.running = true;
  state.done = false;
  state.error = null;
  state.startedAt = nowIso();
  state.finishedAt = null;
  state.processedCandidates = 0;
  state.generated = 0;
  state.skippedNoText = 0;
  state.currentId = null;
  state.currentText = null;
  state.currentFilename = null;
  state.totalCandidates = await prisma.persianWord.count({ where: missingAudioWhere });

  let cursorId: number | undefined;
  for (;;) {
    const rows = await prisma.persianWord.findMany({
      where: missingAudioWhere,
      orderBy: { id: "asc" },
      take: 100,
      ...(cursorId === undefined ? {} : { cursor: { id: cursorId }, skip: 1 }),
      select: { id: true, canonical_text: true },
    });
    if (!rows.length) break;

    for (const row of rows) {
      state.currentId = row.id;
      state.currentText = row.canonical_text;
      if (!row.canonical_text.trim()) {
        state.skippedNoText += 1;
        state.processedCandidates += 1;
        continue;
      }
      const result = await generatePersianWordCanonicalTextAudio(row.id);
      state.currentFilename = result.filename;
      state.generated += 1;
      state.processedCandidates += 1;
    }
    cursorId = rows.at(-1)?.id;
  }

  state.running = false;
  state.done = true;
  state.finishedAt = nowIso();
  state.currentId = null;
  state.currentText = null;
}

export function startPersianWordAudioJobIfNeeded(): PersianWordAudioJobStatus {
  const state = getState();
  if (state.running || (state._started && !state.done)) return getPersianWordAudioJobStatus();

  state.jobId = `persian_word_audio_${Date.now()}`;
  state._started = true;
  void runJob(state).catch((error) => {
    state.running = false;
    state.done = true;
    state.error = error instanceof Error ? error.message : String(error);
    state.finishedAt = nowIso();
    state.currentId = null;
    state.currentText = null;
  });
  return getPersianWordAudioJobStatus();
}
