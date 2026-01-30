import "server-only";

import { NextResponse } from "next/server";
import { WORD_AUDIO_FIELDS } from "@/lib/audio/wordFieldAudioNaming";
import {
  getWordFieldVoiceJobStatus,
  startWordFieldVoiceJobIfNeeded,
} from "@/lib/words/wordFieldVoiceGenerateJob";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { field?: unknown } | null;
  const field = body?.field;
  if (typeof field !== "string" || !WORD_AUDIO_FIELDS.includes(field as never)) {
    return NextResponse.json(
      { ok: false, error: `Invalid field. Allowed: ${WORD_AUDIO_FIELDS.join(", ")}` },
      { status: 400 }
    );
  }

  const status = startWordFieldVoiceJobIfNeeded(field as never);
  return NextResponse.json({ ok: true, status });
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const field = searchParams.get("field");
  if (typeof field !== "string" || !WORD_AUDIO_FIELDS.includes(field as never)) {
    return NextResponse.json(
      { ok: false, error: `Invalid field. Allowed: ${WORD_AUDIO_FIELDS.join(", ")}` },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true, status: getWordFieldVoiceJobStatus(field as never) });
}
