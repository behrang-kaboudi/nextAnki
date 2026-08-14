import "server-only";

import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { hydrateWordsWithPrimarySentence } from "@/lib/words/primarySentences.server";

export const runtime = "nodejs";

function isBlank(v: unknown): boolean {
  return typeof v !== "string" || v.trim() === "";
}

export async function POST() {
  try {
    // 1) Validate required fields are present and non-empty.
    // Note: some fields are optional in the schema, but Finalize requires them.
    const rows = await prisma.wordSense.findMany({
      select: {
        id: true,
        sentenceIds: true,
        english: { select: { base_form: true, phonetic_us: true, phonetic_us_normalized: true } },
        meaning: { select: { canonical_text: true, meaning_fa_IPA: true, meaning_fa_IPA_normalize: true } },
        pos: true,
      },
      orderBy: { id: "asc" },
    });
    const hydratedRows = await hydrateWordsWithPrimarySentence(rows);
    const invalidRows = hydratedRows.filter((row) =>
      isBlank(row.english.base_form) ||
      isBlank(row.english.phonetic_us) ||
      isBlank(row.english.phonetic_us_normalized) ||
      isBlank(row.meaning?.canonical_text) ||
      isBlank(row.meaning?.meaning_fa_IPA) ||
      isBlank(row.meaning?.meaning_fa_IPA_normalize) ||
      isBlank(row.pos) ||
      isBlank(row.sentence?.sentence_en) ||
      isBlank(row.sentence?.sentence_en_meaning_fa)
    );
    const totalInvalid = invalidRows.length;

    if (totalInvalid > 0) {
      const sample = invalidRows.slice(0, 200).map((r) => {
        const sentence = r.sentence;
        const missing: string[] = [];
        if (isBlank(r.english.base_form)) missing.push("base_form");
        if (isBlank(r.english.phonetic_us)) missing.push("phonetic_us");
        if (isBlank(r.english.phonetic_us_normalized)) missing.push("phonetic_us_normalized");
        if (isBlank(r.meaning?.canonical_text)) missing.push("meaningId/canonical_text");
        if (isBlank(r.meaning?.meaning_fa_IPA)) missing.push("meaning_fa_IPA");
        if (isBlank(r.meaning?.meaning_fa_IPA_normalize)) missing.push("meaning_fa_IPA_normalize");
        if (isBlank(r.pos)) missing.push("pos");
        if (isBlank(sentence?.sentence_en)) missing.push("sentence_en");
        if (isBlank(sentence?.sentence_en_meaning_fa)) missing.push("sentence_en_meaning_fa");
        return { id: r.id, missing };
      });

      return NextResponse.json(
        {
          ok: false,
          phase: "validate",
          error: "Some WordSense rows are missing required fields",
          totalInvalid,
          sample,
        },
        { status: 400 },
      );
    }

    // 2) Validate anki_link_id is in the `${id}_${now}` format and matches the row id.
    const ankiRows = await prisma.wordSense.findMany({
      orderBy: { id: "asc" },
      select: { id: true, anki_link_id: true },
    });
    const invalidAnkiRows = ankiRows.filter((row) => {
      const match = /^(\d+)_(\d+)$/u.exec(row.anki_link_id);
      return !match || Number(match[1]) !== row.id;
    });
    const invalidAnkiCount = invalidAnkiRows.length;
    const invalidAnkiSample = invalidAnkiRows.slice(0, 200);
    if (invalidAnkiCount > 0) {
      return NextResponse.json(
        {
          ok: false,
          phase: "validate_anki_link_id",
          error: "Some WordSense rows have invalid anki_link_id (must be `${id}_${now}` and match the row id).",
          invalidAnkiCount,
          sample: invalidAnkiSample,
        },
        { status: 400 },
      );
    }

    return NextResponse.json({
      ok: true,
      phase: "finalize",
      validated: true,
      anki_link_id: { format: "id_now", ok: true },
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
