import "server-only";

import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { hydrateWordsWithPrimarySentence } from "@/lib/words/primarySentences.server";

export const runtime = "nodejs";

export async function GET() {
  try {
    const words = await prisma.wordSense.findMany({
      orderBy: { id: "desc" },
      select: {
        id: true,
        sentenceIds: true,
        english: { select: { base_form: true } },
        meaning: { select: { canonical_text: true } },
      },
    });
    const hydrated = await hydrateWordsWithPrimarySentence(words);
    const rows = hydrated
      .filter((word) => !word.sentence || !word.sentence.sentence_en_meaning_fa?.trim())
      .slice(0, 20)
      .map((word) => ({
        id: word.id,
        base_form: word.english.base_form,
        meaning_fa: word.meaning?.canonical_text ?? "",
        sentence_en: word.sentence?.sentence_en ?? "",
      }));

    return NextResponse.json({ ok: true, items: rows });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
