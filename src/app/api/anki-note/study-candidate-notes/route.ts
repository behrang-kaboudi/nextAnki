import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

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

    const rows = await prisma.word.findMany({
      where:
        mode === "top-learning-depth"
          ? { learning_depth: { not: null } }
          : q
            ? {
                OR: [
                  { base_form: { contains: q } },
                  { meaning_fa: { contains: q } },
                  {
                    sentenceLinks: {
                      some: { isPrimary: true, sentence: { sentence_en: { contains: q } } },
                    },
                  },
                  {
                    sentenceLinks: {
                      some: {
                        isPrimary: true,
                        sentence: { sentence_en_meaning_fa: { contains: q } },
                      },
                    },
                  },
                ],
              }
            : undefined,
      select: {
        anki_link_id: true,
        base_form: true,
        meaning_fa: true,
        learning_depth: true,
        sentenceLinks: {
          where: { isPrimary: true },
          select: {
            sentence: {
              select: {
                sentence_en: true,
                sentence_en_meaning_fa: true,
              },
            },
          },
          take: 1,
        },
      },
      orderBy:
        mode === "top-learning-depth"
          ? [{ learning_depth: "desc" }, { id: "asc" }]
          : [{ base_form: "asc" }, { id: "asc" }],
      take: limit,
    });

    return NextResponse.json({
      ok: true,
      items: rows.map((row) => ({
        anki_link_id: row.anki_link_id,
        base_form: row.base_form,
        meaning_fa: row.meaning_fa,
        learning_depth: row.learning_depth,
        sentence_en: row.sentenceLinks[0]?.sentence.sentence_en ?? "",
        sentence_en_meaning_fa:
          row.sentenceLinks[0]?.sentence.sentence_en_meaning_fa ?? "",
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
