import "server-only";

import { NextResponse } from "next/server";

import { WORD_AUDIO_FIELDS } from "@/lib/audio/wordFieldAudioNaming";
import { touchSentenceById } from "@/lib/sentences/sentenceRepo";
import { deleteAllWordFieldAudioFiles } from "@/lib/words/wordFieldVoice";
import { touchWordByAnkiLinkId, touchWordsLinkedToSentenceId } from "@/lib/words/wordRepo";

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

async function touchWordsForAudioChange(audioKey: string, field: string) {
  if (field === "sentence_en" || field === "sentence_en_meaning_fa") {
    const sentenceId = asPositiveIntString(audioKey);
    if (sentenceId) {
      await touchSentenceById(sentenceId);
      await touchWordsLinkedToSentenceId(sentenceId);
    }
    return;
  }
  await touchWordByAnkiLinkId(audioKey);
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

  const res = await deleteAllWordFieldAudioFiles({ audioKey, ankiLinkId: audioKey, field: field as never });
  await touchWordsForAudioChange(audioKey, field);
  return NextResponse.json({ ok: true, ...res });
}
