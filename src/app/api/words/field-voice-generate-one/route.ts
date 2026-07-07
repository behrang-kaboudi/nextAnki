import "server-only";

import { NextResponse } from "next/server";

import path from "node:path";
import fs from "node:fs";

import {
  WORD_AUDIO_FIELDS,
  buildWordFieldAudioFilename,
  getWordFieldAudioPublicPath,
  type WordAudioFieldKey,
} from "@/lib/audio/wordFieldAudioNaming";
import { generateSpeechFromMixedText } from "@/lib/tts/cloudTts";
import { getWordFieldAudioAbsolutePath } from "@/lib/audio/wordFieldAudioPaths.server";
import { touchSentenceById } from "@/lib/sentences/sentenceRepo";
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

async function touchWordsForAudioChange(audioKey: string, field: WordAudioFieldKey) {
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
  const filename = buildWordFieldAudioFilename({ audioKey, field, timestampMs: Date.now() });
  const outputFileUnderPublicAudio = path.join("words", filename);

  try {
    await generateSpeechFromMixedText(text, outputFileUnderPublicAudio, "azure");
    let size = 0;
    try {
      size = fs.statSync(getWordFieldAudioAbsolutePath(filename)).size;
    } catch {
      size = 0;
    }
    await touchWordsForAudioChange(audioKey, field);
    return NextResponse.json({
      ok: true,
      filename,
      publicPath: getWordFieldAudioPublicPath(filename),
      size,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
