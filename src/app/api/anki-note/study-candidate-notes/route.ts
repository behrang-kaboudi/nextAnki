import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { hydrateWordSensesWithPersianMeanings } from "@/lib/words/persianMeanings.server";
import { flattenWordSenseEnglishRelation, WORD_SENSE_ENGLISH_FIELDS_SELECT } from "@/lib/english/wordSenseEnglishFields.server";
import { hydrateWordsWithPrimarySentence, wordSenseIdsWhosePrimarySentenceContains } from "@/lib/words/primarySentences.server";

function asTrimmedString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const q = asTrimmedString(url.searchParams.get("q"));
    const limitValue = Number(url.searchParams.get("limit") ?? "50");
    const limit = Math.max(1, Math.min(100, Math.trunc(limitValue) || 50));
    const mode = asTrimmedString(url.searchParams.get("mode"));
    const sentenceMatchWordIds = q ? await wordSenseIdsWhosePrimarySentenceContains(q) : [];

    const rows = await prisma.wordSense.findMany({
      where:
        mode === "top-learning-depth"
          ? { learning_depth: { not: null } }
          : q
            ? {
                OR: [
                  { english: { is: { base_form: { contains: q } } } },
                  { meaning: { is: { canonical_text: { contains: q } } } },
                  ...(sentenceMatchWordIds.length ? [{ id: { in: sentenceMatchWordIds } }] : []),
                ],
              }
            : undefined,
      select: {
        anki_link_id: true,
        englishId: true,
        english: { select: WORD_SENSE_ENGLISH_FIELDS_SELECT },
        meaningId: true,
        otherMeaningIds: true,
        learning_depth: true,
        sentenceIds: true,
      },
      orderBy:
        mode === "top-learning-depth"
          ? [{ learning_depth: "desc" }, { id: "asc" }]
          : [{ english: { base_form: "asc" } }, { id: "asc" }],
      take: mode === "top-learning-depth" ? undefined : limit,
    });

    return NextResponse.json({
      ok: true,
      items: (await hydrateWordSensesWithPersianMeanings(
        await hydrateWordsWithPrimarySentence(rows.map(flattenWordSenseEnglishRelation)),
      )).map((row) => ({
        anki_link_id: row.anki_link_id,
        base_form: row.base_form,
        meaning_fa: row.meaning_fa,
        learning_depth: row.learning_depth,
        sentence_en: row.sentence?.sentence_en ?? "",
        sentence_en_meaning_fa: row.sentence?.sentence_en_meaning_fa ?? "",
      })),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
