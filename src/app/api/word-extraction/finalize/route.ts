import "server-only";

import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function isBlank(v: unknown): boolean {
  return typeof v !== "string" || v.trim() === "";
}

export async function POST() {
  try {
    // 1) Validate required fields are present and non-empty.
    // Note: some fields are optional in the schema, but Finalize requires them.
    const invalidRows = await prisma.word.findMany({
      where: {
        OR: [
          { english: { is: { base_form: { equals: "" } } } },
          { meaning: null },
          { meaning: { is: { canonical_text: { equals: "" } } } },
          { meaning: { is: { meaning_fa_IPA: { equals: "" } } } },
          { meaning: { is: { meaning_fa_IPA_normalize: { equals: "" } } } },
          { sentence: null },
          { sentence: { is: { sentence_en: "" } } },

          { english: { is: { phonetic_us: null } } },
          { english: { is: { phonetic_us: { equals: "" } } } },
          { english: { is: { phonetic_us_normalized: null } } },
          { english: { is: { phonetic_us_normalized: { equals: "" } } } },
          { pos: null },
          { pos: { equals: "" } },
          { sentence: { is: { sentence_en_meaning_fa: null } } },
          { sentence: { is: { sentence_en_meaning_fa: "" } } },
        ],
      },
      select: {
        id: true,
        english: { select: { base_form: true, phonetic_us: true, phonetic_us_normalized: true } },
        meaning: { select: { canonical_text: true, meaning_fa_IPA: true, meaning_fa_IPA_normalize: true } },
        pos: true,
        sentence: {
          select: {
            sentence_en: true,
            sentence_en_meaning_fa: true,
          },
        },
      },
      orderBy: { id: "asc" },
      take: 200,
    });

    const totalInvalid = await prisma.word.count({
      where: {
        OR: [
          { english: { is: { base_form: { equals: "" } } } },
          { meaning: null },
          { meaning: { is: { canonical_text: { equals: "" } } } },
          { meaning: { is: { meaning_fa_IPA: { equals: "" } } } },
          { meaning: { is: { meaning_fa_IPA_normalize: { equals: "" } } } },
          { sentence: null },
          { sentence: { is: { sentence_en: "" } } },

          { english: { is: { phonetic_us: null } } },
          { english: { is: { phonetic_us: { equals: "" } } } },
          { english: { is: { phonetic_us_normalized: null } } },
          { english: { is: { phonetic_us_normalized: { equals: "" } } } },
          { pos: null },
          { pos: { equals: "" } },
          { sentence: { is: { sentence_en_meaning_fa: null } } },
          { sentence: { is: { sentence_en_meaning_fa: "" } } },
        ],
      },
    });

    if (totalInvalid > 0) {
      const sample = invalidRows.map((r) => {
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
          error: "Some Word rows are missing required fields",
          totalInvalid,
          sample,
        },
        { status: 400 },
      );
    }

    // 2) Validate anki_link_id is in the `${id}_${now}` format and matches the row id.
    const ankiRows = await prisma.word.findMany({
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
          error: "Some Word rows have invalid anki_link_id (must be `${id}_${now}` and match the row id).",
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
