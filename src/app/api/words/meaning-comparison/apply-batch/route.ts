import { NextResponse } from "next/server";

import {
  applyWordSenseMeaningComparisonBatch,
  parseMeaningComparisonOutput,
  type MeaningComparisonSourceGroup,
} from "@/lib/words/wordSenseMeaningComparison.server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  try {
    const output = parseMeaningComparisonOutput(body?.output);
    if (!Array.isArray(body?.sourceGroups)) {
      throw new Error("Source candidate groups are required.");
    }
    const result = await applyWordSenseMeaningComparisonBatch(
      body.sourceGroups as MeaningComparisonSourceGroup[],
      output,
    );
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 400 },
    );
  }
}
