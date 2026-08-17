import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import { normalizePersianFull } from "@/lib/persian/normalize";
import { prisma } from "@/lib/prisma";
import type { MeaningReviewCorrection } from "@/lib/words/meaningReviewFinalization";
import type { MeaningReviewPromptRecord } from "@/lib/words/meaningReviewWorkflow.server";

const REPORT_DIRECTORY = path.join(process.cwd(), "backups", "meaning-review-normalization-conflicts");

export type MeaningReviewNormalizationConflict = {
  inputText: string;
  normalizedText: string;
  matches: Array<{
    id: number;
    canonical_text: string;
    normalized_text: string;
    meaning_fa_IPA: string | null;
  }>;
};

export type MeaningReviewConflictItem = {
  wordSenseId: number;
  reason: "PersianWordNormalizationConflictError";
  currentRecord: MeaningReviewPromptRecord;
  proposedResult: MeaningReviewCorrection;
  conflicts: MeaningReviewNormalizationConflict[];
  databaseAction: "move_to_needs_action";
};

export type MeaningReviewConflictReport = {
  schemaVersion: 2;
  reportId: string;
  requestKey: string;
  status: "prepared" | "completed" | "database_rolled_back";
  preparedAt: string;
  completedAt: string | null;
  databaseError: string | null;
  needsActionWordSenseIds: number[];
  items: MeaningReviewConflictItem[];
};

function sameArray<T>(left: readonly T[], right: readonly T[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

async function findConflict(inputText: string): Promise<MeaningReviewNormalizationConflict | null> {
  const normalizedText = normalizePersianFull(inputText);
  if (!normalizedText) return null;
  const matches = await prisma.persianWord.findMany({
    where: { normalized_text: normalizedText },
    orderBy: { id: "asc" },
    select: {
      id: true,
      canonical_text: true,
      normalized_text: true,
      meaning_fa_IPA: true,
    },
  });
  return matches.length > 1 ? { inputText, normalizedText, matches } : null;
}

export async function findMeaningReviewNormalizationConflicts(args: {
  records: readonly MeaningReviewPromptRecord[];
  results: readonly MeaningReviewCorrection[];
}) {
  const resultsById = new Map(args.results.map((result) => [result.id, result]));
  const items: MeaningReviewConflictItem[] = [];
  for (const record of args.records) {
    const result = resultsById.get(record.id);
    if (!result || result.invalid_primary_meaning) continue;
    const candidateTexts: string[] = [];
    if (result.meaning_fa && result.meaning_fa !== record.meaning_fa) {
      candidateTexts.push(result.meaning_fa);
    }
    if (
      result.other_meanings_fa &&
      !sameArray(result.other_meanings_fa, record.other_meanings_fa ?? [])
    ) {
      candidateTexts.push(...result.other_meanings_fa);
    }
    const conflicts = (
      await Promise.all([...new Set(candidateTexts)].map(findConflict))
    ).filter((conflict): conflict is MeaningReviewNormalizationConflict => conflict !== null);
    if (conflicts.length) {
      items.push({
        wordSenseId: record.id,
        reason: "PersianWordNormalizationConflictError",
        currentRecord: record,
        proposedResult: result,
        conflicts,
        databaseAction: "move_to_needs_action",
      });
    }
  }
  return items;
}

async function writeReportFile(filePath: string, report: MeaningReviewConflictReport) {
  await mkdir(REPORT_DIRECTORY, { recursive: true });
  const temporaryPath = `${filePath}.${randomUUID()}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await rename(temporaryPath, filePath);
}

export async function prepareMeaningReviewConflictReport(
  requestKey: string,
  items: MeaningReviewConflictItem[],
) {
  const preparedAt = new Date().toISOString();
  const reportId = `${preparedAt.replace(/[:.]/g, "-")}-${randomUUID()}`;
  const filePath = path.join(REPORT_DIRECTORY, `${reportId}.json`);
  const report: MeaningReviewConflictReport = {
    schemaVersion: 2,
    reportId,
    requestKey,
    status: "prepared",
    preparedAt,
    completedAt: null,
    databaseError: null,
    needsActionWordSenseIds: [],
    items,
  };
  await writeReportFile(filePath, report);
  return { filePath, report };
}

export async function finalizeMeaningReviewConflictReport(args: {
  filePath: string;
  report: MeaningReviewConflictReport;
  status: "completed" | "database_rolled_back";
  needsActionWordSenseIds?: number[];
  databaseError?: string;
}) {
  const report: MeaningReviewConflictReport = {
    ...args.report,
    status: args.status,
    completedAt: new Date().toISOString(),
    databaseError: args.databaseError ?? null,
    needsActionWordSenseIds: args.needsActionWordSenseIds ?? [],
  };
  await writeReportFile(args.filePath, report);
  return report;
}

export async function listMeaningReviewConflictReports() {
  let names: string[];
  try {
    names = await readdir(REPORT_DIRECTORY);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
  const reports = await Promise.all(
    names.filter((name) => name.endsWith(".json")).map(async (name) => {
      const raw = await readFile(path.join(REPORT_DIRECTORY, name), "utf8");
      return JSON.parse(raw) as MeaningReviewConflictReport;
    }),
  );
  return reports.sort((left, right) => right.preparedAt.localeCompare(left.preparedAt));
}
