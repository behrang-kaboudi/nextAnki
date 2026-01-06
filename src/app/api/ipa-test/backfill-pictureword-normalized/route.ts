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
  try {
    const url = new URL(req.url);
    const batch = clampInt(url.searchParams.get("batch"), 500, 1, 2000);
    const startId = clampInt(url.searchParams.get("startId"), 0, 0, Number.MAX_SAFE_INTEGER);

    // Use raw SQL to avoid Prisma Client being stale during dev when schema changes.
    const rows = (await prisma.$queryRawUnsafe(
      `
        SELECT id, ipa_fa, ipa_fa_normalized
        FROM PictureWord
        WHERE id > ?
        ORDER BY id ASC
        LIMIT ?
      `,
      startId,
      batch,
    )) as Array<{ id: number; ipa_fa: string; ipa_fa_normalized: string }>;

    let updated = 0;
    let lastId = startId;

    for (const r of rows) {
      lastId = r.id;
      const norm = computeNormalized(r.ipa_fa ?? "");
      if ((r.ipa_fa_normalized ?? "") === norm) continue;

      await prisma.$executeRawUnsafe(`UPDATE PictureWord SET ipa_fa_normalized = ? WHERE id = ?`, norm, r.id);
      updated++;
    }

    return NextResponse.json({
      batch,
      processed: rows.length,
      updated,
      nextStartId: rows.length ? lastId : startId,
      done: rows.length === 0,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
