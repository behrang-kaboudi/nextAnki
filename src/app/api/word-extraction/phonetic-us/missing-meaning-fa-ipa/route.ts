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
      SELECT id, base_form, meaning_fa
      FROM Word
      WHERE meaning_fa_IPA IS NULL OR meaning_fa_IPA = ''
      ORDER BY id DESC
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
