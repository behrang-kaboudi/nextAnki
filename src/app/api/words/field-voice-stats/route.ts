import "server-only";

import { NextResponse } from "next/server";

import { WORD_AUDIO_BATCH_FIELDS, type WordAudioBatchFieldKey } from "@/lib/audio/wordAudioFields";
import { audioNeedsGeneration } from "@/lib/audio/audioSourceText";
import { isSentenceAudioField } from "@/lib/audio/sentenceAudioNaming";
import { isWordConceptAudioField } from "@/lib/audio/wordConceptAudioNaming";
import { getEnglishWordAudioFileInfo } from "@/lib/english/englishWordAudio.server";
import { prisma } from "@/lib/prisma";
import { getPersianWordAudioFileInfo } from "@/lib/persian/persianWordAudio.server";
import { getSentenceAudioFileInfo } from "@/lib/sentences/sentenceAudio.server";
import { getWordConceptAudioFileInfo } from "@/lib/words/wordConceptAudio.server";

export const runtime = "nodejs";

function summarize(
  field: WordAudioBatchFieldKey,
  rows: Array<{ text: string | null; sourceText: string | null; size: number }>,
) {
  const totalWords = rows.length;
  let eligibleWords = 0;
  let noTextWords = 0;
  let withAudioWords = 0;
  let currentAudioWords = 0;
  let staleAudioWords = 0;
  for (const row of rows) {
    if (!row.text?.trim()) {
      noTextWords += 1;
      continue;
    }
    eligibleWords += 1;
    if (row.size > 0) withAudioWords += 1;
    if (!audioNeedsGeneration({ text: row.text, sourceText: row.sourceText, fileSize: row.size })) {
      currentAudioWords += 1;
    } else if (row.size > 0) {
      staleAudioWords += 1;
    }
  }
  const missingAudioWords = eligibleWords - currentAudioWords;
  return {
    ok: true,
    field,
    totalWords,
    eligibleWords,
    withAudioWords,
    currentAudioWords,
    staleAudioWords,
    missingAudioWords,
    noTextWords,
    missingOfTotalRatio: totalWords ? missingAudioWords / totalWords : 0,
    missingOfEligibleRatio: eligibleWords ? missingAudioWords / eligibleWords : 0,
  };
}

export async function GET(req: Request) {
  const fieldRaw = new URL(req.url).searchParams.get("field");
  const field = fieldRaw && WORD_AUDIO_BATCH_FIELDS.includes(fieldRaw as WordAudioBatchFieldKey)
    ? fieldRaw as WordAudioBatchFieldKey
    : null;
  if (!field) {
    return NextResponse.json(
      { ok: false, error: `Invalid field. Allowed: ${WORD_AUDIO_BATCH_FIELDS.join(", ")}` },
      { status: 400 },
    );
  }

  let rows: Array<{ text: string | null; sourceText: string | null; size: number }>;
  if (field === "base_form") {
    rows = (await prisma.englishWord.findMany({ select: { base_form: true, audio_file_name: true, audio_source_text: true } }))
      .map((row) => ({ text: row.base_form, sourceText: row.audio_source_text, size: getEnglishWordAudioFileInfo(row.audio_file_name).size }));
  } else if (field === "canonical_text") {
    rows = (await prisma.persianWord.findMany({ select: { canonical_text: true, audio_file_name: true, audio_source_text: true } }))
      .map((row) => ({ text: row.canonical_text, sourceText: row.audio_source_text, size: getPersianWordAudioFileInfo(row.audio_file_name).size }));
  } else if (isWordConceptAudioField(field)) {
    rows = (await prisma.word.findMany({ select: { concept_explained_fa: true, concept_explained_fa_audio_file_name: true, concept_explained_fa_audio_source_text: true } }))
      .map((row) => ({ text: row.concept_explained_fa, sourceText: row.concept_explained_fa_audio_source_text, size: getWordConceptAudioFileInfo(row.concept_explained_fa_audio_file_name).size }));
  } else if (isSentenceAudioField(field)) {
    rows = (await prisma.sentence.findMany({
      select: {
        sentence_en: true,
        sentence_en_meaning_fa: true,
        sentence_en_audio_file_name: true,
        sentence_en_audio_source_text: true,
        sentence_en_meaning_fa_audio_file_name: true,
        sentence_en_meaning_fa_audio_source_text: true,
      },
    })).map((row) => ({
      text: field === "sentence_en" ? row.sentence_en : row.sentence_en_meaning_fa,
      sourceText: field === "sentence_en"
        ? row.sentence_en_audio_source_text
        : row.sentence_en_meaning_fa_audio_source_text,
      size: getSentenceAudioFileInfo(
        field === "sentence_en" ? row.sentence_en_audio_file_name : row.sentence_en_meaning_fa_audio_file_name,
      ).size,
    }));
  } else {
    rows = [];
  }

  return NextResponse.json(summarize(field, rows), { headers: { "Cache-Control": "no-store" } });
}
