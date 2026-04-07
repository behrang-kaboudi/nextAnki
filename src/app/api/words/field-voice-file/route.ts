import "server-only";

import { NextResponse } from "next/server";

import { WORD_AUDIO_FIELDS } from "@/lib/audio/wordFieldAudioNaming";
import { getLatestWordFieldAudioFile, getWordFieldAudioPublicPathFromFilename } from "@/lib/words/wordFieldVoice";

export const runtime = "nodejs";

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const audioKey = asNonEmptyString(searchParams.get("audioKey"));
  const field = searchParams.get("field");

  if (!audioKey) {
    return NextResponse.json({ ok: false, error: "Invalid audioKey" }, { status: 400 });
  }
  if (typeof field !== "string" || !WORD_AUDIO_FIELDS.includes(field as never)) {
    return NextResponse.json(
      { ok: false, error: `Invalid field. Allowed: ${WORD_AUDIO_FIELDS.join(", ")}` },
      { status: 400 }
    );
  }

  const latest = getLatestWordFieldAudioFile({ audioKey, ankiLinkId: audioKey, field: field as never });
  const filename = latest?.filename ?? null;
  const size = latest?.size ?? 0;
  const publicPath = filename ? getWordFieldAudioPublicPathFromFilename(filename) : null;

  return NextResponse.json({ ok: true, filename, publicPath, size });
}
