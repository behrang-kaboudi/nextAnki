import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const roundDir = resolve(process.argv[2] ?? "");
if (!process.argv[2]) throw new Error("Usage: node finalize-direct-chat-extended-retry.mjs <round-dir>");
const readJson = async (name) => JSON.parse(await readFile(resolve(roundDir, name), "utf8"));
const manifest = await readJson("round-manifest.json");
const roundQc = await readJson("round-qc.json");
const priorAccepted = await readJson("accepted-combined-5813.json");
const persianPattern = /[\u0600-\u06ff]/u;
const configs = [
  { lane: 2, responseFile: "lane-02-response-revision-05.raw.json", scoreFile: "lane-02-score-06.raw.json", regenerations: 5, scoreQuestions: 6 },
  { lane: 16, responseFile: "lane-16-response-revision-04.raw.json", scoreFile: "lane-16-score-05.raw.json", regenerations: 4, scoreQuestions: 5 },
  { lane: 21, responseFile: "lane-21-response-revision-05.raw.json", scoreFile: "lane-21-score-06.raw.json", regenerations: 5, scoreQuestions: 6 },
  { lane: 22, responseFile: "lane-22-response-revision-05.raw.json", scoreFile: "lane-22-score-06.raw.json", regenerations: 5, scoreQuestions: 6 },
];
const retryAccepted = [];
const retryFailed = [];
const retryReports = [];

