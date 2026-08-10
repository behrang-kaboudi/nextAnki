import "server-only";

import {
  createWordFieldsSyncAllJob,
  type WordFieldsSyncAllStatus,
} from "@/lib/anki/wordFieldsSyncAllJob";

export type SentenceEnSyncAllStatus = WordFieldsSyncAllStatus;

const job = createWordFieldsSyncAllJob({
  stateKey: "__sentenceEnSyncAll",
  jobIdPrefix: "sentence_en_sync",
  jobName: "sentence_en + sentence_en_audio",
  fields: ["sentence_en", "sentence_en_audio"],
});

export const getSentenceEnSyncAllStatus = job.getStatus;
export const startSentenceEnSyncAllIfNeeded = job.start;
export const requestStopSentenceEnSyncAll = job.stop;
