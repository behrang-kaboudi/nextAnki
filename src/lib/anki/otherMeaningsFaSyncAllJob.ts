import "server-only";

import {
  createWordFieldsSyncAllJob,
  type WordFieldsSyncAllStatus,
} from "@/lib/anki/wordFieldsSyncAllJob";

export type OtherMeaningsFaSyncAllStatus = WordFieldsSyncAllStatus;

const job = createWordFieldsSyncAllJob({
  stateKey: "__otherMeaningsFaSyncAll",
  jobIdPrefix: "other_meanings_fa_sync",
  jobName: "other_meanings_fa + other_meanings_fa_audio",
  fields: ["other_meanings_fa", "other_meanings_fa_audio"],
});

export const getOtherMeaningsFaSyncAllStatus = job.getStatus;
export const startOtherMeaningsFaSyncAllIfNeeded = job.start;
export const requestStopOtherMeaningsFaSyncAll = job.stop;
