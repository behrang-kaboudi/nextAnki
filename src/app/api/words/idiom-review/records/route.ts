import "server-only";

import { NextResponse } from "next/server";

import { rebuildWordSenseIdiomReview } from "@/lib/words/wordSenseIdiomReview.server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  try {
    return NextResponse.json({
      ok: true,
      ...(await rebuildWordSenseIdiomReview(body?.decisions)),
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 400 },
    );
  }
}
