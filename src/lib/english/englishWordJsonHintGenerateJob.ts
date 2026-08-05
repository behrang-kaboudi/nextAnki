import "server-only";

import { prisma } from "@/lib/prisma";

import { generateEnglishWordJsonHint } from "./englishWordJsonHint.server";

export type EnglishWordJsonHintJobStatus = { jobId: string; running: boolean; done: boolean; startedAt: string | null; finishedAt: string | null; error: string | null; totalCandidates: number; processedCandidates: number; generated: number; skippedNoPhonetic: number; currentId: number | null; currentText: string | null; };
type State = EnglishWordJsonHintJobStatus & { _started: boolean };
const missingJsonHintWhere = { OR: [{ json_hint: null }, { json_hint: "" }] };
const nowIso = () => new Date().toISOString();

function getState(): State {
  const globalState = globalThis as unknown as { __englishWordJsonHintJob?: State };
  if (!globalState.__englishWordJsonHintJob) globalState.__englishWordJsonHintJob = { jobId: `english_word_json_hint_${Date.now()}`, running: false, done: false, startedAt: null, finishedAt: null, error: null, totalCandidates: 0, processedCandidates: 0, generated: 0, skippedNoPhonetic: 0, currentId: null, currentText: null, _started: false };
  return globalState.__englishWordJsonHintJob;
}

export function getEnglishWordJsonHintJobStatus(): EnglishWordJsonHintJobStatus { const { _started: _ignored, ...status } = getState(); return status; }

async function runJob(state: State) {
  Object.assign(state, { running: true, done: false, error: null, startedAt: nowIso(), finishedAt: null, processedCandidates: 0, generated: 0, skippedNoPhonetic: 0, currentId: null, currentText: null });
  state.totalCandidates = await prisma.englishWord.count({ where: missingJsonHintWhere });
  let cursorId: number | undefined;
  for (;;) {
    const rows = await prisma.englishWord.findMany({ where: missingJsonHintWhere, orderBy: { id: "asc" }, take: 100, ...(cursorId === undefined ? {} : { cursor: { id: cursorId }, skip: 1 }), select: { id: true, normalized_text: true } });
    if (!rows.length) break;
    for (const row of rows) {
      state.currentId = row.id; state.currentText = row.normalized_text;
      const result = await generateEnglishWordJsonHint(row.id);
      if (result.jsonHint) state.generated += 1;
      if (result.skippedNoPhonetic) state.skippedNoPhonetic += 1;
      state.processedCandidates += 1;
    }
    cursorId = rows.at(-1)?.id;
  }
  Object.assign(state, { running: false, done: true, finishedAt: nowIso(), currentId: null, currentText: null });
}

export function startEnglishWordJsonHintJobIfNeeded(): EnglishWordJsonHintJobStatus {
  const state = getState();
  if (state.running || (state._started && !state.done)) return getEnglishWordJsonHintJobStatus();
  state.jobId = `english_word_json_hint_${Date.now()}`; state._started = true;
  void runJob(state).catch((error) => { Object.assign(state, { running: false, done: true, error: error instanceof Error ? error.message : String(error), finishedAt: nowIso(), currentId: null, currentText: null }); });
  return getEnglishWordJsonHintJobStatus();
}
