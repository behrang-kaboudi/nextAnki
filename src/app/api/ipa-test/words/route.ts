import "server-only";

import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

const clampInt = (value: string | null, def: number, min: number, max: number) => {
  const n = value ? Number.parseInt(value, 10) : Number.NaN;
  if (!Number.isFinite(n)) return def;
  return Math.max(min, Math.min(max, n));
};

export async function GET(req: Request) {
  const url = new URL(req.url);
  const take = clampInt(url.searchParams.get("take"), 100, 1, 200);
  const special = url.searchParams.get("special") === "1";

  const specialChars = [" ", ".", "|", "/", "[", "]", "(", ")", "{", "}", "‖", "-"] as const;
  const likeAny = (col: string) =>
    specialChars.map((ch) => `${col} LIKE '%${ch.replaceAll("'", "''")}%'`).join(" OR ");

  const whereSpecial = special
    ? `WHERE (w.phonetic_us IS NOT NULL AND (${likeAny("w.phonetic_us")})) OR (${likeAny("pw.meaning_fa_IPA")})`
    : "";

  const rows = (await prisma.$queryRawUnsafe(
    `
      SELECT w.id, w.base_form, w.phonetic_us, COALESCE(pw.canonical_text, '') AS meaning_fa,
        COALESCE(pw.meaning_fa_IPA, '') AS meaning_fa_IPA, w.phonetic_us_normalized,
        COALESCE(pw.meaning_fa_IPA_normalize, '') AS meaning_fa_IPA_normalized
      FROM word w
      LEFT JOIN persian_word pw ON pw.id = w.meaningId
      ${whereSpecial}
      ORDER BY RAND()
      LIMIT ?
    `,
    take
  )) as Array<{
    id: number;
    base_form: string;
    phonetic_us: string | null;
    phonetic_us_normalized: string | null;
    meaning_fa: string;
    meaning_fa_IPA: string;
    meaning_fa_IPA_normalized: string;
  }>;

  const data = rows.map((r) => ({
    id: r.id,
    base_form: r.base_form,
    phonetic_us: r.phonetic_us,
    phonetic_us_normalized: r.phonetic_us_normalized,
    meaning_fa: r.meaning_fa,
    meaning_fa_IPA: r.meaning_fa_IPA,
    meaning_fa_IPA_normalized: r.meaning_fa_IPA_normalized,
  }));

  return NextResponse.json({ take, special, rows: data });
}
