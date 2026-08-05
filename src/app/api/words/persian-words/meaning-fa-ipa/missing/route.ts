import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const limitRaw = Number(new URL(request.url).searchParams.get("limit") ?? "100");
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(Math.floor(limitRaw), 1), 500) : 100;
  const where = { OR: [{ meaning_fa_IPA: null }, { meaning_fa_IPA: "" }] };
  const [totalMissing, items] = await Promise.all([
    prisma.persianWord.count({ where }),
    prisma.persianWord.findMany({
    where,
    orderBy: { id: "asc" },
    take: limit,
    select: { id: true, canonical_text: true },
    }),
  ]);
  return NextResponse.json({ ok: true, totalMissing, items });
}
