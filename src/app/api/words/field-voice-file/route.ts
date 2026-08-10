import "server-only";

import { NextResponse } from "next/server";

import { WORD_AUDIO_FIELDS } from "@/lib/audio/wordAudioFields";
import { getEnglishWordAudioPublicPath } from "@/lib/audio/englishWordAudioNaming";
import { deleteEnglishWordAudio, findEnglishWordAudioRecord, getEnglishWordAudioFileInfo } from "@/lib/english/englishWordAudio.server";
import { getSentenceAudioPublicPath, isSentenceAudioField } from "@/lib/audio/sentenceAudioNaming";
import { deleteSentenceAudio, filenameFor, findSentenceAudioRecord, getSentenceAudioFileInfo, sourceTextFor } from "@/lib/sentences/sentenceAudio.server";
import { getWordConceptAudioPublicPath, isWordConceptAudioField } from "@/lib/audio/wordConceptAudioNaming";
import { deleteWordConceptAudio, findWordConceptAudioRecord, getWordConceptAudioFileInfo } from "@/lib/words/wordConceptAudio.server";

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
    if (info.size <= 0 && (filenameFor(row, field) || sourceTextFor(row, field))) {
      await deleteSentenceAudio(sentenceId, field);
      return NextResponse.json({ ok: true, filename: null, publicPath: null, size: 0 });
    }
    return NextResponse.json({
      ok: true,
      filename: info.filename,
      publicPath: info.filename ? getSentenceAudioPublicPath(info.filename) : null,
      size: info.size,
    });
  }

  if (field === "base_form") {
    const englishWordId = Number(audioKey);
    if (!Number.isSafeInteger(englishWordId) || englishWordId <= 0) {
      return NextResponse.json({ ok: false, error: "Invalid EnglishWord id" }, { status: 400 });
    }
    const row = await findEnglishWordAudioRecord(englishWordId);
    if (!row) return NextResponse.json({ ok: false, error: "EnglishWord not found" }, { status: 404 });
    const info = getEnglishWordAudioFileInfo(row.audio_file_name);
    if (info.size <= 0 && (row.audio_file_name || row.audio_source_text)) {
      await deleteEnglishWordAudio(englishWordId);
      return NextResponse.json({ ok: true, filename: null, publicPath: null, size: 0 });
    }
    return NextResponse.json({
      ok: true,
      filename: info.filename,
      publicPath: info.filename ? getEnglishWordAudioPublicPath(info.filename) : null,
      size: info.size,
    });
  }

  if (isWordConceptAudioField(field)) {
    const wordId = Number(audioKey);
    if (!Number.isSafeInteger(wordId) || wordId <= 0) {
      return NextResponse.json({ ok: false, error: "Invalid Word id" }, { status: 400 });
    }
    const row = await findWordConceptAudioRecord(wordId);
    if (!row) return NextResponse.json({ ok: false, error: "Word not found" }, { status: 404 });
    const info = getWordConceptAudioFileInfo(row.concept_explained_fa_audio_file_name);
    if (info.size <= 0 && (row.concept_explained_fa_audio_file_name || row.concept_explained_fa_audio_source_text)) {
      await deleteWordConceptAudio(wordId);
      return NextResponse.json({ ok: true, filename: null, publicPath: null, size: 0 });
    }
    return NextResponse.json({
      ok: true,
      filename: info.filename,
      publicPath: info.filename ? getWordConceptAudioPublicPath(info.filename) : null,
      size: info.size,
    });
  }

  return NextResponse.json({ ok: false, error: "Unsupported field" }, { status: 400 });
}
