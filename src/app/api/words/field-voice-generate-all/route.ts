import "server-only";

import { NextResponse } from "next/server";
import { WORD_AUDIO_BATCH_FIELDS, type WordAudioBatchFieldKey } from "@/lib/audio/wordAudioFields";
import {
  getWordFieldVoiceJobStatus,
  startWordFieldVoiceJobIfNeeded,
} from "@/lib/words/wordSenseFieldVoiceGenerateJob";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as { field?: unknown } | null;
    const field = body?.field;
    if (typeof field !== "string" || !WORD_AUDIO_BATCH_FIELDS.includes(field as WordAudioBatchFieldKey)) {
      return NextResponse.json(
        { ok: false, error: `Invalid field. Allowed: ${WORD_AUDIO_BATCH_FIELDS.join(", ")}` },
        { status: 400 }
      );
    }

    const status = startWordFieldVoiceJobIfNeeded(field as WordAudioBatchFieldKey);
    return NextResponse.json({ ok: true, status });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const field = searchParams.get("field");
    if (typeof field !== "string" || !WORD_AUDIO_BATCH_FIELDS.includes(field as WordAudioBatchFieldKey)) {
      return NextResponse.json(
        { ok: false, error: `Invalid field. Allowed: ${WORD_AUDIO_BATCH_FIELDS.join(", ")}` },
        { status: 400 }
      );
    }

    return NextResponse.json({ ok: true, status: getWordFieldVoiceJobStatus(field as WordAudioBatchFieldKey) });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
