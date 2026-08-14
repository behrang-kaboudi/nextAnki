import "server-only";

import { NextResponse } from "next/server";

import { WORD_AUDIO_FIELDS } from "@/lib/audio/wordAudioFields";
import { deleteEnglishWordAudio } from "@/lib/english/englishWordAudio.server";
import { isSentenceAudioField } from "@/lib/audio/sentenceAudioNaming";
import { deleteSentenceAudio } from "@/lib/sentences/sentenceAudio.server";
import { isWordSenseConceptAudioField } from "@/lib/audio/wordSenseConceptAudioNaming";
import { deleteWordSenseConceptAudio } from "@/lib/words/wordSenseConceptAudio.server";

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
    | { audioKey?: unknown; field?: unknown }
    | null;

  const audioKey = asNonEmptyString(body?.audioKey);
  const field = body?.field;

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
    const sentenceId = asPositiveIntString(audioKey);
    if (!sentenceId) return NextResponse.json({ ok: false, error: "Invalid Sentence id" }, { status: 400 });
    try {
      const result = await deleteSentenceAudio(sentenceId, field);
      return NextResponse.json({ ok: true, ...result, deletedBytes: 0 });
    } catch (e) {
      return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
    }
  }

  if (field === "base_form") {
    const englishWordId = asPositiveIntString(audioKey);
    if (!englishWordId) return NextResponse.json({ ok: false, error: "Invalid EnglishWord id" }, { status: 400 });
    try {
      return NextResponse.json({ ok: true, ...(await deleteEnglishWordAudio(englishWordId)) });
    } catch (e) {
      return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
    }
  }

  if (isWordSenseConceptAudioField(field)) {
    const wordId = asPositiveIntString(audioKey);
    if (!wordId) return NextResponse.json({ ok: false, error: "Invalid WordSense id" }, { status: 400 });
    try {
      return NextResponse.json({ ok: true, ...(await deleteWordSenseConceptAudio(wordId)) });
    } catch (e) {
      return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: false, error: "Unsupported field" }, { status: 400 });
}
