import "server-only";

import { NextResponse } from "next/server";

import type { Word } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { pickPictureSymbolsForPhoneticNormalized } from "@/lib/ipa/setPictures/setForAny";

const clampInt = (value: string | null, def: number, min: number, max: number) => {
  const n = value ? Number.parseInt(value, 10) : Number.NaN;
  if (!Number.isFinite(n)) return def;
  return Math.max(min, Math.min(max, n));
};

const parseBool = (value: string | null, def: boolean) => {
  if (value === null) return def;
  const s = value.trim().toLowerCase();
  if (!s) return def;
  return s === "1" || s === "true" || s === "yes";
};

export async function POST(req: Request) {
  try {
    const url = new URL(req.url);
    const batch = clampInt(url.searchParams.get("batch"), 200, 1, 2000);
    const startId = clampInt(
      url.searchParams.get("startId"),
      0,
      0,
      Number.MAX_SAFE_INTEGER
    );
    const onlyEmpty = parseBool(url.searchParams.get("onlyEmpty"), true);
    const dryRun = parseBool(url.searchParams.get("dryRun"), false);

    const where = onlyEmpty
      ? { OR: [{ json_hint: null }, { json_hint: "" }] }
      : undefined;

    const rows = await prisma.word.findMany({
      where: {
        id: { gt: startId },
        ...(where ? where : {}),
      },
      orderBy: { id: "asc" },
      take: batch,
      select: {
        id: true,
        phonetic_us_normalized: true,
        meaning_fa_IPA_normalized: true,
        imageability: true,
        json_hint: true,
      },
    });

    let updated = 0;
    let lastId = startId;

    for (const row of rows) {
      lastId = row.id;

      const match =
        (row.phonetic_us_normalized ?? "").trim() !== ""
          ? await pickPictureSymbolsForPhoneticNormalized(row as unknown as Word)
          : null;

      const nextJson = match ? JSON.stringify(match) : null;
      const prevJson =
        (row.json_hint ?? null) === "" ? null : row.json_hint ?? null;
      const needsUpdate = prevJson !== nextJson;
      if (!needsUpdate) continue;

      if (!dryRun) {
        await prisma.word.update({
          where: { id: row.id },
          data: { json_hint: nextJson },
        });
      }
      updated += 1;
    }

    return NextResponse.json({
      batch,
      processed: rows.length,
      updated,
      nextStartId: rows.length ? lastId : startId,
      done: rows.length === 0,
      onlyEmpty,
      dryRun,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
