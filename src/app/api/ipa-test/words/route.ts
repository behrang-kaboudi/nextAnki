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
    ? `WHERE (phonetic_us IS NOT NULL AND (${likeAny("phonetic_us")})) OR (${likeAny("meaning_fa_IPA")})`
    : "";

  const rows = (await prisma.$queryRawUnsafe(
    `
      SELECT id, base_form, phonetic_us, meaning_fa, meaning_fa_IPA, phonetic_us_normalized, meaning_fa_IPA_normalized
      FROM Word
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
