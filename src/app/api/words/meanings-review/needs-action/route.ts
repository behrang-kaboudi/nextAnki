import { MeaningReviewStatus } from "@prisma/client";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { meaningReviewNeedsActionWhere } from "@/lib/words/meaningReviewStatus";
import { listMeaningReviewConflictReports } from "@/lib/words/meaningReviewConflictReport.server";
import { loadMeaningReviewPromptRecords } from "@/lib/words/meaningReviewWorkflow.server";

export const runtime = "nodejs";

export async function GET() {
  const items = await prisma.wordSense.findMany({
    where: meaningReviewNeedsActionWhere,
    orderBy: { id: "asc" },
    select: {
      id: true,
      meaningReviewStatus: true,
      pos: true,
      concept_explained_fa: true,
      english: { select: { base_form: true } },
      meaning: { select: { canonical_text: true } },
    },
  });
  const counts = Object.fromEntries(
    Object.values(MeaningReviewStatus)
      .filter((status) => status.startsWith("NEEDS_ACTION_"))
      .map((status) => [status, items.filter((item) => item.meaningReviewStatus === status).length]),
  );
  const ids = items.map((item) => item.id);
  const [records, reports] = await Promise.all([
    loadMeaningReviewPromptRecords({ ids }),
    listMeaningReviewConflictReports(),
  ]);
  const conflictByWordSenseId = new Map<number, {
    reportId: string;
    preparedAt: string;
    proposedResult: unknown;
    conflicts: unknown;
  }>();
  for (const report of reports) {
    for (const conflict of report.items) {
      if (!ids.includes(conflict.wordSenseId) || conflictByWordSenseId.has(conflict.wordSenseId)) continue;
      conflictByWordSenseId.set(conflict.wordSenseId, {
        reportId: report.reportId,
        preparedAt: report.preparedAt,
        proposedResult: conflict.proposedResult,
        conflicts: conflict.conflicts,
      });
    }
  }
  const recordById = new Map(records.map((record) => [record.id, record]));
  const promptRecords = items.map((item) => ({
    ...recordById.get(item.id),
    attention_context: {
      stored_status: item.meaningReviewStatus,
      stored_trigger:
        item.meaningReviewStatus === MeaningReviewStatus.NEEDS_ACTION_INVALID_PRIMARY
          ? "The previous review response set invalid_primary_meaning=true; no detailed reason was persisted."
          : item.meaningReviewStatus === MeaningReviewStatus.NEEDS_ACTION_NORMALIZATION_CONFLICT
            ? "Applying the previous proposal found multiple PersianWord rows with the same normalized Persian text."
            : "The WordSense currently has no primary Persian meaning.",
      normalization_conflict: conflictByWordSenseId.get(item.id) ?? null,
    },
  }));
  return NextResponse.json({ ok: true, total: items.length, counts, items, promptRecords });
}
