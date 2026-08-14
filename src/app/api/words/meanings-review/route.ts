import { NextResponse } from "next/server";

import {
  isMeaningReviewEligible,
  loadMeaningReviewPromptRecords,
  summarizeMeaningReviewEligibility,
} from "@/lib/words/meaningReviewWorkflow.server";
import { parseParallelPromptPartition, selectParallelPromptLane } from "@/lib/words/parallelPromptPartition";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const partition = parseParallelPromptPartition({
    laneCount: Number(params.get("laneCount") ?? "1"),
    laneNumber: Number(params.get("laneNumber") ?? "1"),
    batchSize: Number(params.get("batchSize") ?? params.get("limit") ?? "50"),
  }, 50);
  if (!partition) {
    return NextResponse.json({ ok: false, error: "Invalid parallel lane or batch size." }, { status: 400 });
  }
  const allRecords = await loadMeaningReviewPromptRecords();
  const summary = summarizeMeaningReviewEligibility(allRecords);
  const eligible = allRecords.filter(isMeaningReviewEligible);
  const { items, laneEligibleCount } = selectParallelPromptLane(
    eligible,
    (record) => record.id,
    partition,
  );
  return NextResponse.json({
    ok: true,
    totalEligible: summary.totalEligible,
    totalUnconfirmed: summary.pendingReview,
    summary,
    laneEligibleCount,
    items,
  });
}
