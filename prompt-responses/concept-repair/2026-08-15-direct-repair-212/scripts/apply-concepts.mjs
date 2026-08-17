import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import dotenv from "dotenv";
import { createJiti } from "jiti";

const projectRoot = process.cwd();
for (const filename of [".env.local", ".env"]) {
  const envPath = path.join(projectRoot, filename);
  if (fs.existsSync(envPath)) dotenv.config({ path: envPath });
}

const runRoot = path.join(
  projectRoot,
  "prompt-responses/concept-repair/2026-08-15-direct-repair-212",
);
const responsePath = path.join(runRoot, "final", "response.json");
const sourcePath = path.join(runRoot, "inputs", "apply-source.json");
const reportPath = path.join(runRoot, "final", "apply-report.json");
const backupPath = path.join(projectRoot, "dbBackupToWork", "database_backup.archive");
const apply = process.argv.includes("--apply");

function sha256(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function wordCount(value) {
  const text = value.trim();
  return text ? text.split(/\s+/u).length : 0;
}

function stable(value) {
  return JSON.stringify(value, (_key, child) =>
    child instanceof Date ? child.toISOString() : child,
  );
}

const response = JSON.parse(fs.readFileSync(responsePath, "utf8"));
const source = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
if (
  !response ||
  JSON.stringify(Object.keys(response)) !== JSON.stringify(["reviewedIds", "results", "needsHumanReview"]) ||
  !Array.isArray(response.reviewedIds) ||
  !Array.isArray(response.results) ||
  !Array.isArray(response.needsHumanReview) ||
  response.needsHumanReview.length !== 0 ||
  response.reviewedIds.length !== 212 ||
  response.results.length !== 212 ||
  source.length !== 212
) {
  throw new Error("Final response or apply source has an invalid top-level contract.");
}

const sourceIds = source.map((row) => row.id);
const resultIds = response.results.map((row) => row.id);
if (
  new Set(resultIds).size !== 212 ||
  stable(response.reviewedIds) !== stable(sourceIds) ||
  stable(resultIds) !== stable(sourceIds)
) {
  throw new Error("Final response IDs do not exactly match the ordered apply source.");
}

const sourceById = new Map(source.map((row) => [row.id, row]));
const resultById = new Map(response.results.map((row) => [row.id, row]));
for (const result of response.results) {
  if (
    stable(Object.keys(result)) !== stable(["id", "concept_explained_fa"]) ||
    typeof result.concept_explained_fa !== "string" ||
    !result.concept_explained_fa.trim() ||
    wordCount(result.concept_explained_fa) > 50 ||
    result.concept_explained_fa === sourceById.get(result.id)?.concept_explained_fa
  ) {
    throw new Error(`Invalid or unchanged final concept for WordSense ${result.id}.`);
  }
}

if (!fs.existsSync(backupPath)) throw new Error("Verified full database backup is missing.");
const backup = JSON.parse(fs.readFileSync(backupPath, "utf8"));
if (!Array.isArray(backup?.manifest) || !backup?.data || typeof backup.data !== "object") {
  throw new Error("Database backup is not a validated full archive.");
}

const jiti = createJiti(import.meta.url, {
  alias: {
    "@": path.join(projectRoot, "src"),
    "server-only": path.join(runRoot, "scripts", "server-only-stub.mjs"),
  },
});
const { prisma } = await jiti.import(path.join(projectRoot, "src", "lib", "prisma.ts"));
const { updateWordSense } = await jiti.import(
  path.join(projectRoot, "src", "lib", "words", "wordSenseRepo.ts"),
);

const needsActionStatuses = new Set([
  "NEEDS_ACTION_INVALID_PRIMARY",
  "NEEDS_ACTION_NORMALIZATION_CONFLICT",
  "NEEDS_ACTION_MISSING_PRIMARY",
]);
const allowedChangedFields = new Set([
  "concept_explained_fa",
  "conceptMergeReviewed",
  "inflectionMergeReviewed",
  "meaningReviewStatus",
  "updatedAt",
]);

function withoutAllowedChanges(row) {
  return Object.fromEntries(
    Object.entries(row).filter(([key]) => !allowedChangedFields.has(key)),
  );
}

function assertFresh(rows) {
  if (rows.length !== source.length) throw new Error("One or more target WordSense rows no longer exist.");
  for (let index = 0; index < rows.length; index += 1) {
    const current = rows[index];
    const expected = source[index];
    if (
      current.id !== expected.id ||
      (current.concept_explained_fa ?? "") !== expected.concept_explained_fa ||
      current.updatedAt.toISOString() !== expected.updatedAt ||
      current.conceptMergeReviewed !== expected.conceptMergeReviewed ||
      current.inflectionMergeReviewed !== expected.inflectionMergeReviewed ||
      current.meaningReviewStatus !== expected.meaningReviewStatus
    ) {
      throw new Error(`Stale WordSense ${expected.id}; aborting the complete operation.`);
    }
  }
}

const totalBefore = await prisma.wordSense.count();
const before = await prisma.wordSense.findMany({
  where: { id: { in: sourceIds } },
  orderBy: { id: "asc" },
});
assertFresh(before);

if (!apply) {
  process.stdout.write(JSON.stringify({
    status: "dry-run-pass",
    targetCount: source.length,
    staleCount: 0,
    backupModels: backup.manifest.length,
    backupSha256: sha256(backupPath),
    responseSha256: sha256(responsePath),
    databaseMutation: false,
  }, null, 2));
  process.stdout.write("\n");
  await prisma.$disconnect();
  process.exit(0);
}

await prisma.$transaction(async (tx) => {
  const current = await tx.wordSense.findMany({
    where: { id: { in: sourceIds } },
    orderBy: { id: "asc" },
  });
  assertFresh(current);
  for (const id of sourceIds) {
    await updateWordSense({
      where: { id },
      data: { concept_explained_fa: resultById.get(id).concept_explained_fa },
      select: { id: true },
    }, tx);
  }
}, { maxWait: 10_000, timeout: 120_000 });

const totalAfter = await prisma.wordSense.count();
const after = await prisma.wordSense.findMany({
  where: { id: { in: sourceIds } },
  orderBy: { id: "asc" },
});
if (totalAfter !== totalBefore || after.length !== before.length) {
  throw new Error("WordSense row counts changed unexpectedly.");
}

const violations = [];
let conceptMergeResetCount = 0;
let inflectionMergeResetCount = 0;
let meaningStatusChangedCount = 0;
for (let index = 0; index < before.length; index += 1) {
  const previous = before[index];
  const current = after[index];
  const expectedConcept = resultById.get(current.id).concept_explained_fa;
  const expectedStatus = needsActionStatuses.has(previous.meaningReviewStatus)
    ? previous.meaningReviewStatus
    : previous.meaningId == null
      ? "NEEDS_ACTION_MISSING_PRIMARY"
      : "PENDING";
  if (current.concept_explained_fa !== expectedConcept) violations.push(`${current.id}: concept`);
  if (current.conceptMergeReviewed !== false) violations.push(`${current.id}: conceptMergeReviewed`);
  if (current.inflectionMergeReviewed !== false) violations.push(`${current.id}: inflectionMergeReviewed`);
  if (current.meaningReviewStatus !== expectedStatus) violations.push(`${current.id}: meaningReviewStatus`);
  if (stable(withoutAllowedChanges(current)) !== stable(withoutAllowedChanges(previous))) {
    violations.push(`${current.id}: unrelated field`);
  }
  if (previous.conceptMergeReviewed && !current.conceptMergeReviewed) conceptMergeResetCount += 1;
  if (previous.inflectionMergeReviewed && !current.inflectionMergeReviewed) inflectionMergeResetCount += 1;
  if (previous.meaningReviewStatus !== current.meaningReviewStatus) meaningStatusChangedCount += 1;
}
if (violations.length) throw new Error(`Post-apply verification failed: ${violations.join(", ")}`);

const report = {
  status: "applied-and-verified",
  appliedCount: after.length,
  staleCount: 0,
  wordSenseCountBefore: totalBefore,
  wordSenseCountAfter: totalAfter,
  conceptMergeResetCount,
  inflectionMergeResetCount,
  meaningStatusChangedCount,
  preservedNeedsActionStatusCount: before.filter((row) => needsActionStatuses.has(row.meaningReviewStatus)).length,
  preservedFields: ["comparedMeaningWordIds", "synonymIds", "meaningId", "otherMeaningIds", "sentenceIds", "englishId", "pos"],
  mergeCount: 0,
  deleteCount: 0,
  backup: {
    path: path.relative(projectRoot, backupPath),
    models: backup.manifest.length,
    sha256: sha256(backupPath),
  },
  response: {
    path: path.relative(projectRoot, responsePath),
    sha256: sha256(responsePath),
  },
  appliedIds: sourceIds,
};
writeJson(reportPath, report);
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
await prisma.$disconnect();
