import "server-only";

import {
  createWordFieldsSyncAllJob,
  type WordFieldsSyncAllStatus,
} from "@/lib/anki/wordFieldsSyncAllJob";

export type SentenceEnMeaningFaSyncAllStatus = WordFieldsSyncAllStatus;

const job = createWordFieldsSyncAllJob({
  stateKey: "__sentenceEnMeaningFaSyncAll",
  jobIdPrefix: "sentence_en_meaning_fa_sync",
  jobName: "sentence_en_meaning_fa + sentence_en_meaning_fa_audio",
  fields: ["sentence_en_meaning_fa", "sentence_en_meaning_fa_audio"],
});

export const getSentenceEnMeaningFaSyncAllStatus = job.getStatus;
export const startSentenceEnMeaningFaSyncAllIfNeeded = job.start;
export const requestStopSentenceEnMeaningFaSyncAll = job.stop;
