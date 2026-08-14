import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { ids?: unknown } | null;
  const ids = Array.isArray(body?.ids) ? body.ids.filter((id): id is number => typeof id === "number" && Number.isSafeInteger(id) && id > 0) : [];
  if (!ids.length || new Set(ids).size !== ids.length) return NextResponse.json({ ok: false, error: "Body must include unique valid ids." }, { status: 400 });
  const records = await prisma.persianWord.findMany({
    where: { id: { in: [...new Set(ids)] } },
    select: { id: true, canonical_text: true, meaning_fa_IPA: true, meaning_fa_IPA_normalize: true, meaning_fa_IPA_confirmed: true },
  });
  if (records.length !== ids.length) return NextResponse.json({ ok: false, error: "One or more response ids no longer exist." }, { status: 400 });
  const byId = new Map(records.map((item) => [item.id, item]));
  const items = ids.map((id) => byId.get(id)!);
  return NextResponse.json({ ok: true, items });
}
