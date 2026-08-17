import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function positiveInt(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const requestedPage = positiveInt(searchParams.get("page"), 1);
  const pageSize = Math.min(500, positiveInt(searchParams.get("pageSize"), 100));
  const where = {
    meaning_fa_IPA_confirmed: false,
    AND: [{ meaning_fa_IPA: { not: null } }, { meaning_fa_IPA: { not: "" } }],
  };

  const total = await prisma.persianWord.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(requestedPage, pageCount);
  const items = await prisma.persianWord.findMany({
    where,
    orderBy: { id: "asc" },
    skip: (page - 1) * pageSize,
    take: pageSize,
    select: {
      id: true,
      canonical_text: true,
      meaning_fa_IPA: true,
      meaning_fa_IPA_normalize: true,
      meaning_fa_IPA_confirmed: true,
    },
  });

  return NextResponse.json({ ok: true, total, page, pageSize, pageCount, items });
}
