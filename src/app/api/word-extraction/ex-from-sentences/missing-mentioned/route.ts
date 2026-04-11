import "server-only";

import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function parseLimit(value: string | null, fallback: number) {
  const n = value ? Number(value) : Number.NaN;
  if (!Number.isFinite(n)) return fallback;
  const i = Math.floor(n);
  if (i <= 0) return fallback;
  return Math.min(i, 500);
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const limit = parseLimit(url.searchParams.get("limit"), 20);

    const items = await prisma.sentence.findMany({
      where: { mentionedWordsJson: { equals: Prisma.AnyNull } },
      orderBy: { id: "asc" },
      take: limit,
      select: {
        id: true,
        sentence_en: true,
      },
    });

    return NextResponse.json({ ok: true as const, limit, items });
  } catch (error) {
    return NextResponse.json(
      { ok: false as const, error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
