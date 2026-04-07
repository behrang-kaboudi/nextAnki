import "server-only";

import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  try {
    const rows = (await prisma.$queryRaw<
      Array<{
        id: number;
        base_form: string;
        meaning_fa: string;
        sentence_en: string;
      }>
    >`
      SELECT w.id, w.base_form, w.meaning_fa, COALESCE(s.sentence_en, '') AS sentence_en
      FROM word w
      LEFT JOIN SentenceWordLink sw ON sw.wordId = w.id AND sw.isPrimary = true
      LEFT JOIN Sentence s ON s.id = sw.sentenceId
      WHERE s.sentence_en_meaning_fa IS NULL OR s.sentence_en_meaning_fa = ''
      ORDER BY w.id DESC
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