for (const config of configs) {
  const label = String(config.lane).padStart(2, "0");
  const input = await readJson(`lane-${label}-input.json`);
  const responseText = await readFile(resolve(roundDir, config.responseFile), "utf8");
  const response = JSON.parse(responseText);
  const score = await readJson(config.scoreFile);
  const issues = [];
  if (!Array.isArray(response) || response.length !== input.length) issues.push({ type: "count", expected: input.length, actual: Array.isArray(response) ? response.length : null });
  const seen = new Set();
  for (let index = 0; index < Math.max(input.length, response.length); index += 1) {
    const source = input[index];
    const output = response[index];
    if (!output) { issues.push({ type: "missing", index, expectedId: source?.id }); continue; }
    if (Object.keys(output).sort().join(",") !== "id,meaning_fa_IPA") issues.push({ type: "schema", index, id: output.id });
    if (output.id !== source?.id) issues.push({ type: "id_or_order", index, expectedId: source?.id, actualId: output.id });
    if (seen.has(output.id)) issues.push({ type: "duplicate_id", index, id: output.id });
    seen.add(output.id);
    if (typeof output.meaning_fa_IPA !== "string" || !output.meaning_fa_IPA.trim()) issues.push({ type: "empty_ipa", index, id: output.id });
    else {
      if (output.meaning_fa_IPA.includes("/")) issues.push({ type: "slash", index, id: output.id });
      if (persianPattern.test(output.meaning_fa_IPA)) issues.push({ type: "persian_character", index, id: output.id });
    }
  }
  if (issues.length) throw new Error(`Lane ${config.lane} extended retry failed mechanical validation: ${JSON.stringify(issues.slice(0, 20))}`);
  const accepted = Number.isFinite(score.batchScore)
    && Number.isFinite(score.minimumItemScore)
    && Array.isArray(score.belowOrEqual8Ids)
    && score.batchScore > 8
    && score.minimumItemScore > 8
    && score.belowOrEqual8Ids.length === 0
    && score.assessment === "pass";
  const report = {
    lane: config.lane,
    status: accepted ? "accepted_after_extended_retry" : "failed_after_five_regenerations",
    count: input.length,
    regenerations: config.regenerations,
    scoreQuestionsAsked: config.scoreQuestions,
    responseFile: config.responseFile,
    responseSha256: createHash("sha256").update(responseText).digest("hex"),
    scoreFile: config.scoreFile,
    finalScore: score,
    mechanicalValidation: { status: "passed", issues: [] },
  };
  const qcFile = `lane-${label}-qc-extended-retry.json`;
  await writeFile(resolve(roundDir, qcFile), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  const laneEntry = manifest.lanes.find((entry) => entry.lane === config.lane);
  if (accepted) {
    const validatedFile = `lane-${label}-response.validated-extended-retry.json`;
    await writeFile(resolve(roundDir, validatedFile), `${JSON.stringify(response, null, 2)}\n`, "utf8");
    response.forEach((item, index) => retryAccepted.push({ id: item.id, canonical_text: input[index].canonical_text, meaning_fa_IPA: item.meaning_fa_IPA }));
    Object.assign(laneEntry, { status: "accepted_after_extended_retry", responseFile: config.responseFile, validatedFile, qcFile, finalScore: score, regenerations: config.regenerations, scoreQuestionsAsked: config.scoreQuestions });
  } else {
    input.forEach((item) => retryFailed.push({ ...item, lane: config.lane }));
    Object.assign(laneEntry, { status: "failed_after_five_regenerations", responseFile: config.responseFile, qcFile, finalScore: score, regenerations: config.regenerations, scoreQuestionsAsked: config.scoreQuestions });
  }
  retryReports.push(report);
}

if (retryAccepted.length !== 900 || retryFailed.length !== 300) throw new Error(`Unexpected retry coverage: accepted ${retryAccepted.length}, failed ${retryFailed.length}.`);
const cumulativeAccepted = [...priorAccepted, ...retryAccepted].sort((a, b) => a.id - b.id);
if (cumulativeAccepted.length !== 6713 || new Set(cumulativeAccepted.map((item) => item.id)).size !== 6713) throw new Error("Cumulative accepted coverage mismatch.");

await writeFile(resolve(roundDir, "retry-accepted-combined-900.json"), `${JSON.stringify(retryAccepted, null, 2)}\n`, "utf8");
await writeFile(resolve(roundDir, "accepted-combined-6713.json"), `${JSON.stringify(cumulativeAccepted, null, 2)}\n`, "utf8");
await writeFile(resolve(roundDir, "failed-batches-remaining-300.json"), `${JSON.stringify(retryFailed, null, 2)}\n`, "utf8");
const retryQc = {
  status: "extended_retry_complete_pending_database_apply",
  rule: { acceptedWhen: "batchScore > 8 and minimumItemScore > 8", maximumRegenerations: 5 },
  retriedBatches: configs.length,
  acceptedBatches: retryReports.filter((entry) => entry.status === "accepted_after_extended_retry").length,
  failedBatches: retryReports.filter((entry) => entry.status !== "accepted_after_extended_retry").length,
  acceptedRecords: retryAccepted.length,
  failedRecords: retryFailed.length,
  reports: retryReports,
};
await writeFile(resolve(roundDir, "extended-retry-qc.json"), `${JSON.stringify(retryQc, null, 2)}\n`, "utf8");
Object.assign(roundQc, {
  status: "extended_retry_complete_pending_database_apply",
  acceptedBatches: 23,
  failedBatches: 1,
  acceptedRecords: 6713,
  failedRecords: 300,
  acceptedFile: "accepted-combined-6713.json",
  failedFile: "failed-batches-remaining-300.json",
  extendedRetryFile: "extended-retry-qc.json",
  extendedRetry: retryQc,
});
await writeFile(resolve(roundDir, "round-qc.json"), `${JSON.stringify(roundQc, null, 2)}\n`, "utf8");
Object.assign(manifest, {
  status: "extended_retry_complete_pending_database_apply",
  extendedRetryCompletedAt: new Date().toISOString(),
  acceptedBatches: 23,
  failedBatches: 1,
  acceptedRecords: 6713,
  failedRecords: 300,
  acceptedFile: "accepted-combined-6713.json",
  failedFile: "failed-batches-remaining-300.json",
  extendedRetryFile: "extended-retry-qc.json",
});
await writeFile(resolve(roundDir, "round-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ acceptedBatches: 3, failedBatches: 1, acceptedRecords: retryAccepted.length, failedRecords: retryFailed.length, cumulativeAccepted: cumulativeAccepted.length }, null, 2));
