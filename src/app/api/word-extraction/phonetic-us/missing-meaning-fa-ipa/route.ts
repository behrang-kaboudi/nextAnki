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
      }>
    >`
      SELECT id, base_form, meaning_fa
      FROM Word
      WHERE meaning_fa_IPA IS NULL OR meaning_fa_IPA = ''
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
