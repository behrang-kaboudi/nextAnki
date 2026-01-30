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
            SELECT id, base_form, meaning_fa, sentence_en
            FROM Word
            WHERE phonetic_us IS NULL OR phonetic_us = ''
            ORDER BY id DESC
            LIMIT 20
          `) ?? []
        : field === "imageability"
          ? (await prisma.$queryRaw<
              Array<{ id: number; base_form: string; meaning_fa: string; sentence_en: string }>
            >`
              SELECT id, base_form, meaning_fa, sentence_en
              FROM Word
              WHERE imageability IS NULL OR imageability <= 0
              ORDER BY id DESC
              LIMIT 20
            `) ?? []
          : field === "learning_depth"
            ? (await prisma.$queryRaw<
                Array<{ id: number; base_form: string; meaning_fa: string; sentence_en: string }>
              >`
                SELECT id, base_form, meaning_fa, sentence_en
                FROM Word
                WHERE learning_depth IS NULL
                ORDER BY id DESC
                LIMIT 20
              `) ?? []
            : field === "sentence_en_meaning_fa"
              ? (await prisma.$queryRaw<
                  Array<{ id: number; base_form: string; meaning_fa: string; sentence_en: string }>
                >`
                  SELECT id, base_form, meaning_fa, sentence_en
                  FROM Word
                  WHERE sentence_en_meaning_fa IS NULL OR sentence_en_meaning_fa = ''
                  ORDER BY id DESC
                  LIMIT 20
                `) ?? []
              : field === "pos"
                ? (await prisma.$queryRaw<
                    Array<{ id: number; base_form: string; meaning_fa: string; sentence_en: string }>
                  >`
                    SELECT id, base_form, meaning_fa, sentence_en
                    FROM Word
                    WHERE pos IS NULL OR pos = ''
                    ORDER BY id DESC
                    LIMIT 20
                  `) ?? []
                : (await prisma.$queryRaw<
                    Array<{ id: number; base_form: string; meaning_fa: string; sentence_en: string }>
                  >`
                    SELECT id, base_form, meaning_fa, sentence_en
                    FROM Word
                    WHERE other_meanings_fa IS NULL OR other_meanings_fa = ''
                    ORDER BY id DESC
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

