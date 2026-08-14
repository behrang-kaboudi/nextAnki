import { NextResponse } from "next/server";

import { prepareWordSenseMeaningComparison } from "@/lib/words/wordSenseMeaningComparison.server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { limit?: unknown } | null;
  const limit = body?.limit;
  if (typeof limit !== "number" || !Number.isSafeInteger(limit) || limit < 0) {
    return NextResponse.json({ ok: false, error: "limit must be a non-negative integer." }, { status: 400 });
  }
  try {
    return NextResponse.json({ ok: true, ...(await prepareWordSenseMeaningComparison(limit)) });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
