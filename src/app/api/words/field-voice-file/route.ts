import "server-only";

import { NextResponse } from "next/server";

import { WORD_AUDIO_FIELDS } from "@/lib/audio/wordFieldAudioNaming";
import { getLatestWordFieldAudioFile, getWordFieldAudioPublicPathFromFilename } from "@/lib/words/wordFieldVoice";
import { getSentenceAudioPublicPath, isSentenceAudioField } from "@/lib/audio/sentenceAudioNaming";
import { filenameFor, findSentenceAudioRecord, getSentenceAudioFileInfo } from "@/lib/sentences/sentenceAudio.server";

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

  if (isSentenceAudioField(field)) {
    const sentenceId = Number(audioKey);
    if (!Number.isSafeInteger(sentenceId) || sentenceId <= 0) {
      return NextResponse.json({ ok: false, error: "Invalid Sentence id" }, { status: 400 });
    }
    const row = await findSentenceAudioRecord(sentenceId);
    if (!row) return NextResponse.json({ ok: false, error: "Sentence not found" }, { status: 404 });
    const info = getSentenceAudioFileInfo(filenameFor(row, field));
    return NextResponse.json({
      ok: true,
      filename: info.filename,
      publicPath: info.filename ? getSentenceAudioPublicPath(info.filename) : null,
      size: info.size,
    });
  }

  const latest = getLatestWordFieldAudioFile({ audioKey, ankiLinkId: audioKey, field: field as never });
  const filename = latest?.filename ?? null;
  const size = latest?.size ?? 0;
  const publicPath = filename ? getWordFieldAudioPublicPathFromFilename(filename) : null;

  return NextResponse.json({ ok: true, filename, publicPath, size });
}
