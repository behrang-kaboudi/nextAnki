import "server-only";

import { NextResponse } from "next/server";

import type { Word } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { pickPictureSymbolsForPhoneticNormalized } from "@/lib/ipa/setPictures/setForAny";
import { normalizeJsonHintForCompare } from "@/lib/words/jsonHint";

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
      hint_sentence: string | null;
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
        base_form: true,
        meaning_fa: true,
        hint_sentence: true,
        phonetic_us_normalized: true,
        meaning_fa_IPA_normalized: true,
        imageability: true,
        json_hint: true,
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

    let nextCursorId = cursorId;
    for (const row of rows) {
      nextCursorId = row.id;

      const match =
        (row.phonetic_us_normalized ?? "").trim() !== ""
          ? await pickPictureSymbolsForPhoneticNormalized(row as unknown as Word)
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
        hint_sentence: row.hint_sentence,
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
