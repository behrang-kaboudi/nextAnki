import "server-only";

import { NextResponse } from "next/server";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function parseLimit(value: string | null, fallback: number) {
  const n = value ? Number(value) : NaN;
  if (!Number.isFinite(n)) return fallback;
  const i = Math.floor(n);
  if (i <= 0) return fallback;
  return Math.min(i, 500);
}

function numberFromUnknownCount(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const limit = parseLimit(url.searchParams.get("limit"), 20);

    // Extraction basis for this modal:
    // only rows with missing phonetic_us should be selected.
    const missingWhere = Prisma.sql`
      (w.phonetic_us IS NULL OR w.phonetic_us = '')
    `;

    const totalRows = (await prisma.$queryRaw<Array<{ count: unknown }>>(Prisma.sql`
      SELECT COUNT(*) AS count
      FROM word w
      LEFT JOIN SentenceWordLink sw ON sw.wordId = w.id AND sw.isPrimary = true
      LEFT JOIN Sentence s ON s.id = sw.sentenceId
      WHERE ${missingWhere}
    `)) ?? [];
    const total = numberFromUnknownCount(totalRows[0]?.count);

    const rows = (await prisma.$queryRaw<
      Array<{
        id: number;
        base_form: string;
        meaning_fa: string;
        sentence_en: string;
        sentence_en_meaning_fa: string;
      }>
    >(Prisma.sql`
      SELECT
        w.id,
        w.base_form,
        w.meaning_fa,
        COALESCE(s.sentence_en, '') AS sentence_en,
        COALESCE(s.sentence_en_meaning_fa, '') AS sentence_en_meaning_fa
      FROM word w
      LEFT JOIN SentenceWordLink sw ON sw.wordId = w.id AND sw.isPrimary = true
      LEFT JOIN Sentence s ON s.id = sw.sentenceId
      WHERE ${missingWhere}
      ORDER BY w.id DESC
      LIMIT ${limit}
    `)) ?? [];

    return NextResponse.json({
      ok: true,
      basis: {
        fields: ["phonetic_us"],
        rule: "Includes a row only if phonetic_us is NULL or empty.",
        orderBy: "id DESC",
      },
      total,
      fetched: rows.length,
      limit,
      items: rows,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
