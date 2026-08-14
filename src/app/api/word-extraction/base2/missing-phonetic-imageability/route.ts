import "server-only";

import type { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { hydrateWordsWithPrimarySentence } from "@/lib/words/primarySentences.server";

export const runtime = "nodejs";

function parseLimit(value: string | null, fallback: number) {
  const n = value ? Number(value) : NaN;
  if (!Number.isFinite(n)) return fallback;
  const i = Math.floor(n);
  if (i <= 0) return fallback;
  return Math.min(i, 500);
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const limit = parseLimit(url.searchParams.get("limit"), 20);

    const where: Prisma.WordSenseWhereInput = {
      english: { OR: [{ phonetic_us: null }, { phonetic_us: "" }] },
    };
    const [total, words] = await Promise.all([
      prisma.wordSense.count({ where }),
      prisma.wordSense.findMany({
        where,
        orderBy: { id: "desc" },
        take: limit,
        select: {
          id: true,
          sentenceIds: true,
          english: { select: { base_form: true } },
          meaning: { select: { canonical_text: true } },
        },
      }),
    ]);
    const hydrated = await hydrateWordsWithPrimarySentence(words);
    const rows = hydrated.map((word) => ({
      id: word.id,
      base_form: word.english.base_form,
      meaning_fa: word.meaning?.canonical_text ?? "",
      sentence_en: word.sentence?.sentence_en ?? "",
      sentence_en_meaning_fa: word.sentence?.sentence_en_meaning_fa ?? "",
    }));

    return NextResponse.json({
      ok: true,
      basis: {
        fields: ["phonetic_us"],
        rule: "Includes a row only if phonetic_us is NULL or empty.",
        orderBy: "id DESC",
      },
      total,
      fetched: rows.length,
      limit,
      items: rows,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
