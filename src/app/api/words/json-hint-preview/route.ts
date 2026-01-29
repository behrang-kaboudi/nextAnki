import "server-only";

import { NextResponse } from "next/server";

import type { Word } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { pickPictureSymbolsForPhoneticNormalized } from "@/lib/ipa/setPictures/setForAny";
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
        phonetic_us_normalized: true,
        meaning_fa_IPA_normalized: true,
        imageability: true,
        json_hint: true,
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
        (row.phonetic_us_normalized ?? "").trim() !== ""
          ? await pickPictureSymbolsForPhoneticNormalized(row as unknown as Word)
          : null;

      const nextComparable = match ? JSON.stringify(match) : null;
      const prevComparable = normalizeJsonHintForCompare(row.json_hint ?? null);
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
