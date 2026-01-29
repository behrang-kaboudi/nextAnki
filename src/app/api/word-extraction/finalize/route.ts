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
          { base_form: { equals: "" } },
          { meaning_fa: { equals: "" } },
          { meaning_fa_IPA: { equals: "" } },
          { meaning_fa_IPA_normalized: { equals: "" } },
          { sentence_en: { equals: "" } },

          { phonetic_us: null },
          { phonetic_us: { equals: "" } },
          { phonetic_us_normalized: null },
          { phonetic_us_normalized: { equals: "" } },
          { pos: null },
          { pos: { equals: "" } },
          { sentence_en_meaning_fa: null },
          { sentence_en_meaning_fa: { equals: "" } },
        ],
      },
      select: {
        id: true,
        base_form: true,
        phonetic_us: true,
        phonetic_us_normalized: true,
        meaning_fa: true,
        meaning_fa_IPA: true,
        meaning_fa_IPA_normalized: true,
        pos: true,
        sentence_en: true,
        sentence_en_meaning_fa: true,
      },
      orderBy: { id: "asc" },
      take: 200,
    });

    const totalInvalid = await prisma.word.count({
      where: {
        OR: [
          { base_form: { equals: "" } },
          { meaning_fa: { equals: "" } },
          { meaning_fa_IPA: { equals: "" } },
          { meaning_fa_IPA_normalized: { equals: "" } },
          { sentence_en: { equals: "" } },

          { phonetic_us: null },
          { phonetic_us: { equals: "" } },
          { phonetic_us_normalized: null },
          { phonetic_us_normalized: { equals: "" } },
          { pos: null },
          { pos: { equals: "" } },
          { sentence_en_meaning_fa: null },
          { sentence_en_meaning_fa: { equals: "" } },
        ],
      },
    });

    if (totalInvalid > 0) {
      const sample = invalidRows.map((r) => {
        const missing: string[] = [];
        if (isBlank(r.base_form)) missing.push("base_form");
        if (isBlank(r.phonetic_us)) missing.push("phonetic_us");
        if (isBlank(r.phonetic_us_normalized)) missing.push("phonetic_us_normalized");
        if (isBlank(r.meaning_fa)) missing.push("meaning_fa");
        if (isBlank(r.meaning_fa_IPA)) missing.push("meaning_fa_IPA");
        if (isBlank(r.meaning_fa_IPA_normalized)) missing.push("meaning_fa_IPA_normalized");
        if (isBlank(r.pos)) missing.push("pos");
        if (isBlank(r.sentence_en)) missing.push("sentence_en");
        if (isBlank(r.sentence_en_meaning_fa)) missing.push("sentence_en_meaning_fa");
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
    const invalidAnkiSample = await prisma.$queryRaw<Array<{ id: number; anki_link_id: string }>>`
      SELECT id, anki_link_id
      FROM Word
      WHERE anki_link_id = ''
         OR anki_link_id NOT REGEXP '^[0-9]+_[0-9]+$'
         OR SUBSTRING_INDEX(anki_link_id, '_', 1) <> CAST(id AS CHAR)
      ORDER BY id ASC
      LIMIT 200
    `;
    const invalidAnkiCountRow = await prisma.$queryRaw<Array<{ c: bigint }>>`
      SELECT COUNT(*) as c
      FROM Word
      WHERE anki_link_id = ''
         OR anki_link_id NOT REGEXP '^[0-9]+_[0-9]+$'
         OR SUBSTRING_INDEX(anki_link_id, '_', 1) <> CAST(id AS CHAR)
    `;
    const invalidAnkiCount = Number(invalidAnkiCountRow?.[0]?.c ?? 0);
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
