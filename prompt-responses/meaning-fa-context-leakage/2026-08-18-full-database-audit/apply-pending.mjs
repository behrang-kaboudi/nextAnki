import fs from "node:fs";
import path from "node:path";

import dotenv from "dotenv";
import { createJiti } from "jiti";

const projectRoot = process.cwd();
const runRoot = path.join(
  projectRoot,
  "prompt-responses/meaning-fa-context-leakage/2026-08-18-full-database-audit",
);
for (const filename of [".env.local", ".env"]) {
  const envPath = path.join(projectRoot, filename);
  if (fs.existsSync(envPath)) dotenv.config({ path: envPath });
}

const candidatesPath = path.join(runRoot, "candidates.json");
const snapshotPath = path.join(runRoot, "pre-pending-status-snapshot.json");
const reportPath = path.join(runRoot, "pending-apply-report.json");
const candidates = JSON.parse(fs.readFileSync(candidatesPath, "utf8"));
const ids = candidates.candidateWordSenseIds;

if (
  !Array.isArray(ids) ||
  ids.length !== 102 ||
  new Set(ids).size !== ids.length ||
  ids.some((id) => !Number.isSafeInteger(id) || id <= 0)
) {
  throw new Error("Candidate WordSense IDs are missing, duplicated, or invalid.");
}

const jiti = createJiti(import.meta.url, {
  alias: {
    "@": path.join(projectRoot, "src"),
    "server-only": path.join(runRoot, "server-only-stub.mjs"),
  },
});
const { prisma } = await jiti.import(path.join(projectRoot, "src", "lib", "prisma.ts"));
const { updateManyWordSenses } = await jiti.import(
  path.join(projectRoot, "src", "lib", "words", "wordSenseRepo.ts"),
);

const stable = (value) =>
  JSON.stringify(value, (_key, child) =>
    child instanceof Date ? child.toISOString() : child,
  );
const withoutAllowedChanges = (row) =>
  Object.fromEntries(
    Object.entries(row).filter(
      ([key]) => key !== "meaningReviewStatus" && key !== "updatedAt",
    ),
  );

const [totalBefore, globalStatusBefore, before] = await Promise.all([
  prisma.wordSense.count(),
  prisma.wordSense.groupBy({
    by: ["meaningReviewStatus"],
    _count: { _all: true },
  }),
  prisma.wordSense.findMany({
    where: { id: { in: ids } },
    orderBy: { id: "asc" },
  }),
]);

if (before.length !== ids.length) {
  throw new Error(`Expected ${ids.length} target rows, found ${before.length}.`);
}
const unexpected = before.filter(
  (row) =>
    row.meaningId === null ||
    !["CONFIRMED", "PENDING"].includes(row.meaningReviewStatus),
);
if (unexpected.length) {
  throw new Error(
    `Unexpected target state for WordSense IDs: ${unexpected.map((row) => row.id).join(", ")}`,
  );
}

const snapshot = {
  capturedAt: new Date().toISOString(),
  candidateFile: "candidates.json",
  targetCount: ids.length,
  confirmedCount: before.filter((row) => row.meaningReviewStatus === "CONFIRMED").length,
  alreadyPendingCount: before.filter((row) => row.meaningReviewStatus === "PENDING").length,
  records: before,
};
fs.writeFileSync(snapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`);

let changedCount = 0;
await prisma.$transaction(
  async (tx) => {
    const current = await tx.wordSense.findMany({
      where: { id: { in: ids } },
      orderBy: { id: "asc" },
    });
    if (stable(current) !== stable(before)) {
      throw new Error("Target records changed after snapshot; aborting without an update.");
    }
    const result = await updateManyWordSenses(
      {
        where: {
          id: { in: ids },
          meaningReviewStatus: "CONFIRMED",
        },
        data: { meaningReviewStatus: "PENDING" },
      },
      tx,
    );
    changedCount = result.count;
  },
  { maxWait: 10_000, timeout: 120_000 },
);

const [totalAfter, globalStatusAfter, after] = await Promise.all([
  prisma.wordSense.count(),
  prisma.wordSense.groupBy({
    by: ["meaningReviewStatus"],
    _count: { _all: true },
  }),
  prisma.wordSense.findMany({
    where: { id: { in: ids } },
    orderBy: { id: "asc" },
  }),
]);

const violations = [];
for (let index = 0; index < before.length; index += 1) {
  const previous = before[index];
  const current = after[index];
  if (!current || current.id !== previous.id) {
    violations.push(`${previous.id}: missing or reordered`);
    continue;
  }
  if (current.meaningReviewStatus !== "PENDING") {
    violations.push(`${current.id}: status is ${current.meaningReviewStatus}`);
  }
  if (stable(withoutAllowedChanges(current)) !== stable(withoutAllowedChanges(previous))) {
    violations.push(`${current.id}: unrelated field changed`);
  }
}
if (
  totalAfter !== totalBefore ||
  after.length !== before.length ||
  changedCount !== snapshot.confirmedCount ||
  violations.length
) {
  throw new Error(`Post-apply verification failed: ${violations.join(", ")}`);
}

const statusCounts = (groups) =>
  Object.fromEntries(groups.map((group) => [group.meaningReviewStatus, group._count._all]));
const report = {
  status: "applied-and-verified",
  appliedAt: new Date().toISOString(),
  targetCount: ids.length,
  changedFromConfirmedToPending: changedCount,
  alreadyPending: snapshot.alreadyPendingCount,
  finalPendingCountInScope: after.filter(
    (row) => row.meaningReviewStatus === "PENDING",
  ).length,
  databaseWordSenseCountBefore: totalBefore,
  databaseWordSenseCountAfter: totalAfter,
  globalStatusCountsBefore: statusCounts(globalStatusBefore),
  globalStatusCountsAfter: statusCounts(globalStatusAfter),
  allowedChangedFields: ["meaningReviewStatus", "updatedAt"],
  unrelatedFieldViolations: violations,
  targetIds: ids,
  snapshotFile: "pre-pending-status-snapshot.json",
};
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
await prisma.$disconnect();
