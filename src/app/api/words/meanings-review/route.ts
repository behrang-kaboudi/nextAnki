import { NextResponse } from "next/server";

import {
  isMeaningReviewEligible,
  loadMeaningReviewPromptRecords,
  summarizeMeaningReviewEligibility,
} from "@/lib/words/meaningReviewWorkflow.server";
import { parsePromptBatchSize, selectPromptBatch } from "@/lib/words/promptBatch";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const batchSize = parsePromptBatchSize(
    Number(params.get("batchSize") ?? params.get("limit") ?? "50"),
    50,
  );
  if (batchSize === null) {
    return NextResponse.json({ ok: false, error: "Invalid batch size." }, { status: 400 });
  }
  const allRecords = await loadMeaningReviewPromptRecords();
  const summary = summarizeMeaningReviewEligibility(allRecords);
  const eligible = allRecords.filter(isMeaningReviewEligible);
  const items = selectPromptBatch(eligible, batchSize);
  return NextResponse.json({
    ok: true,
    totalEligible: summary.totalEligible,
    totalUnconfirmed: summary.pendingReview,
    summary,
    items,
  });
}
