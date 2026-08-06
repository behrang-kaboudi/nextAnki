import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { hydrateWordsWithPersianMeanings } from "@/lib/words/persianMeanings.server";
import { hydrateMeaningReviewSentences } from "@/lib/words/meaningReviewSentences.server";

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
        pos: true,
        concept_explained_fa: true,
        sentenceId: true,
        sentenceIds: true,
        english: { select: { base_form: true, phonetic_us: true } },
      },
    }),
    prisma.word.count({ where }),
  ]);
  const words = await hydrateMeaningReviewSentences(
    await hydrateWordsWithPersianMeanings(raw),
  );
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
      pos: word.pos ?? "",
      concept_explained_fa: word.concept_explained_fa ?? "",
      sentences: word.reviewSentences.map((sentence) => ({
        id: sentence.id,
        sentence_en: sentence.sentence_en,
        sentence_en_meaning_fa: sentence.sentence_en_meaning_fa ?? "",
      })),
    })),
  });
}
