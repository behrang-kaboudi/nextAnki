import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const roundDir = resolve(process.argv[2] ?? "");
if (!process.argv[2]) throw new Error("Usage: node finalize-direct-chat-completion.mjs <round-dir>");

const readJson = async (name) => JSON.parse(await readFile(resolve(roundDir, name), "utf8"));
const manifest = await readJson("round-manifest.json");
const threadData = await readJson("threads-created.json");
const threadsByLane = new Map(threadData.threads.map((entry) => [entry.lane, entry]));
const persianPattern = /[\u0600-\u06ff]/u;
const acceptedCombined = [];
const failedCombined = [];
const laneReports = [];

for (const laneEntry of manifest.lanes) {
  const lane = laneEntry.lane;
  const label = String(lane).padStart(2, "0");
  const input = await readJson(`lane-${label}-input.json`);
  const scores = [];
  for (let cycle = 1; cycle <= 4; cycle += 1) {
    try {
      scores.push({ cycle, ...(await readJson(`lane-${label}-score-${String(cycle).padStart(2, "0")}.raw.json`)) });
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }
  if (scores.length === 0 || scores.length > 4) throw new Error(`Invalid score-cycle count for lane ${lane}.`);
  const finalScore = scores.at(-1);
  const responseFile = finalScore.cycle === 1
    ? `lane-${label}-response-initial.raw.json`
    : `lane-${label}-response-revision-${String(finalScore.cycle - 1).padStart(2, "0")}.raw.json`;
  const responseText = await readFile(resolve(roundDir, responseFile), "utf8");
  const response = JSON.parse(responseText);
  const mechanicalIssues = [];
  if (!Array.isArray(response) || response.length !== input.length) {
    mechanicalIssues.push({ type: "count", expected: input.length, actual: Array.isArray(response) ? response.length : null });
  }
  const seen = new Set();
  for (let index = 0; index < Math.max(input.length, response.length); index += 1) {
    const source = input[index];
    const output = response[index];
    if (!output) {
      mechanicalIssues.push({ type: "missing", index, expectedId: source?.id });
      continue;
    }
    if (Object.keys(output).sort().join(",") !== "id,meaning_fa_IPA") mechanicalIssues.push({ type: "schema", index, id: output.id });
    if (output.id !== source?.id) mechanicalIssues.push({ type: "id_or_order", index, expectedId: source?.id, actualId: output.id });
    if (seen.has(output.id)) mechanicalIssues.push({ type: "duplicate_id", index, id: output.id });
    seen.add(output.id);
    if (typeof output.meaning_fa_IPA !== "string" || !output.meaning_fa_IPA.trim()) mechanicalIssues.push({ type: "empty_ipa", index, id: output.id });
    else {
      if (output.meaning_fa_IPA.includes("/")) mechanicalIssues.push({ type: "slash", index, id: output.id });
      if (persianPattern.test(output.meaning_fa_IPA)) mechanicalIssues.push({ type: "persian_character", index, id: output.id });
    }
  }
  if (mechanicalIssues.length) throw new Error(`Lane ${lane} final response failed mechanical validation: ${JSON.stringify(mechanicalIssues.slice(0, 20))}`);

  const scoreSchemaValid = Number.isFinite(finalScore.batchScore)
    && Number.isFinite(finalScore.minimumItemScore)
    && Array.isArray(finalScore.belowOrEqual8Ids)
    && ["pass", "revise"].includes(finalScore.assessment);
  if (!scoreSchemaValid) throw new Error(`Lane ${lane} has an invalid final score response.`);
  const accepted = finalScore.batchScore > 8
    && finalScore.minimumItemScore > 8
    && finalScore.belowOrEqual8Ids.length === 0
    && finalScore.assessment === "pass";
  if (!accepted && finalScore.cycle !== 4) throw new Error(`Lane ${lane} stopped before four score questions without passing.`);

  const report = {
    lane,
    status: accepted ? "accepted" : "failed_after_four_score_questions",
    count: input.length,
    threadId: threadsByLane.get(lane)?.threadId,
    responseFile,
    responseSha256: createHash("sha256").update(responseText).digest("hex"),
    scoreQuestionsAsked: scores.length,
    scoreHistory: scores,
    finalScore,
    mechanicalValidation: { status: "passed", issues: [] },
    itemQualityGate: accepted
      ? "The same chat reported every item above 8/10; minimumItemScore is the minimum across all items."
      : "The same chat still reported one or more items at or below 8/10 after the fourth and final score question.",
  };
  const qcFile = `lane-${label}-qc.json`;
  await writeFile(resolve(roundDir, qcFile), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  if (accepted) {
    const validatedFile = `lane-${label}-response.validated.json`;
    await writeFile(resolve(roundDir, validatedFile), `${JSON.stringify(response, null, 2)}\n`, "utf8");
    response.forEach((item, index) => acceptedCombined.push({ id: item.id, canonical_text: input[index].canonical_text, meaning_fa_IPA: item.meaning_fa_IPA }));
    Object.assign(laneEntry, { status: "accepted", responseFile, validatedFile, qcFile, finalScore });
  } else {
    input.forEach((item) => failedCombined.push({ ...item, lane }));
    Object.assign(laneEntry, { status: "failed_after_four_score_questions", responseFile, qcFile, finalScore });
  }
  Object.assign(laneEntry, { threadId: threadsByLane.get(lane)?.threadId, hostId: threadsByLane.get(lane)?.hostId, scoreQuestionsAsked: scores.length });
  laneReports.push(report);
}

if (acceptedCombined.length + failedCombined.length !== manifest.totalRecords) throw new Error("Final accepted/failed coverage mismatch.");
if (new Set([...acceptedCombined, ...failedCombined].map((item) => item.id)).size !== manifest.totalRecords) throw new Error("Final ID coverage is not unique.");

const acceptedFile = `accepted-combined-${acceptedCombined.length}.json`;
const failedFile = `failed-batches-${failedCombined.length}.json`;
const acceptedText = `${JSON.stringify(acceptedCombined, null, 2)}\n`;
await writeFile(resolve(roundDir, acceptedFile), acceptedText, "utf8");
await writeFile(resolve(roundDir, failedFile), `${JSON.stringify(failedCombined, null, 2)}\n`, "utf8");
const roundQc = {
  status: "quality_gate_complete_pending_database_apply",
  acceptanceRule: { batchScore: "> 8.0", minimumItemScore: "> 8.0", assessment: "pass", maximumScoreQuestions: 4 },
  totalBatches: manifest.laneCount,
  acceptedBatches: laneReports.filter((entry) => entry.status === "accepted").length,
  failedBatches: laneReports.filter((entry) => entry.status !== "accepted").length,
  totalRecords: manifest.totalRecords,
  acceptedRecords: acceptedCombined.length,
  failedRecords: failedCombined.length,
  acceptedFile,
  acceptedSha256: createHash("sha256").update(acceptedText).digest("hex"),
  failedFile,
  lanes: laneReports,
};
await writeFile(resolve(roundDir, "round-qc.json"), `${JSON.stringify(roundQc, null, 2)}\n`, "utf8");
Object.assign(manifest, {
  status: "quality_gate_complete_pending_database_apply",
  qualityGateCompletedAt: new Date().toISOString(),
  acceptedBatches: roundQc.acceptedBatches,
  failedBatches: roundQc.failedBatches,
  acceptedRecords: acceptedCombined.length,
  failedRecords: failedCombined.length,
  acceptedFile,
  failedFile,
  qcFile: "round-qc.json",
});
await writeFile(resolve(roundDir, "round-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ acceptedBatches: roundQc.acceptedBatches, failedBatches: roundQc.failedBatches, acceptedRecords: acceptedCombined.length, failedRecords: failedCombined.length, acceptedFile, failedFile }, null, 2));
