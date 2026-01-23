import "server-only";

import { NextResponse } from "next/server";

import { getLatestHintSentenceAudioFileForId } from "@/lib/words/hintSentenceVoice";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const wordIdRaw = searchParams.get("wordId");
  const wordId = Number(wordIdRaw);

  if (!Number.isFinite(wordId) || wordId <= 0) {
    return NextResponse.json({ ok: false, error: "Invalid wordId" }, { status: 400 });
  }

  const latest = getLatestHintSentenceAudioFileForId(Math.trunc(wordId));
  const filename = latest?.filename ?? null;
  const publicPath = filename ? `/audio/${encodeURIComponent(filename)}` : null;
  return NextResponse.json({ ok: true, filename, publicPath });
}

