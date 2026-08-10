import "server-only";

import {
  createWordFieldsSyncAllJob,
  type WordFieldsSyncAllStatus,
} from "@/lib/anki/wordFieldsSyncAllJob";

export type ConceptExplainedFaSyncAllStatus = WordFieldsSyncAllStatus;

const job = createWordFieldsSyncAllJob({
  stateKey: "__conceptExplainedFaSyncAll",
  jobIdPrefix: "concept_explained_fa_sync",
  jobName: "concept_explained_fa + concept_explained_fa_audio",
  fields: ["concept_explained_fa", "concept_explained_fa_audio"],
});

export const getConceptExplainedFaSyncAllStatus = job.getStatus;
export const startConceptExplainedFaSyncAllIfNeeded = job.start;
export const requestStopConceptExplainedFaSyncAll = job.stop;
