import { NextResponse } from "next/server";
import { MeaningReviewStatus } from "@prisma/client";

import { loadMeaningReviewPromptRecords } from "@/lib/words/meaningReviewWorkflow.server";
import { updateManyWordSenses } from "@/lib/words/wordSenseRepo";

export const runtime = "nodejs";

export async function POST() {
  try {
    const records = await loadMeaningReviewPromptRecords();
    const ids = records.filter((record) =>
      record.meaning_fa &&
      record.review_status === MeaningReviewStatus.PENDING &&
      record.missing_fields.length === 0,
    ).map((record) => record.id);
    if (!ids.length) return NextResponse.json({ ok: true, updated: 0 });
    const result = await updateManyWordSenses({
      where: { id: { in: ids }, meaningReviewStatus: MeaningReviewStatus.PENDING },
      data: { meaningReviewStatus: MeaningReviewStatus.CONFIRMED },
    });
    return NextResponse.json({ ok: true, updated: result.count });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
