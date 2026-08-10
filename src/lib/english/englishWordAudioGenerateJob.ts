import "server-only";

import { audioNeedsGeneration } from "@/lib/audio/audioSourceText";
import { prisma } from "@/lib/prisma";

import {
  deleteEnglishWordAudio,
  generateEnglishWordAudio,
  getEnglishWordAudioFileInfo,
} from "./englishWordAudio.server";

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
const nowIso = () => new Date().toISOString();

function getState(): JobState {
  const globalState = globalThis as unknown as { __englishWordAudioJob?: JobState };
  if (!globalState.__englishWordAudioJob) {
    globalState.__englishWordAudioJob = { jobId: `english_word_audio_${Date.now()}`, running: false, done: false, startedAt: null, finishedAt: null, error: null, totalCandidates: 0, processedCandidates: 0, generated: 0, skippedNoText: 0, currentId: null, currentText: null, currentFilename: null, _started: false };
  }
  return globalState.__englishWordAudioJob;
}

export function getEnglishWordAudioJobStatus(): EnglishWordAudioJobStatus {
  const status = { ...getState() };
  delete (status as Partial<JobState>)._started;
  return status;
}

async function runJob(state: JobState) {
  Object.assign(state, { running: true, done: false, error: null, startedAt: nowIso(), finishedAt: null, processedCandidates: 0, generated: 0, skippedNoText: 0, currentId: null, currentText: null, currentFilename: null });
  const rows = (await prisma.englishWord.findMany({
    orderBy: { id: "asc" },
    select: { id: true, base_form: true, audio_file_name: true, audio_source_text: true },
  })).filter((row) => audioNeedsGeneration({
    text: row.base_form,
    sourceText: row.audio_source_text,
    fileSize: getEnglishWordAudioFileInfo(row.audio_file_name).size,
  }));
  state.totalCandidates = rows.length;
  for (const row of rows) {
      state.currentId = row.id; state.currentText = row.base_form;
      if (!row.base_form.trim()) { state.skippedNoText += 1; state.processedCandidates += 1; continue; }
      if ((row.audio_file_name || row.audio_source_text) && getEnglishWordAudioFileInfo(row.audio_file_name).size <= 0) {
        await deleteEnglishWordAudio(row.id);
      }
      const result = await generateEnglishWordAudio(row.id);
      state.currentFilename = result.filename; state.generated += 1; state.processedCandidates += 1;
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
