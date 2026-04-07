import "server-only";

import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const allowedFields = [
  "phonetic_us",
  "imageability",
  "learning_depth",
  "sentence_en_meaning_fa",
  "pos",
  "other_meanings_fa",
  "concept_explained_fa",
] as const;
type AllowedField = (typeof allowedFields)[number];

function isAllowedField(value: string): value is AllowedField {
  return (allowedFields as readonly string[]).includes(value);
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const field = String(url.searchParams.get("field") ?? "");
    if (!isAllowedField(field)) {
      return NextResponse.json(
        { ok: false, error: `Invalid field. Must be one of: ${allowedFields.join(", ")}` },
        { status: 400 },
      );
    }

    const rows =
      field === "phonetic_us"
        ? (await prisma.$queryRaw<
            Array<{ id: number; base_form: string; meaning_fa: string; sentence_en: string }>
          >`
            SELECT w.id, w.base_form, w.meaning_fa, COALESCE(s.sentence_en, '') AS sentence_en
            FROM word w
            LEFT JOIN Sentence s ON s.anki_link_id = w.anki_link_id
            WHERE w.phonetic_us IS NULL OR w.phonetic_us = ''
            ORDER BY w.id DESC
            LIMIT 20
          `) ?? []
        : field === "imageability"
          ? (await prisma.$queryRaw<
              Array<{ id: number; base_form: string; meaning_fa: string; sentence_en: string }>
            >`
              SELECT w.id, w.base_form, w.meaning_fa, COALESCE(s.sentence_en, '') AS sentence_en
              FROM word w
              LEFT JOIN Sentence s ON s.anki_link_id = w.anki_link_id
              WHERE w.imageability IS NULL OR w.imageability <= 0
              ORDER BY w.id DESC
              LIMIT 20
            `) ?? []
          : field === "learning_depth"
            ? (await prisma.$queryRaw<
                Array<{ id: number; base_form: string; meaning_fa: string; sentence_en: string }>
              >`
                SELECT w.id, w.base_form, w.meaning_fa, COALESCE(s.sentence_en, '') AS sentence_en
                FROM word w
                LEFT JOIN Sentence s ON s.anki_link_id = w.anki_link_id
                WHERE w.learning_depth IS NULL
                ORDER BY w.id DESC
                LIMIT 20
              `) ?? []
            : field === "sentence_en_meaning_fa"
              ? (await prisma.$queryRaw<
                  Array<{ id: number; base_form: string; meaning_fa: string; sentence_en: string }>
                >`
                  SELECT w.id, w.base_form, w.meaning_fa, COALESCE(s.sentence_en, '') AS sentence_en
                  FROM word w
                  LEFT JOIN Sentence s ON s.anki_link_id = w.anki_link_id
                  WHERE s.sentence_en_meaning_fa IS NULL OR s.sentence_en_meaning_fa = ''
                  ORDER BY w.id DESC
                  LIMIT 20
                `) ?? []
              : field === "pos"
                ? (await prisma.$queryRaw<
                    Array<{ id: number; base_form: string; meaning_fa: string; sentence_en: string }>
                  >`
                    SELECT w.id, w.base_form, w.meaning_fa, COALESCE(s.sentence_en, '') AS sentence_en
                    FROM word w
                    LEFT JOIN Sentence s ON s.anki_link_id = w.anki_link_id
                    WHERE w.pos IS NULL OR w.pos = ''
                    ORDER BY w.id DESC
                    LIMIT 20
                  `) ?? []
                : field === "other_meanings_fa"
                  ? (await prisma.$queryRaw<
                      Array<{ id: number; base_form: string; meaning_fa: string; sentence_en: string }>
                    >`
                      SELECT w.id, w.base_form, w.meaning_fa, COALESCE(s.sentence_en, '') AS sentence_en
                      FROM word w
                      LEFT JOIN Sentence s ON s.anki_link_id = w.anki_link_id
                      WHERE w.other_meanings_fa IS NULL OR w.other_meanings_fa = ''
                      ORDER BY w.id DESC
                      LIMIT 20
                    `) ?? []
                  : (await prisma.$queryRaw<
                      Array<{ id: number; base_form: string; meaning_fa: string; sentence_en: string }>
                    >`
                      SELECT w.id, w.base_form, w.meaning_fa, COALESCE(s.sentence_en, '') AS sentence_en
                      FROM word w
                      LEFT JOIN Sentence s ON s.anki_link_id = w.anki_link_id
                      WHERE w.concept_explained_fa IS NULL OR w.concept_explained_fa = ''
                      ORDER BY w.id DESC
                      LIMIT 20
                    `) ?? [];

    return NextResponse.json({ ok: true, items: rows });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
