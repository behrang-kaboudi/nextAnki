import "server-only";

import { NextResponse } from "next/server";

import { WORD_AUDIO_FIELDS, type WordAudioFieldKey } from "@/lib/audio/wordAudioFields";
import { getEnglishWordAudioPublicPath } from "@/lib/audio/englishWordAudioNaming";
import { generateEnglishWordAudio } from "@/lib/english/englishWordAudio.server";
import { getSentenceAudioPublicPath, isSentenceAudioField } from "@/lib/audio/sentenceAudioNaming";
import { generateSentenceAudio } from "@/lib/sentences/sentenceAudio.server";
import { getWordConceptAudioPublicPath, isWordConceptAudioField } from "@/lib/audio/wordConceptAudioNaming";
import { generateWordConceptAudio } from "@/lib/words/wordConceptAudio.server";

export const runtime = "nodejs";

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function asPositiveIntString(value: string): number | null {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const i = Math.floor(n);
  return i > 0 && String(i) === value ? i : null;
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as
    | { audioKey?: unknown; field?: unknown; text?: unknown }
    | null;

  const audioKey = asNonEmptyString(body?.audioKey);
  const fieldRaw = body?.field;
  const text = asNonEmptyString(body?.text);

  if (!audioKey) {
    return NextResponse.json({ ok: false, error: "Invalid audioKey" }, { status: 400 });
  }
  if (typeof fieldRaw !== "string" || !WORD_AUDIO_FIELDS.includes(fieldRaw as WordAudioFieldKey)) {
    return NextResponse.json(
      { ok: false, error: `Invalid field. Allowed: ${WORD_AUDIO_FIELDS.join(", ")}` },
      { status: 400 }
    );
  }
  if (!text) {
    return NextResponse.json({ ok: false, error: "No text provided" }, { status: 400 });
  }

  const field: WordAudioFieldKey = fieldRaw as WordAudioFieldKey;

  if (field === "base_form") {
    const englishWordId = asPositiveIntString(audioKey);
    if (!englishWordId) return NextResponse.json({ ok: false, error: "Invalid EnglishWord id" }, { status: 400 });
    try {
      const result = await generateEnglishWordAudio(englishWordId, text);
      return NextResponse.json({
        ok: true,
        filename: result.filename,
        publicPath: result.filename ? getEnglishWordAudioPublicPath(result.filename) : null,
        size: result.size,
      });
    } catch (e) {
      return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
    }
  }

  if (isSentenceAudioField(field)) {
    const sentenceId = asPositiveIntString(audioKey);
    if (!sentenceId) return NextResponse.json({ ok: false, error: "Invalid Sentence id" }, { status: 400 });
    try {
      const result = await generateSentenceAudio(sentenceId, field, text);
      return NextResponse.json({
        ok: true,
        filename: result.filename,
        publicPath: getSentenceAudioPublicPath(result.filename),
        size: result.size,
      });
    } catch (e) {
      return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
    }
  }

  if (isWordConceptAudioField(field)) {
    const wordId = asPositiveIntString(audioKey);
    if (!wordId) return NextResponse.json({ ok: false, error: "Invalid Word id" }, { status: 400 });
    try {
      const result = await generateWordConceptAudio(wordId, text);
      return NextResponse.json({
        ok: true,
        filename: result.filename,
        publicPath: result.filename ? getWordConceptAudioPublicPath(result.filename) : null,
        size: result.size,
      });
    } catch (e) {
      return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: false, error: "Unsupported field" }, { status: 400 });
}
