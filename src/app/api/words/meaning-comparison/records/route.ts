import { NextResponse } from "next/server";

import {
  loadWordSenseMeaningComparisonGroups,
  parseMeaningComparisonOutput,
} from "@/lib/words/wordSenseMeaningComparison.server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  try {
    const output = parseMeaningComparisonOutput(body?.output);
    return NextResponse.json({
      ok: true,
      ...(await loadWordSenseMeaningComparisonGroups(output)),
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 400 },
    );
  }
}
