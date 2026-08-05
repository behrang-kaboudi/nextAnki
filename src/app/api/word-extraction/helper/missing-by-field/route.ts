import "server-only";

import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

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

    const missingCondition =
      field === "phonetic_us"
        ? Prisma.sql`ew.phonetic_us IS NULL OR ew.phonetic_us = ''`
        : field === "imageability"
          ? Prisma.sql`w.imageability IS NULL OR w.imageability <= 0`
          : field === "learning_depth"
            ? Prisma.sql`w.learning_depth IS NULL OR w.learning_depth = 0`
            : field === "productive_target"
              ? Prisma.sql`w.productive_target IS NULL OR w.productive_target = 0`
              : field === "sentence_en_meaning_fa"
                ? Prisma.sql`s.sentence_en_meaning_fa IS NULL OR s.sentence_en_meaning_fa = ''`
                : field === "pos"
                  ? Prisma.sql`w.pos IS NULL OR w.pos = ''`
                  : Prisma.sql`w.concept_explained_fa IS NULL OR w.concept_explained_fa = ''`;

    const totalRows = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) AS count
      FROM word w
      INNER JOIN english_word ew ON ew.id = w.englishId
      LEFT JOIN SentenceWordLink sw ON sw.wordId = w.id AND sw.isPrimary = true
      LEFT JOIN Sentence s ON s.id = sw.sentenceId
      WHERE ${missingCondition}
    `;
    const total = Number(totalRows[0]?.count ?? BigInt(0));

    const rows =
      field === "phonetic_us"
        ? (await prisma.$queryRaw<
            Array<{ id: number; base_form: string; meaning_fa: string; sentence_en: string }>
          >`
            SELECT w.id, ew.base_form, COALESCE(pw.canonical_text, '') AS meaning_fa, COALESCE(s.sentence_en, '') AS sentence_en
            FROM word w
      INNER JOIN english_word ew ON ew.id = w.englishId
            LEFT JOIN persian_word pw ON pw.id = w.meaningId
            LEFT JOIN SentenceWordLink sw ON sw.wordId = w.id AND sw.isPrimary = true
            LEFT JOIN Sentence s ON s.id = sw.sentenceId
            WHERE ew.phonetic_us IS NULL OR ew.phonetic_us = ''
            ORDER BY w.id DESC
            LIMIT ${limit}
          `) ?? []
        : field === "imageability"
          ? (await prisma.$queryRaw<
              Array<{ id: number; base_form: string; meaning_fa: string; sentence_en: string }>
            >`
              SELECT w.id, ew.base_form, COALESCE(pw.canonical_text, '') AS meaning_fa, COALESCE(s.sentence_en, '') AS sentence_en
              FROM word w
      INNER JOIN english_word ew ON ew.id = w.englishId
              LEFT JOIN persian_word pw ON pw.id = w.meaningId
              LEFT JOIN SentenceWordLink sw ON sw.wordId = w.id AND sw.isPrimary = true
              LEFT JOIN Sentence s ON s.id = sw.sentenceId
              WHERE w.imageability IS NULL OR w.imageability <= 0
              ORDER BY w.id DESC
              LIMIT ${limit}
            `) ?? []
            : field === "learning_depth"
            ? (await prisma.$queryRaw<
                Array<{ id: number; base_form: string; meaning_fa: string; sentence_en: string }>
              >`
                SELECT w.id, ew.base_form, COALESCE(pw.canonical_text, '') AS meaning_fa, COALESCE(s.sentence_en, '') AS sentence_en
                FROM word w
      INNER JOIN english_word ew ON ew.id = w.englishId
                LEFT JOIN persian_word pw ON pw.id = w.meaningId
                LEFT JOIN SentenceWordLink sw ON sw.wordId = w.id AND sw.isPrimary = true
                LEFT JOIN Sentence s ON s.id = sw.sentenceId
                WHERE w.learning_depth IS NULL OR w.learning_depth = 0
                ORDER BY w.id DESC
                LIMIT ${limit}
              `) ?? []
            : field === "productive_target"
              ? (await prisma.$queryRaw<
                  Array<{ id: number; base_form: string; meaning_fa: string; sentence_en: string }>
                >`
                  SELECT w.id, ew.base_form, COALESCE(pw.canonical_text, '') AS meaning_fa, COALESCE(s.sentence_en, '') AS sentence_en
                  FROM word w
      INNER JOIN english_word ew ON ew.id = w.englishId
                  LEFT JOIN persian_word pw ON pw.id = w.meaningId
                  LEFT JOIN SentenceWordLink sw ON sw.wordId = w.id AND sw.isPrimary = true
                  LEFT JOIN Sentence s ON s.id = sw.sentenceId
                  WHERE w.productive_target IS NULL OR w.productive_target = 0
                  ORDER BY w.id DESC
                  LIMIT ${limit}
                `) ?? []
              : field === "sentence_en_meaning_fa"
              ? (await prisma.$queryRaw<
                  Array<{ id: number; base_form: string; meaning_fa: string; sentence_en: string }>
                >`
                  SELECT w.id, ew.base_form, COALESCE(pw.canonical_text, '') AS meaning_fa, COALESCE(s.sentence_en, '') AS sentence_en
                  FROM word w
      INNER JOIN english_word ew ON ew.id = w.englishId
                  LEFT JOIN persian_word pw ON pw.id = w.meaningId
                  LEFT JOIN SentenceWordLink sw ON sw.wordId = w.id AND sw.isPrimary = true
                  LEFT JOIN Sentence s ON s.id = sw.sentenceId
                  WHERE s.sentence_en_meaning_fa IS NULL OR s.sentence_en_meaning_fa = ''
                  ORDER BY w.id DESC
                  LIMIT ${limit}
                `) ?? []
              : field === "pos"
                ? (await prisma.$queryRaw<
                    Array<{ id: number; base_form: string; meaning_fa: string; sentence_en: string }>
                  >`
                    SELECT w.id, ew.base_form, COALESCE(pw.canonical_text, '') AS meaning_fa, COALESCE(s.sentence_en, '') AS sentence_en
                    FROM word w
      INNER JOIN english_word ew ON ew.id = w.englishId
                    LEFT JOIN persian_word pw ON pw.id = w.meaningId
                    LEFT JOIN SentenceWordLink sw ON sw.wordId = w.id AND sw.isPrimary = true
                    LEFT JOIN Sentence s ON s.id = sw.sentenceId
                    WHERE w.pos IS NULL OR w.pos = ''
                    ORDER BY w.id DESC
                    LIMIT ${limit}
                  `) ?? []
                : (await prisma.$queryRaw<
                      Array<{ id: number; base_form: string; meaning_fa: string; sentence_en: string }>
                    >`
                      SELECT w.id, ew.base_form, COALESCE(pw.canonical_text, '') AS meaning_fa, COALESCE(s.sentence_en, '') AS sentence_en
                      FROM word w
      INNER JOIN english_word ew ON ew.id = w.englishId
                      LEFT JOIN persian_word pw ON pw.id = w.meaningId
                      LEFT JOIN SentenceWordLink sw ON sw.wordId = w.id AND sw.isPrimary = true
                      LEFT JOIN Sentence s ON s.id = sw.sentenceId
                      WHERE w.concept_explained_fa IS NULL OR w.concept_explained_fa = ''
                      ORDER BY w.id DESC
                      LIMIT ${limit}
                    `) ?? [];

    return NextResponse.json({ ok: true, field, total, fetched: rows.length, limit, items: rows });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
