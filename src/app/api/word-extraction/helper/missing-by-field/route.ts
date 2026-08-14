import "server-only";

import type { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { hydrateWordsWithPrimarySentence } from "@/lib/words/primarySentences.server";
import { meaningReviewNotNeedsActionWhere } from "@/lib/words/meaningReviewStatus";

export const runtime = "nodejs";

const allowedFields = [
  "phonetic_us",
  "imageability",
  "learning_depth",
  "productive_target",
  "sentence_en_meaning_fa",
  "pos",
  "concept_explained_fa",
] as const;
type AllowedField = (typeof allowedFields)[number];

const wordSelect = {
  id: true,
  sentenceIds: true,
  english: { select: { base_form: true } },
  meaning: { select: { canonical_text: true } },
} satisfies Prisma.WordSenseSelect;

function parseLimit(value: string | null) {
  const n = value ? Number(value) : NaN;
  if (!Number.isFinite(n)) return 500;
  const i = Math.floor(n);
  if (i <= 0) return 500;
  return Math.min(i, 10000);
}

function isAllowedField(value: string): value is AllowedField {
  return (allowedFields as readonly string[]).includes(value);
}

function missingWordWhere(field: Exclude<AllowedField, "sentence_en_meaning_fa">): Prisma.WordSenseWhereInput {
  if (field === "phonetic_us") {
    return { english: { OR: [{ phonetic_us: null }, { phonetic_us: "" }] } };
  }
  if (field === "imageability") {
    return { OR: [{ imageability: null }, { imageability: { lte: 0 } }] };
  }
  if (field === "learning_depth") {
    return { OR: [{ learning_depth: null }, { learning_depth: 0 }] };
  }
  if (field === "productive_target") {
    return { OR: [{ productive_target: null }, { productive_target: 0 }] };
  }
  if (field === "pos") {
    return { OR: [{ pos: null }, { pos: "" }] };
  }
  return { OR: [{ concept_explained_fa: null }, { concept_explained_fa: "" }] };
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const field = String(url.searchParams.get("field") ?? "");
    const limit = parseLimit(url.searchParams.get("limit"));
    if (!isAllowedField(field)) {
      return NextResponse.json(
        { ok: false, error: `Invalid field. Must be one of: ${allowedFields.join(", ")}` },
        { status: 400 },
      );
    }

    let total: number;
    let hydrated;
    if (field === "sentence_en_meaning_fa") {
      const allWords = await prisma.wordSense.findMany({
        where: meaningReviewNotNeedsActionWhere,
        orderBy: { id: "desc" },
        select: wordSelect,
      });
      const allHydrated = await hydrateWordsWithPrimarySentence(allWords);
      const missing = allHydrated.filter(
        (word) => !word.sentence || !word.sentence.sentence_en_meaning_fa?.trim(),
      );
      total = missing.length;
      hydrated = missing.slice(0, limit);
    } else {
      const where: Prisma.WordSenseWhereInput = {
        AND: [meaningReviewNotNeedsActionWhere, missingWordWhere(field)],
      };
      const [count, words] = await Promise.all([
        prisma.wordSense.count({ where }),
        prisma.wordSense.findMany({ where, orderBy: { id: "desc" }, take: limit, select: wordSelect }),
      ]);
      total = count;
      hydrated = await hydrateWordsWithPrimarySentence(words);
    }

    const rows = hydrated.map((word) => ({
      id: word.id,
      base_form: word.english.base_form,
      meaning_fa: word.meaning?.canonical_text ?? "",
      sentence_en: word.sentence?.sentence_en ?? "",
    }));

    return NextResponse.json({ ok: true, field, total, fetched: rows.length, limit, items: rows });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
