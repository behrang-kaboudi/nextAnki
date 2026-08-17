import { NextResponse } from "next/server";

import {
  applyWordSenseSplitRepairBatch,
  parseWordSenseSplitRepairRequest,
} from "@/lib/words/wordSenseSplitRepair.server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = parseWordSenseSplitRepairRequest(await request.json().catch(() => null));
  if (!body) {
    return NextResponse.json({
      ok: false,
      atomic: true,
      rolledBack: true,
      error: "Invalid WordSense split-repair batch payload.",
    }, { status: 400 });
  }
  try {
    return NextResponse.json(await applyWordSenseSplitRepairBatch(body));
  } catch (error) {
    return NextResponse.json({
      ok: false,
      atomic: true,
      rolledBack: true,
      batchId: body.batchId,
      error: error instanceof Error ? error.message : String(error),
    }, { status: 409 });
  }
}
