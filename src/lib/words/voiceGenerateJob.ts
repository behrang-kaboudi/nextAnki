import "server-only";

import { prisma } from "@/lib/prisma";
import { ensureHintSentenceVoice } from "@/lib/words/hintSentenceVoice";

export type VoiceJobStatus = {
  jobId: string;
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

type VoiceJobState = VoiceJobStatus & {
  _started: boolean;
};

function nowIso() {
  return new Date().toISOString();
}

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function getState(): VoiceJobState {
  const g = globalThis as unknown as { __voiceJob?: VoiceJobState };
  if (!g.__voiceJob) {
    g.__voiceJob = {
      jobId: `voice_${Date.now()}`,
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
    };
  }
  return g.__voiceJob;
}

export function getVoiceJobStatus(): VoiceJobStatus {
  const s = getState();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { _started: _ignored, ...publicStatus } = s;
  return publicStatus;
}

async function runJob(state: VoiceJobState) {
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

  state.totalCandidates = await prisma.word.count({
    where: {
      hint_sentence: { not: null },
      NOT: { hint_sentence: "" },
    },
  });

  const take = 250;
  let cursorId: number | null = null;

  for (;;) {
    const rows: Array<{ id: number; hint_sentence: string | null }> = await prisma.word.findMany({
      orderBy: { id: "asc" },
      take,
      ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
      select: { id: true, hint_sentence: true },
    });
    if (rows.length === 0) break;

    for (const r of rows) {
      state.currentId = r.id;

      const hintPhrase = asNonEmptyString(r.hint_sentence);
      if (!hintPhrase) {
        state.skippedNoText += 1;
        continue;
      }

      const res = await ensureHintSentenceVoice({ id: r.id, hintSentence: hintPhrase, provider: "azure" });
      if (res.action === "skipped_exists") state.skippedExists += 1;
      if (res.action === "generated") state.generated += 1;
      if (res.action === "regenerated_zero_byte") {
        state.zeroByteFound += 1;
        state.regeneratedZeroByte += 1;
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

export function startVoiceJobIfNeeded(): VoiceJobStatus {
  const state = getState();
  if (state.running) return getVoiceJobStatus();
  if (state._started && !state.done) return getVoiceJobStatus();

  state.jobId = `voice_${Date.now()}`;
  state._started = true;

  void runJob(state).catch((e) => {
    state.running = false;
    state.done = true;
    state.error = e instanceof Error ? e.message : String(e);
    state.finishedAt = nowIso();
    state.currentId = null;
  });

  return getVoiceJobStatus();
}
