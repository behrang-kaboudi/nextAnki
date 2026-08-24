import "server-only";

import { NextResponse } from "next/server";

import { previewWordSenseStories } from "@/lib/words/wordSenseStory.server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as { requests?: unknown; items?: unknown } | null;
    const preview = await previewWordSenseStories(body?.requests, body?.items);
    return NextResponse.json({ ok: true, items: preview.items, omittedWordSenseIds: preview.omittedWordSenseIds });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 400 });
  }
}
