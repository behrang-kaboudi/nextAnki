import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { ids?: unknown } | null;
  const ids = Array.isArray(body?.ids) ? body.ids.filter((id): id is number => typeof id === "number" && Number.isSafeInteger(id) && id > 0) : [];
  if (!ids.length) return NextResponse.json({ ok: false, error: "Body must include valid ids." }, { status: 400 });
  const items = await prisma.persianWord.findMany({
    where: { id: { in: [...new Set(ids)] } },
    select: { id: true, canonical_text: true, meaning_fa_IPA: true, meaning_fa_IPA_normalize: true },
  });
  return NextResponse.json({ ok: true, items });
}
