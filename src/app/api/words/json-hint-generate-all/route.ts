import "server-only";

import { NextResponse } from "next/server";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { generateEnglishWordJsonHints } from "@/lib/english/englishWordJsonHint.server";

export const runtime = "nodejs";

const clampInt = (
  value: string | null,
  def: number,
  min: number,
  max: number,
) => {
  const n = value ? Number.parseInt(value, 10) : Number.NaN;
  if (!Number.isFinite(n)) return def;
  return Math.max(min, Math.min(max, n));
};

export async function POST(req: Request) {
  try {
    const url = new URL(req.url);
    const q = String(url.searchParams.get("q") ?? "").trim();
    const cursorId = clampInt(
      url.searchParams.get("cursorId"),
      0,
      0,
      Number.MAX_SAFE_INTEGER,
    );
    const scanBatch = clampInt(url.searchParams.get("scanBatch"), 50, 10, 500);
    const includeTotal = (() => {
      const raw = (url.searchParams.get("includeTotal") ?? "")
        .trim()
        .toLowerCase();
      return raw === "1" || raw === "true" || raw === "yes";
    })();
    const onlyEmptyJsonHint = (() => {
      const raw = (url.searchParams.get("onlyEmptyJsonHint") ?? "")
        .trim()
        .toLowerCase();
      return raw === "1" || raw === "true" || raw === "yes";
    })();

    const whereParts: Prisma.EnglishWordWhereInput[] = [];
    if (q) {
      whereParts.push({
        OR: [
          { base_form: { contains: q } },
          {
            words: {
              some: { meaning: { is: { canonical_text: { contains: q } } } },
            },
          },
          { words: { some: { anki_link_id: { contains: q } } } },
        ],
      });
    }
    if (onlyEmptyJsonHint) {
      whereParts.push({
        OR: [{ json_hint: null }, { json_hint: "" }],
      });
    }

    const whereFilter = whereParts.length > 0 ? { AND: whereParts } : undefined;

    const total = includeTotal
      ? await prisma.englishWord.count({ where: whereFilter })
      : null;
    const rows = await prisma.englishWord.findMany({
      where: {
        AND: [{ id: { gt: cursorId } }, ...(whereFilter ? [whereFilter] : [])],
      },
      orderBy: { id: "asc" },
      take: scanBatch,
      select: {
        id: true,
        phonetic_us_normalized: true,
      },
    });

    if (rows.length === 0) {
      return NextResponse.json({
        ok: true,
        q,
        processed: 0,
        updated: 0,
        batchFirstId: null,
        batchLastId: null,
        nextCursorId: cursorId,
        done: true,
        tookMs: 0,
        total,
      });
    }

    const startedAt = Date.now();
    let nextCursorId = cursorId;
    const batchFirstId = rows[0]?.id ?? null;
    const processed = rows.length;
    const results = await generateEnglishWordJsonHints(rows);

    nextCursorId = rows[rows.length - 1]?.id ?? nextCursorId;

    const updated = results.filter((result) => result.jsonHint !== null).length;

    return NextResponse.json({
      ok: true,
      q,
      processed,
      updated,
      batchFirstId,
      batchLastId: nextCursorId,
      nextCursorId,
      done: rows.length < scanBatch,
      tookMs: Date.now() - startedAt,
      total,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
