import "server-only";

import {
  createWordFieldsSyncAllJob,
  type WordFieldsSyncAllStatus,
} from "@/lib/anki/wordFieldsSyncAllJob";

export type JsonHintSyncAllStatus = WordFieldsSyncAllStatus;

const job = createWordFieldsSyncAllJob({
  stateKey: "__jsonHintSyncAll",
  jobIdPrefix: "json_hint_sync",
  jobName: "json_hint",
  fields: ["json_hint"],
});

export const getJsonHintSyncAllStatus = job.getStatus;
export const startJsonHintSyncAllIfNeeded = job.start;
export const requestStopJsonHintSyncAll = job.stop;
