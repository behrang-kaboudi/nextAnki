import { NextResponse } from "next/server";

import { listMeaningReviewConflictReports } from "@/lib/words/meaningReviewConflictReport.server";

export const runtime = "nodejs";

export async function GET() {
  try {
    const reports = await listMeaningReviewConflictReports();
    return NextResponse.json({ ok: true, reports });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
