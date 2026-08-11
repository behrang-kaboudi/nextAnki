import "server-only";

import { WORD_AUDIO_BATCH_FIELDS, type WordAudioBatchFieldKey } from "@/lib/audio/wordAudioFields";
import { getAudioGenerationReason, type AudioGenerationReason } from "@/lib/audio/audioSourceText";
import { isSentenceAudioField, type SentenceAudioField } from "@/lib/audio/sentenceAudioNaming";
import { isWordConceptAudioField } from "@/lib/audio/wordConceptAudioNaming";
import {
  deleteEnglishWordAudio,
  generateEnglishWordAudio,
  getEnglishWordAudioFileInfo,
} from "@/lib/english/englishWordAudio.server";
import { prisma } from "@/lib/prisma";
import {
  deletePersianWordAudio,
  generatePersianWordCanonicalTextAudio,
  getPersianWordAudioFileInfo,
} from "@/lib/persian/persianWordAudio.server";
import {
  deleteSentenceAudio,
  generateSentenceAudio,
  getSentenceAudioFileInfo,
} from "@/lib/sentences/sentenceAudio.server";
import {
  deleteWordConceptAudio,
  generateWordConceptAudio,
  getWordConceptAudioFileInfo,
} from "@/lib/words/wordConceptAudio.server";

export type WordFieldVoiceJobStatus = {
  jobId: string;
  field: WordAudioBatchFieldKey;
  running: boolean;
  done: boolean;
  startedAt: string | null;
  finishedAt: string | null;
  error: string | null;
  totalCandidates: number;
  processedCandidates: number;
  missingFileCandidates: number;
  changedTextCandidates: number;
  processedMissingFile: number;
  processedChangedText: number;
  generated: number;
  skippedExists: number;
  skippedNoText: number;
  zeroByteFound: number;
  regeneratedZeroByte: number;
  currentId: number | null;
};

type JobState = WordFieldVoiceJobStatus & { _started: boolean };
type Candidate = {
  id: number;
  text: string;
  filename: string | null;
  sourceText: string | null;
};
type CandidateWithReason = Candidate & { reason: AudioGenerationReason };

const nowIso = () => new Date().toISOString();

function createInitialState(field: WordAudioBatchFieldKey): JobState {
  return {
    jobId: `word_field_voice_${field}_${Date.now()}`,
    field,
    running: false,
    done: false,
    startedAt: null,
    finishedAt: null,
    error: null,
    totalCandidates: 0,
    processedCandidates: 0,
    missingFileCandidates: 0,
    changedTextCandidates: 0,
    processedMissingFile: 0,
    processedChangedText: 0,
    generated: 0,
    skippedExists: 0,
    skippedNoText: 0,
    zeroByteFound: 0,
    regeneratedZeroByte: 0,
    currentId: null,
    _started: false,
  };
}

function getAllStates(): Record<WordAudioBatchFieldKey, JobState> {
  const globalState = globalThis as unknown as { __wordFieldVoiceJobs?: Record<WordAudioBatchFieldKey, JobState> };
  if (!globalState.__wordFieldVoiceJobs) {
    globalState.__wordFieldVoiceJobs = Object.fromEntries(
      WORD_AUDIO_BATCH_FIELDS.map((field) => [field, createInitialState(field)]),
    ) as Record<WordAudioBatchFieldKey, JobState>;
  }
  for (const field of WORD_AUDIO_BATCH_FIELDS) {
    if (!globalState.__wordFieldVoiceJobs[field]) globalState.__wordFieldVoiceJobs[field] = createInitialState(field);
  }
  return globalState.__wordFieldVoiceJobs;
}

function getState(field: WordAudioBatchFieldKey): JobState {
  return getAllStates()[field];
}

export function getWordFieldVoiceJobStatus(field: WordAudioBatchFieldKey): WordFieldVoiceJobStatus {
  const status = { ...getState(field) };
  delete (status as Partial<JobState>)._started;
  return status;
}

async function fetchCandidates(field: WordAudioBatchFieldKey): Promise<Candidate[]> {
  if (field === "base_form") {
    return (await prisma.englishWord.findMany({
      where: { base_form: { notIn: [""] } },
      orderBy: { id: "asc" },
      select: { id: true, base_form: true, audio_file_name: true, audio_source_text: true },
    })).map((row) => ({
      id: row.id,
      text: row.base_form,
      filename: row.audio_file_name,
      sourceText: row.audio_source_text,
    }));
  }
  if (field === "canonical_text") {
    return (await prisma.persianWord.findMany({
      where: { canonical_text: { notIn: [""] } },
      orderBy: { id: "asc" },
      select: { id: true, canonical_text: true, audio_file_name: true, audio_source_text: true },
    })).map((row) => ({
      id: row.id,
      text: row.canonical_text,
      filename: row.audio_file_name,
      sourceText: row.audio_source_text,
    }));
  }
  if (isWordConceptAudioField(field)) {
    return (await prisma.word.findMany({
      where: { AND: [{ concept_explained_fa: { not: null } }, { concept_explained_fa: { not: "" } }] },
      orderBy: { id: "asc" },
      select: {
        id: true,
        concept_explained_fa: true,
        concept_explained_fa_audio_file_name: true,
        concept_explained_fa_audio_source_text: true,
      },
    })).map((row) => ({
      id: row.id,
      text: row.concept_explained_fa!,
      filename: row.concept_explained_fa_audio_file_name,
      sourceText: row.concept_explained_fa_audio_source_text,
    }));
  }
  const sentenceField = field as SentenceAudioField;
  return (await prisma.sentence.findMany({
    where: sentenceField === "sentence_en"
      ? { sentence_en: { notIn: [""] } }
      : { AND: [{ sentence_en_meaning_fa: { not: null } }, { sentence_en_meaning_fa: { not: "" } }] },
    orderBy: { id: "asc" },
    select: {
      id: true,
      sentence_en: true,
      sentence_en_meaning_fa: true,
      sentence_en_audio_file_name: true,
      sentence_en_audio_source_text: true,
      sentence_en_meaning_fa_audio_file_name: true,
      sentence_en_meaning_fa_audio_source_text: true,
    },
  })).map((row) => ({
    id: row.id,
    text: sentenceField === "sentence_en" ? row.sentence_en : row.sentence_en_meaning_fa!,
    filename: sentenceField === "sentence_en" ? row.sentence_en_audio_file_name : row.sentence_en_meaning_fa_audio_file_name,
    sourceText: sentenceField === "sentence_en"
      ? row.sentence_en_audio_source_text
      : row.sentence_en_meaning_fa_audio_source_text,
  }));
}

