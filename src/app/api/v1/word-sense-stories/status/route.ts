import "server-only";

import { NextResponse } from "next/server";

import { getWordSenseStorySummary } from "@/lib/words/wordSenseStory.server";

export const runtime = "nodejs";

export async function GET() {
  try {
    return NextResponse.json({ ok: true, ...(await getWordSenseStorySummary()) });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
