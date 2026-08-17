import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const roundDir = resolve(process.argv[2] ?? "");
if (!process.argv[2]) throw new Error("Usage: node finalize-lane22-partial-apply.mjs <round-dir>");
const readJson = async (name) => JSON.parse(await readFile(resolve(roundDir, name), "utf8"));

const priorAccepted = await readJson("accepted-combined-6713.json");
const partialAccepted = await readJson("lane-22-partial-accepted-299.json");
const excluded = await readJson("lane-22-partial-excluded-1.json");
const cumulative = [...priorAccepted, ...partialAccepted].sort((a, b) => a.id - b.id);
if (cumulative.length !== 7012 || new Set(cumulative.map((item) => item.id)).size !== 7012) throw new Error("Cumulative 7,012-record coverage mismatch.");
if (excluded.length !== 1 || excluded[0].id !== 70226) throw new Error("Unexpected excluded-record scope.");

await writeFile(resolve(roundDir, "accepted-combined-7012.json"), `${JSON.stringify(cumulative, null, 2)}\n`, "utf8");
await writeFile(resolve(roundDir, "remaining-excluded-1.json"), `${JSON.stringify(excluded, null, 2)}\n`, "utf8");

const scopeReport = await readJson("lane-22-partial-scope-report.json");
Object.assign(scopeReport, {
  status: "completed_database_verified",
  appliedAt: "2026-08-15T06:17:09Z",
  updated: 299,
  verified: 299,
  skipped: [],
  verificationFailures: [],
  remainingAfter: 1,
});
await writeFile(resolve(roundDir, "lane-22-partial-scope-report.json"), `${JSON.stringify(scopeReport, null, 2)}\n`, "utf8");

const manifest = await readJson("round-manifest.json");
const lane22 = manifest.lanes.find((entry) => entry.lane === 22);
Object.assign(lane22, {
  status: "partially_applied_299_of_300",
  partialAcceptedRecords: 299,
  excludedRecords: 1,
  excludedIds: [70226],
  partialAcceptedFile: "lane-22-partial-accepted-299.json",
  partialExcludedFile: "lane-22-partial-excluded-1.json",
  partialScopeReportFile: "lane-22-partial-scope-report.json",
});
Object.assign(manifest, {
  status: "completed_database_verified_with_one_excluded_record",
  fullyAcceptedBatches: 23,
  partiallyAppliedBatches: 1,
  failedBatches: 0,
  acceptedRecords: 7012,
  failedRecords: 0,
  excludedRecords: 1,
  excludedIds: [70226],
  acceptedFile: "accepted-combined-7012.json",
  failedFile: null,
  excludedFile: "remaining-excluded-1.json",
  updated: 7012,
  verified: 7012,
  remainingAfter: 1,
  partialApplyCompletedAt: "2026-08-15T06:17:09Z",
  partialApplyReportFile: "database-apply-report-lane22-partial.json",
});
await writeFile(resolve(roundDir, "round-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

const roundQc = await readJson("round-qc.json");
Object.assign(roundQc, {
  status: "completed_database_verified_with_one_excluded_record",
  fullyAcceptedBatches: 23,
  partiallyAppliedBatches: 1,
  failedBatches: 0,
  acceptedRecords: 7012,
  failedRecords: 0,
  excludedRecords: 1,
  excludedIds: [70226],
  acceptedFile: "accepted-combined-7012.json",
  failedFile: null,
  excludedFile: "remaining-excluded-1.json",
  partialApplyReportFile: "database-apply-report-lane22-partial.json",
});
await writeFile(resolve(roundDir, "round-qc.json"), `${JSON.stringify(roundQc, null, 2)}\n`, "utf8");

console.log(JSON.stringify({ acceptedRecords: cumulative.length, excludedRecords: excluded.length, excludedIds: [70226], remainingAfter: 1 }, null, 2));
