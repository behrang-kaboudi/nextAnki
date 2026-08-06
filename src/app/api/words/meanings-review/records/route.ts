import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { hydrateWordsWithPersianMeanings } from "@/lib/words/persianMeanings.server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    ids?: unknown;
  } | null;
  const ids = Array.isArray(body?.ids) ? body.ids : [];
  if (
    !ids.length ||
    ids.some(
      (id) => typeof id !== "number" || !Number.isSafeInteger(id) || id <= 0,
    )
  )
    return NextResponse.json(
      { ok: false, error: "ids must be positive integers." },
      { status: 400 },
    );
  const raw = await prisma.word.findMany({
    where: { id: { in: [...new Set(ids)] } },
    select: {
      id: true,
      meaningId: true,
      otherMeaningIds: true,
      english: { select: { base_form: true } },
      sentence: { select: { sentence_en: true } },
    },
  });
  const words = await hydrateWordsWithPersianMeanings(raw);
  return NextResponse.json({
    ok: true,
    items: words.map((word) => ({
      id: word.id,
      base_form: word.english.base_form,
      meaning_fa: word.meaning_fa,
      other_meanings_fa: word.otherPersianWords.map(
        (meaning) => meaning.canonical_text,
      ),
      sentence_en: word.sentence?.sentence_en ?? "",
    })),
  });
}
