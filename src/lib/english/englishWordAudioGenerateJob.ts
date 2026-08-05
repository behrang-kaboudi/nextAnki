import "server-only";

import { prisma } from "@/lib/prisma";

import { generateEnglishWordAudio } from "./englishWordAudio.server";

export type EnglishWordAudioJobStatus = {
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

type JobState = EnglishWordAudioJobStatus & { _started: boolean };
const missingAudioWhere = { OR: [{ audio_file_name: null }, { audio_file_name: "" }] };
const nowIso = () => new Date().toISOString();

function getState(): JobState {
  const globalState = globalThis as unknown as { __englishWordAudioJob?: JobState };
  if (!globalState.__englishWordAudioJob) {
    globalState.__englishWordAudioJob = { jobId: `english_word_audio_${Date.now()}`, running: false, done: false, startedAt: null, finishedAt: null, error: null, totalCandidates: 0, processedCandidates: 0, generated: 0, skippedNoText: 0, currentId: null, currentText: null, currentFilename: null, _started: false };
  }
  return globalState.__englishWordAudioJob;
}

export function getEnglishWordAudioJobStatus(): EnglishWordAudioJobStatus {
  const { _started: _ignored, ...status } = getState();
  return status;
}

async function runJob(state: JobState) {
  Object.assign(state, { running: true, done: false, error: null, startedAt: nowIso(), finishedAt: null, processedCandidates: 0, generated: 0, skippedNoText: 0, currentId: null, currentText: null, currentFilename: null });
  state.totalCandidates = await prisma.englishWord.count({ where: missingAudioWhere });
  let cursorId: number | undefined;
  for (;;) {
    const rows = await prisma.englishWord.findMany({ where: missingAudioWhere, orderBy: { id: "asc" }, take: 100, ...(cursorId === undefined ? {} : { cursor: { id: cursorId }, skip: 1 }), select: { id: true, normalized_text: true } });
    if (!rows.length) break;
    for (const row of rows) {
      state.currentId = row.id; state.currentText = row.normalized_text;
      if (!row.normalized_text.trim()) { state.skippedNoText += 1; state.processedCandidates += 1; continue; }
      const result = await generateEnglishWordAudio(row.id);
      state.currentFilename = result.filename; state.generated += 1; state.processedCandidates += 1;
    }
    cursorId = rows.at(-1)?.id;
  }
  Object.assign(state, { running: false, done: true, finishedAt: nowIso(), currentId: null, currentText: null });
}

export function startEnglishWordAudioJobIfNeeded(): EnglishWordAudioJobStatus {
  const state = getState();
  if (state.running || (state._started && !state.done)) return getEnglishWordAudioJobStatus();
  state.jobId = `english_word_audio_${Date.now()}`; state._started = true;
  void runJob(state).catch((error) => { Object.assign(state, { running: false, done: true, error: error instanceof Error ? error.message : String(error), finishedAt: nowIso(), currentId: null, currentText: null }); });
  return getEnglishWordAudioJobStatus();
}
