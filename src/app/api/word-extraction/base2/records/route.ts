import "server-only";

import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function asPositiveInt(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const i = Math.floor(value);
  return i > 0 ? i : null;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as unknown;
    const idsRaw = (body as { ids?: unknown } | null)?.ids;
    if (!Array.isArray(idsRaw)) {
      return NextResponse.json(
        { ok: false, error: "Body must include { ids: number[] }" },
        { status: 400 },
      );
    }

    const ids = idsRaw.map(asPositiveInt).filter((n): n is number => Boolean(n));
    if (ids.length === 0) {
      return NextResponse.json({ ok: false, error: "No valid ids" }, { status: 400 });
    }

    const rows = await prisma.word.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        base_form: true,
        meaning_fa: true,
        phonetic_us: true,
        phonetic_us_normalized: true,
        imageability: true,
      },
    });

    return NextResponse.json({ ok: true, items: rows });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}

