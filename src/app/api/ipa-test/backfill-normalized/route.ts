import "server-only";

import { NextResponse } from "next/server";

import { normalizeIpaForDb } from "@/lib/ipa/normalize";
import { prisma } from "@/lib/prisma";

const clampInt = (value: string | null, def: number, min: number, max: number) => {
  const n = value ? Number.parseInt(value, 10) : Number.NaN;
  if (!Number.isFinite(n)) return def;
  return Math.max(min, Math.min(max, n));
};

const computeNormalized = (ipa: string) => normalizeIpaForDb(ipa, 2000);

export async function POST(req: Request) {
  const url = new URL(req.url);
  const batch = clampInt(url.searchParams.get("batch"), 500, 1, 2000);
  const startId = clampInt(url.searchParams.get("startId"), 0, 0, Number.MAX_SAFE_INTEGER);

  const rows = await prisma.word.findMany({
    where: { id: { gt: startId } },
    orderBy: { id: "asc" },
    take: batch,
    select: {
      id: true,
      phonetic_us: true,
      phonetic_us_normalized: true,
      meaning_fa_IPA: true,
      meaning_fa_IPA_normalized: true,
    },
  });

  let updated = 0;
  let lastId = startId;

  for (const r of rows) {
    lastId = r.id;
    const phonNorm = r.phonetic_us ? computeNormalized(r.phonetic_us) : null;
    const meaningNorm = computeNormalized(r.meaning_fa_IPA);

    const needsUpdate =
      (r.phonetic_us_normalized ?? null) !== (phonNorm ?? null) || r.meaning_fa_IPA_normalized !== meaningNorm;

    if (!needsUpdate) continue;

    await prisma.word.update({
      where: { id: r.id },
      data: {
        phonetic_us_normalized: phonNorm,
        meaning_fa_IPA_normalized: meaningNorm,
      },
    });
    updated++;
  }

  return NextResponse.json({
    batch,
    processed: rows.length,
    updated,
    nextStartId: rows.length ? lastId : startId,
    done: rows.length === 0,
  });
}
