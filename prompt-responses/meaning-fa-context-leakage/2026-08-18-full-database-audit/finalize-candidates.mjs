import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const runDir = path.dirname(fileURLToPath(import.meta.url));
const rawPath = path.join(runDir, "raw-candidates.json");
const outputPath = path.join(runDir, "candidates.json");
const raw = JSON.parse(await readFile(rawPath, "utf8"));

const candidates = raw.candidates
  .filter((candidate) => candidate.detectionScore >= 6)
  .map((candidate) => ({
    ...candidate,
    candidateTier: candidate.detectionScore === 9 ? "strong" : "review",
  }));

const candidateWordSenseIds = candidates.map((candidate) => candidate.wordSenseId);
const candidateEnglishWordIds = [
  ...new Set(candidates.map((candidate) => candidate.englishWordId)),
].sort((a, b) => a - b);

const output = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  databaseScope: raw.databaseScope,
  classificationBoundary:
    "These are whole-database candidates, not confirmed defects. Every included record has both a shorter Persian meaning for the same EnglishWord and explicit sentence-level evidence that another English word or phrase can account for a component of the stored primary meaning.",
  selectionRule:
    "Included when detectionScore >= 6. Lower-signal lexical overlaps remain only in raw-candidates.json and are excluded from this requested review file.",
  counts: {
    candidates: candidates.length,
    strong: candidates.filter((candidate) => candidate.candidateTier === "strong").length,
    review: candidates.filter((candidate) => candidate.candidateTier === "review").length,
    uniqueEnglishWords: candidateEnglishWordIds.length,
  },
  candidateWordSenseIds,
  candidateEnglishWordIds,
  candidates,
};

await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(
  JSON.stringify(
    {
      outputPath,
      counts: output.counts,
      includesCare2067: candidateWordSenseIds.includes(2067),
    },
    null,
    2,
  ),
);
