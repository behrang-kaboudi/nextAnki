import { NextResponse } from "next/server";

import {
  parseManualConceptMergeEntries,
  prepareManualWordSenseConceptMerge,
} from "@/lib/words/wordSenseConceptMerge.server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  try {
    const entries = parseManualConceptMergeEntries(body?.entries);
    return NextResponse.json({
      ok: true,
      ...(await prepareManualWordSenseConceptMerge(entries)),
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 400 },
    );
  }
}
