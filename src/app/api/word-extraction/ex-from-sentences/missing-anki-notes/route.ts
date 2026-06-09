import "server-only";

import { NextResponse } from "next/server";

import { listSentencesMissingAnkiSentenceNotes } from "@/lib/word-extraction/sentencePromptData";

export const runtime = "nodejs";

function parseLimit(value: string | null, fallback: number) {
  const n = value ? Number(value) : Number.NaN;
  if (!Number.isFinite(n)) return fallback;
  const i = Math.floor(n);
  if (i <= 0) return fallback;
  return Math.min(i, 500);
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const limit = parseLimit(url.searchParams.get("limit"), 20);
    const result = await listSentencesMissingAnkiSentenceNotes(limit);

    return NextResponse.json({
      ok: true,
      limit,
      fetched: result.items.length,
      ...result,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
