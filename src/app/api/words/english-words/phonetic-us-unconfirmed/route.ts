import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function parseLimit(value: string | null) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : 50;
}

export async function GET(request: Request) {
  const limit = parseLimit(new URL(request.url).searchParams.get("limit"));
  const where = {
    phonetic_us_confirmed: false,
    OR: [{ phonetic_us: null }, { phonetic_us: "" }],
  };
  const [items, totalUnconfirmed] = await Promise.all([
    prisma.englishWord.findMany({ where, orderBy: { id: "asc" }, take: limit, select: { id: true, base_form: true } }),
    prisma.englishWord.count({ where }),
  ]);
  return NextResponse.json({ ok: true, items, totalUnconfirmed });
}
