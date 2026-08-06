import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { hydrateWordsWithPersianMeanings } from "@/lib/words/persianMeanings.server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const limit = Number(new URL(request.url).searchParams.get("limit"));
  const take = Number.isSafeInteger(limit) && limit >= 0 ? limit : 50;
  const where = { meanings_confirmed: false };
  const [raw, totalUnconfirmed] = await Promise.all([
    prisma.word.findMany({
      where,
      orderBy: { id: "asc" },
      take,
      select: {
        id: true,
        meaningId: true,
        otherMeaningIds: true,
        english: { select: { base_form: true, phonetic_us: true } },
        sentence: { select: { sentence_en: true } },
      },
    }),
    prisma.word.count({ where }),
  ]);
  const words = await hydrateWordsWithPersianMeanings(raw);
  return NextResponse.json({
    ok: true,
    totalUnconfirmed,
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
