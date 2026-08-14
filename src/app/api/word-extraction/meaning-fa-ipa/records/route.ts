import "server-only";

import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { hydrateWordSensesWithPersianMeanings } from "@/lib/words/persianMeanings.server";
import { flattenWordSenseEnglishRelation, WORD_SENSE_ENGLISH_FIELDS_SELECT } from "@/lib/english/wordSenseEnglishFields.server";

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

    const rows = await prisma.wordSense.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        englishId: true,
        english: { select: WORD_SENSE_ENGLISH_FIELDS_SELECT },
        meaningId: true,
        otherMeaningIds: true,
      },
    });

    const items = await hydrateWordSensesWithPersianMeanings(rows.map(flattenWordSenseEnglishRelation));
    return NextResponse.json({ ok: true, items });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
