import "server-only";

import {
  createWordFieldsSyncAllJob,
  type WordFieldsSyncAllStatus,
} from "@/lib/anki/wordFieldsSyncAllJob";

export type MeaningFaSyncAllStatus = WordFieldsSyncAllStatus;

const job = createWordFieldsSyncAllJob({
  stateKey: "__meaningFaSyncAll",
  jobIdPrefix: "meaning_fa_sync",
  jobName: "meaning_fa + meaning_fa_audio",
  fields: ["meaning_fa", "meaning_fa_audio"],
});

export const getMeaningFaSyncAllStatus = job.getStatus;
export const startMeaningFaSyncAllIfNeeded = job.start;
export const requestStopMeaningFaSyncAll = job.stop;
