import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { touchWordsReferencingPersianWord } from "@/lib/words/persianMeanings.server";

function parseId(value: string) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = parseId((await params).id);
  if (!id) return NextResponse.json({ ok: false, error: "Invalid PersianWord id." }, { status: 400 });

  const body = (await request.json().catch(() => null)) as { confirmed?: unknown } | null;
  if (typeof body?.confirmed !== "boolean") {
    return NextResponse.json({ ok: false, error: "confirmed must be a boolean." }, { status: 400 });
  }

  const existing = await prisma.persianWord.findUnique({
    where: { id },
    select: { meaning_fa_IPA: true },
  });
  if (!existing) return NextResponse.json({ ok: false, error: "PersianWord not found." }, { status: 404 });
  if (body.confirmed && !existing.meaning_fa_IPA?.trim()) {
    return NextResponse.json({ ok: false, error: "A missing Persian IPA cannot be confirmed." }, { status: 409 });
  }

  const item = await prisma.persianWord.update({
    where: { id },
    data: { meaning_fa_IPA_confirmed: body.confirmed },
    select: { id: true, meaning_fa_IPA_confirmed: true },
  });
  await touchWordsReferencingPersianWord(id);
  return NextResponse.json({ ok: true, item });
}
