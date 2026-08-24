import "server-only";

import { NextResponse } from "next/server";

import { applyWordSenseStories } from "@/lib/words/wordSenseStory.server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as { requests?: unknown; items?: unknown; confirmed?: unknown } | null;
    if (body?.confirmed !== true) return NextResponse.json({ ok: false, error: "Human confirmation is required." }, { status: 400 });
    const result = await applyWordSenseStories(body?.requests, body?.items);
    return NextResponse.json({ ok: true, ...result, createdCount: result.created.length });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 400 });
  }
}
