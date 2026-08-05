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

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const limit = parseLimit(url.searchParams.get("limit"), 20);

    const rows = (await prisma.$queryRaw<
      Array<{
        id: number;
        base_form: string;
        meaning_fa: string;
      }>
    >(Prisma.sql`
      SELECT w.id, ew.base_form, COALESCE(pw.canonical_text, '') AS meaning_fa
      FROM word w
      INNER JOIN english_word ew ON ew.id = w.englishId
      LEFT JOIN persian_word pw ON pw.id = w.meaningId
      WHERE pw.meaning_fa_IPA IS NULL OR pw.meaning_fa_IPA = ''
      ORDER BY w.id DESC
      LIMIT ${limit}
    `)) ?? [];

    return NextResponse.json({ ok: true, items: rows });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
