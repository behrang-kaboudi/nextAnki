import { NextResponse } from "next/server";

import {
  applyWordMeaningComparison,
  parseMeaningComparisonOutput,
} from "@/lib/words/wordMeaningComparison.server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const persianWordId = body?.persianWordId;
  const sourceWordIds = body?.sourceWordIds;
  if (typeof persianWordId !== "number" || !Number.isSafeInteger(persianWordId) || persianWordId <= 0 ||
      !Array.isArray(sourceWordIds) || sourceWordIds.length < 2 || sourceWordIds.some((id) =>
        typeof id !== "number" || !Number.isSafeInteger(id) || id <= 0,
      )) {
    return NextResponse.json({ ok: false, error: "A valid candidate group is required." }, { status: 400 });
  }
  try {
    const groups = parseMeaningComparisonOutput(body?.output);
    if (groups.length !== 1) throw new Error("Confirm exactly one candidate group at a time.");
    const result = await applyWordMeaningComparison(persianWordId, sourceWordIds as number[], groups[0]);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 400 },
    );
  }
}