function existingSize(field: WordAudioBatchFieldKey, filename: string | null): number {
  if (field === "base_form") return getEnglishWordAudioFileInfo(filename).size;
  if (field === "canonical_text") return getPersianWordAudioFileInfo(filename).size;
  if (isWordConceptAudioField(field)) return getWordConceptAudioFileInfo(filename).size;
  if (isSentenceAudioField(field)) return getSentenceAudioFileInfo(filename).size;
  return 0;
}

async function generate(field: WordAudioBatchFieldKey, candidate: Candidate) {
  if (field === "base_form") return generateEnglishWordAudio(candidate.id);
  if (field === "canonical_text") return generatePersianWordCanonicalTextAudio(candidate.id);
  if (isWordConceptAudioField(field)) return generateWordConceptAudio(candidate.id);
  if (isSentenceAudioField(field)) return generateSentenceAudio(candidate.id, field);
  throw new Error(`Unsupported audio field: ${field}`);
}

async function clearMissingFileMetadata(field: WordAudioBatchFieldKey, id: number) {
  if (field === "base_form") return deleteEnglishWordAudio(id);
  if (field === "canonical_text") return deletePersianWordAudio(id);
  if (isWordConceptAudioField(field)) return deleteWordConceptAudio(id);
  if (isSentenceAudioField(field)) return deleteSentenceAudio(id, field);
}

async function runJob(state: JobState) {
  Object.assign(state, {
    running: true,
    done: false,
    error: null,
    startedAt: nowIso(),
    finishedAt: null,
    totalCandidates: 0,
    processedCandidates: 0,
    missingFileCandidates: 0,
    changedTextCandidates: 0,
    processedMissingFile: 0,
    processedChangedText: 0,
    generated: 0,
    skippedExists: 0,
    skippedNoText: 0,
    zeroByteFound: 0,
    regeneratedZeroByte: 0,
    currentId: null,
  });

  const candidates = (await fetchCandidates(state.field)).flatMap((candidate): CandidateWithReason[] => {
    const reason = getAudioGenerationReason({
      text: candidate.text,
      sourceText: candidate.sourceText,
      fileSize: existingSize(state.field, candidate.filename),
    });
    return reason ? [{ ...candidate, reason }] : [];
  });
  state.totalCandidates = candidates.length;
  state.missingFileCandidates = candidates.filter((candidate) => candidate.reason === "missing-file").length;
  state.changedTextCandidates = candidates.filter((candidate) => candidate.reason === "changed-text").length;
  for (const candidate of candidates) {
    state.currentId = candidate.id;
    if (!candidate.text.trim()) {
      state.skippedNoText += 1;
    } else {
      const fileSize = existingSize(state.field, candidate.filename);
      const missingFile = Boolean(candidate.filename) && fileSize <= 0;
      const orphanedMetadata = fileSize <= 0 && Boolean(candidate.filename || candidate.sourceText);
      if (missingFile) state.zeroByteFound += 1;
      if (orphanedMetadata) await clearMissingFileMetadata(state.field, candidate.id);
      await generate(state.field, candidate);
      state.generated += 1;
      if (missingFile) state.regeneratedZeroByte += 1;
    }
    state.processedCandidates += 1;
    if (candidate.reason === "missing-file") state.processedMissingFile += 1;
    else state.processedChangedText += 1;
  }

  Object.assign(state, { running: false, done: true, finishedAt: nowIso(), currentId: null });
}

export function startWordFieldVoiceJobIfNeeded(field: WordAudioBatchFieldKey): WordFieldVoiceJobStatus {
  const state = getState(field);
  if (state.running || (state._started && !state.done)) return getWordFieldVoiceJobStatus(field);
  state.jobId = `word_field_voice_${field}_${Date.now()}`;
  state._started = true;
  void runJob(state).catch((error) => {
    Object.assign(state, {
      running: false,
      done: true,
      error: error instanceof Error ? error.message : String(error),
      finishedAt: nowIso(),
      currentId: null,
    });
  });
  return getWordFieldVoiceJobStatus(field);
}
