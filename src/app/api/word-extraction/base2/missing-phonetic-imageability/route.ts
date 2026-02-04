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

    // Extraction basis (Phase 3):
    // - strings: NULL or '' (empty)
    // - numbers: NULL (shouldn't happen for imageability) or <= 0
    // - learning_depth: NULL
    const missingWhere = Prisma.sql`
      (phonetic_us IS NULL OR phonetic_us = '')
         OR (imageability IS NULL OR imageability <= 0)
         OR (learning_depth IS NULL)
         OR (sentence_en_meaning_fa IS NULL OR sentence_en_meaning_fa = '')
         OR (pos IS NULL OR pos = '')
    `;

    const totalRows = (await prisma.$queryRaw<Array<{ count: unknown }>>(Prisma.sql`
      SELECT COUNT(*) AS count
      FROM Word
      WHERE ${missingWhere}
    `)) ?? [];
    const total = numberFromUnknownCount(totalRows[0]?.count);

    const rows = (await prisma.$queryRaw<
      Array<{
        id: number;
        base_form: string;
        meaning_fa: string;
        sentence_en: string;
      }>
    >(Prisma.sql`
      SELECT id, base_form, meaning_fa, sentence_en
      FROM Word
      WHERE ${missingWhere}
      ORDER BY id DESC
      LIMIT ${limit}
    `)) ?? [];

    return NextResponse.json({
      ok: true,
      basis: {
        fields: [
          "phonetic_us",
          "imageability",
          "learning_depth",
          "sentence_en_meaning_fa",
          "pos",
        ],
        rule:
          "Includes a row if ANY of the Phase 3 fields is missing (string: NULL/empty, number: NULL/<=0).",
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
