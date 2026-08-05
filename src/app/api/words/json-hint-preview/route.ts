import "server-only";

import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { pickPictureSymbolsForWord } from "@/lib/ipa/setPictures/setForAny";
import { normalizeJsonHintForCompare } from "@/lib/words/jsonHint";

export const runtime = "nodejs";

function asPositiveInt(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const i = Math.floor(value);
  return i > 0 ? i : null;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as unknown;
    const idsRaw = (body as { ids?: unknown } | null)?.ids;
    if (!Array.isArray(idsRaw)) {
      return NextResponse.json({ ok: false, error: "Body must include { ids: number[] }" }, { status: 400 });
    }

    const ids = idsRaw.map(asPositiveInt).filter((n): n is number => Boolean(n));
    if (ids.length === 0) {
      return NextResponse.json({ ok: false, error: "No valid ids" }, { status: 400 });
    }

    const rows = await prisma.word.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        english: { select: { phonetic_us_normalized: true, json_hint: true } },
      },
    });

    const items: {
      id: number;
      prevJson: string | null;
      nextJson: string | null;
      changed: boolean;
    }[] = [];

    for (const row of rows) {
      const match =
        (row.english.phonetic_us_normalized ?? "").trim() !== ""
          ? await pickPictureSymbolsForWord({ phonetic_us_normalized: row.english.phonetic_us_normalized, imageability: 64 }, { includePersianImage: false })
          : null;

      const nextComparable = match ? JSON.stringify(match) : null;
      const prevComparable = normalizeJsonHintForCompare(row.english.json_hint ?? null);
      items.push({
        id: row.id,
        prevJson: prevComparable,
        nextJson: nextComparable,
        changed: prevComparable !== nextComparable,
      });
    }

    return NextResponse.json({ ok: true, items });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
