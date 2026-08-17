import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { touchWordsReferencingPersianWords } from "@/lib/words/persianMeanings.server";

export const runtime = "nodejs";

export async function POST() {
  try {
    const rows = await prisma.persianWord.findMany({
      where: {
        meaning_fa_IPA_confirmed: false,
        AND: [{ meaning_fa_IPA: { not: null } }, { meaning_fa_IPA: { not: "" } }],
      },
      select: { id: true },
    });
    const ids = rows.map((row) => row.id);
    const result = await prisma.persianWord.updateMany({
      where: { id: { in: ids } },
      data: { meaning_fa_IPA_confirmed: true },
    });
    await touchWordsReferencingPersianWords(ids);
    return NextResponse.json({ ok: true, updated: result.count });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
