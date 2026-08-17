import { NextResponse } from "next/server";

import { prepareWordSenseConceptMerge } from "@/lib/words/wordSenseConceptMerge.server";
import { parsePromptBatchSize } from "@/lib/words/promptBatch";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const batchSize = parsePromptBatchSize(body?.batchSize ?? body?.limit, 50);
  if (batchSize === null) {
    return NextResponse.json(
      { ok: false, error: "Invalid batch size." },
      { status: 400 },
    );
  }
  try {
    return NextResponse.json({ ok: true, ...(await prepareWordSenseConceptMerge(batchSize)) });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
