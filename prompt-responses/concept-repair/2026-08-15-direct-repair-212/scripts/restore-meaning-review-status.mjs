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
const source = JSON.parse(
  fs.readFileSync(path.join(runRoot, "inputs", "apply-source.json"), "utf8"),
);
const response = JSON.parse(
  fs.readFileSync(path.join(runRoot, "final", "response.json"), "utf8"),
);
const reportPath = path.join(runRoot, "final", "meaning-review-status-restoration.json");

if (
  source.length !== 212 ||
  source.some((row) => row.meaningReviewStatus !== "CONFIRMED") ||
  response.results.length !== 212
) {
  throw new Error("The preserved source statuses or final response are incomplete.");
}

const sourceIds = source.map((row) => row.id);
const conceptById = new Map(
  response.results.map((row) => [row.id, row.concept_explained_fa]),
);
if (
  new Set(sourceIds).size !== 212 ||
  JSON.stringify(response.results.map((row) => row.id)) !== JSON.stringify(sourceIds)
) {
  throw new Error("Final response IDs do not match the preserved source IDs.");
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

const allowedChanges = new Set(["meaningReviewStatus", "updatedAt"]);
const stable = (value) => JSON.stringify(value, (_key, child) =>
  child instanceof Date ? child.toISOString() : child,
);
const withoutAllowed = (row) => Object.fromEntries(
  Object.entries(row).filter(([key]) => !allowedChanges.has(key)),
);

const totalBefore = await prisma.wordSense.count();
const before = await prisma.wordSense.findMany({
  where: { id: { in: sourceIds } },
  orderBy: { id: "asc" },
});
if (before.length !== 212) throw new Error("One or more target rows are missing.");
for (const row of before) {
  if (
    row.meaningReviewStatus !== "PENDING" ||
    row.conceptMergeReviewed !== false ||
    row.inflectionMergeReviewed !== false ||
    row.concept_explained_fa !== conceptById.get(row.id)
  ) {
    throw new Error(`WordSense ${row.id} is stale or no longer matches the verified repair state.`);
  }
}

await prisma.$transaction(async (tx) => {
  const current = await tx.wordSense.findMany({
    where: { id: { in: sourceIds } },
    orderBy: { id: "asc" },
  });
  if (stable(current) !== stable(before)) {
    throw new Error("Target records changed after validation; aborting the complete operation.");
  }
  for (const id of sourceIds) {
    await updateWordSense({
      where: { id },
      data: { meaningReviewStatus: "CONFIRMED" },
      select: { id: true },
    }, tx);
  }
}, { maxWait: 10_000, timeout: 120_000 });

const totalAfter = await prisma.wordSense.count();
const after = await prisma.wordSense.findMany({
  where: { id: { in: sourceIds } },
  orderBy: { id: "asc" },
});
const violations = [];
for (let index = 0; index < after.length; index += 1) {
  const previous = before[index];
  const current = after[index];
  if (current.meaningReviewStatus !== "CONFIRMED") violations.push(`${current.id}: status`);
  if (current.conceptMergeReviewed !== false) violations.push(`${current.id}: concept merge flag`);
  if (current.inflectionMergeReviewed !== false) violations.push(`${current.id}: inflection flag`);
  if (current.concept_explained_fa !== conceptById.get(current.id)) violations.push(`${current.id}: concept`);
  if (stable(withoutAllowed(current)) !== stable(withoutAllowed(previous))) {
    violations.push(`${current.id}: unrelated field`);
  }
}
if (totalAfter !== totalBefore || after.length !== before.length || violations.length) {
  throw new Error(`Post-restoration verification failed: ${violations.join(", ")}`);
}

const report = {
  status: "restored-and-verified",
  restoredCount: 212,
  from: "PENDING",
  to: "CONFIRMED",
  conceptMergeReviewed: false,
  inflectionMergeReviewed: false,
  conceptChanges: 0,
  mergeCount: 0,
  deleteCount: 0,
  wordSenseCountBefore: totalBefore,
  wordSenseCountAfter: totalAfter,
  restoredIds: sourceIds,
};
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
await prisma.$disconnect();
