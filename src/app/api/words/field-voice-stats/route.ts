import "server-only";

import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { WORD_AUDIO_FIELDS, sanitizeWordAudioFilenamePart, type WordAudioFieldKey } from "@/lib/audio/wordFieldAudioNaming";
import { listWordFieldAudioIdsWithAnyNonZeroAudio } from "@/lib/words/wordFieldVoice";

export const runtime = "nodejs";

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const fieldRaw = asNonEmptyString(searchParams.get("field"));
  const field = fieldRaw && WORD_AUDIO_FIELDS.includes(fieldRaw as never) ? (fieldRaw as WordAudioFieldKey) : null;

  if (!field) {
    return NextResponse.json(
      { ok: false, error: `Invalid field. Allowed: ${WORD_AUDIO_FIELDS.join(", ")}` },
      { status: 400 }
    );
  }

  const [totalWords, wordRows] = await Promise.all([
    prisma.word.count(),
    (async () => {
      switch (field) {
        case "base_form": {
          const rows = await prisma.word.findMany({ select: { anki_link_id: true, english: { select: { base_form: true } } } });
          return rows.map((r) => ({ anki_link_id: r.anki_link_id, text: r.english.base_form }));
        }
        case "other_meanings_en": {
          const rows = await prisma.word.findMany({
            select: { anki_link_id: true, other_meanings_en: true },
          });
          return rows.map((r) => ({ anki_link_id: r.anki_link_id, text: r.other_meanings_en }));
        }
        case "concept_explained_fa": {
          const rows = await prisma.word.findMany({
            select: { anki_link_id: true, concept_explained_fa: true },
          });
          return rows.map((r) => ({ anki_link_id: r.anki_link_id, text: r.concept_explained_fa }));
        }
        case "sentence_en": {
          const rows = await prisma.sentence.findMany({ select: { id: true, sentence_en: true } });
          return rows.map((r) => ({ anki_link_id: String(r.id), text: r.sentence_en }));
        }
        case "sentence_en_meaning_fa": {
          const rows = await prisma.sentence.findMany({
            select: { id: true, sentence_en_meaning_fa: true },
          });
          return rows.map((r) => ({ anki_link_id: String(r.id), text: r.sentence_en_meaning_fa }));
        }
        default:
          return [];
      }
    })(),
  ]);

  const idsWithAudio = listWordFieldAudioIdsWithAnyNonZeroAudio(field);

  let eligibleWords = 0;
  let noTextWords = 0;
  let missingAudioWords = 0;

  for (const row of wordRows) {
    const text = String(row.text ?? "").trim();
    if (text.length === 0) {
      noTextWords += 1;
      continue;
    }
    eligibleWords += 1;
    if (!row.anki_link_id) continue;
    const id = sanitizeWordAudioFilenamePart(row.anki_link_id);
    if (!idsWithAudio.has(id)) missingAudioWords += 1;
  }

  const withAudioWords = Math.max(0, eligibleWords - missingAudioWords);

  return NextResponse.json(
    {
      ok: true,
      field,
      totalWords,
      eligibleWords,
      withAudioWords,
      missingAudioWords,
      noTextWords,
      missingOfTotalRatio: totalWords ? missingAudioWords / totalWords : 0,
      missingOfEligibleRatio: eligibleWords ? missingAudioWords / eligibleWords : 0,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
