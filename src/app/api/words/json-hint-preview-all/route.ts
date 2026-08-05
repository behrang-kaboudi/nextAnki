import "server-only";

import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { pickPictureSymbolsForWord } from "@/lib/ipa/setPictures/setForAny";
import { normalizeJsonHintForCompare } from "@/lib/words/jsonHint";
import { hydrateWordsWithPersianMeanings } from "@/lib/words/persianMeanings.server";
import { flattenWordEnglishRelation, WORD_ENGLISH_FIELDS_SELECT } from "@/lib/english/wordEnglishFields.server";

export const runtime = "nodejs";

const clampInt = (value: string | null, def: number, min: number, max: number) => {
  const n = value ? Number.parseInt(value, 10) : Number.NaN;
  if (!Number.isFinite(n)) return def;
  return Math.max(min, Math.min(max, n));
};

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const cursorId = clampInt(url.searchParams.get("cursorId"), 0, 0, Number.MAX_SAFE_INTEGER);
    const scanBatch = clampInt(url.searchParams.get("scanBatch"), 400, 10, 2000);
    const takeChanged = clampInt(url.searchParams.get("takeChanged"), 50, 1, 200);
    const includeTotal = (() => {
      const raw = (url.searchParams.get("includeTotal") ?? "").trim().toLowerCase();
      return raw === "1" || raw === "true" || raw === "yes";
    })();

    const items: {
      id: number;
      anki_link_id: string;
      base_form: string;
      meaning_fa: string;
      json_hint: string | null;
      prevJson: string | null;
      nextJson: string | null;
      changed: boolean;
    }[] = [];

    const total = includeTotal ? await prisma.word.count() : null;
    const rows = await prisma.word.findMany({
      where: { id: { gt: cursorId } },
      orderBy: { id: "asc" },
      take: scanBatch,
      select: {
        id: true,
        anki_link_id: true,
        englishId: true,
        english: { select: WORD_ENGLISH_FIELDS_SELECT },
        meaningId: true,
        otherMeaningIds: true,
      },
    });

    if (rows.length === 0) {
      return NextResponse.json({
        ok: true,
        items,
        nextCursorId: cursorId,
        processed: 0,
        total,
        currentId: cursorId,
        done: true,
      });
    }

    const hydratedRows = await hydrateWordsWithPersianMeanings(rows.map(flattenWordEnglishRelation));
    let nextCursorId = cursorId;
    for (const row of hydratedRows) {
      nextCursorId = row.id;

      const match =
        (row.phonetic_us_normalized ?? "").trim() !== ""
          ? await pickPictureSymbolsForWord({ phonetic_us_normalized: row.phonetic_us_normalized, imageability: 64 }, { includePersianImage: false })
          : null;

      const nextComparable = match ? JSON.stringify(match) : null;
      const prevComparable = normalizeJsonHintForCompare(row.json_hint ?? null);
      const changed = prevComparable !== nextComparable;
      if (!changed) continue;

      items.push({
        id: row.id,
        anki_link_id: row.anki_link_id,
        base_form: row.base_form,
        meaning_fa: row.meaning_fa,
        json_hint: row.json_hint ?? null,
        prevJson: prevComparable,
        nextJson: nextComparable,
        changed,
      });

      if (items.length >= takeChanged) break;
    }

    return NextResponse.json({
      ok: true,
      items,
      nextCursorId,
      processed: rows.length,
      total,
      currentId: nextCursorId,
      done: rows.length === 0,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
