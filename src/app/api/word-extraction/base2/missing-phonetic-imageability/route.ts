import "server-only";

import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  try {
    // phonetic_us is nullable, imageability is NOT nullable (default 10).
    // Treat missing phonetic_us as null/empty, and missing imageability as null (shouldn't happen) or <= 0.
    // learning_depth is nullable; treat NULL as missing (needs model output).
    const rows = (await prisma.$queryRaw<
      Array<{
        id: number;
        base_form: string;
        meaning_fa: string;
        sentence_en: string;
      }>
    >`
      SELECT id, base_form, meaning_fa, sentence_en
      FROM Word
      WHERE (phonetic_us IS NULL OR phonetic_us = '')
         OR (imageability IS NULL OR imageability <= 0)
         OR (learning_depth IS NULL)
         OR (sentence_en_meaning_fa IS NULL OR sentence_en_meaning_fa = '')
         OR (pos IS NULL OR pos = '')
      ORDER BY id DESC
      LIMIT 20
    `) ?? [];

    return NextResponse.json({ ok: true, items: rows });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
