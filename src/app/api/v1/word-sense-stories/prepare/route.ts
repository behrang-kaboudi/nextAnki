import "server-only";

import { NextResponse } from "next/server";

import { prepareWordSenseStoryBatch } from "@/lib/words/wordSenseStory.server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as { limit?: unknown; wordSenseIds?: unknown } | null;
    const limit = typeof body?.limit === "number" && Number.isSafeInteger(body.limit) && body.limit > 0 ? body.limit : 20;
    const wordSenseIds = Array.isArray(body?.wordSenseIds) && body.wordSenseIds.every((id) => typeof id === "number" && Number.isSafeInteger(id) && id > 0)
      ? body.wordSenseIds as number[]
      : undefined;
    if (body?.wordSenseIds !== undefined && !wordSenseIds) {
      return NextResponse.json({ ok: false, error: "wordSenseIds must be an array of positive integers." }, { status: 400 });
    }
    const prepared = await prepareWordSenseStoryBatch(limit, wordSenseIds);
    return NextResponse.json({ ok: true, ...prepared });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
