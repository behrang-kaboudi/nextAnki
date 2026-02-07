import "server-only";

import { NextResponse } from "next/server";

import { Prisma, type Word } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { pickPictureSymbolsForWord } from "@/lib/ipa/setPictures/setForAny";
import { normalizeJsonHintForCompare, stringifyJsonHintWithTimestamp } from "@/lib/words/jsonHint";

export const runtime = "nodejs";

const clampInt = (value: string | null, def: number, min: number, max: number) => {
  const n = value ? Number.parseInt(value, 10) : Number.NaN;
  if (!Number.isFinite(n)) return def;
  return Math.max(min, Math.min(max, n));
};

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const limit = Math.max(1, Math.floor(concurrency));
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const current = nextIndex;
      nextIndex += 1;
      if (current >= items.length) return;
      results[current] = await fn(items[current]!, current);
    }
  });

  await Promise.all(workers);
  return results;
}

export async function POST(req: Request) {
  try {
    const url = new URL(req.url);
    const q = String(url.searchParams.get("q") ?? "").trim();
    const cursorId = clampInt(url.searchParams.get("cursorId"), 0, 0, Number.MAX_SAFE_INTEGER);
    const scanBatch = clampInt(url.searchParams.get("scanBatch"), 50, 10, 500);
    const includeTotal = (() => {
      const raw = (url.searchParams.get("includeTotal") ?? "").trim().toLowerCase();
      return raw === "1" || raw === "true" || raw === "yes";
    })();

    const whereFilter = q
      ? {
          OR: [
            { base_form: { contains: q } },
            { meaning_fa: { contains: q } },
            { anki_link_id: { contains: q } },
          ],
        }
      : undefined;

    const total = includeTotal ? await prisma.word.count({ where: whereFilter }) : null;
    const rows = await prisma.word.findMany({
      where: { AND: [{ id: { gt: cursorId } }, ...(whereFilter ? [whereFilter] : [])] },
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
    const concurrency = 20;

    const computed = await mapWithConcurrency(
      rows,
      concurrency,
      async (row): Promise<{ id: number; json_hint: string | null } | null> => {
        const match =
          (row.phonetic_us_normalized ?? "").trim() !== ""
            ? await pickPictureSymbolsForWord(row as unknown as Word)
            : null;

        const nextComparable = match ? JSON.stringify(match) : null;
        const prevComparable = normalizeJsonHintForCompare(row.json_hint ?? null);
        const changed = prevComparable !== nextComparable;
        if (!changed) return null;

        const nextJson = match ? stringifyJsonHintWithTimestamp(match) : null;
        return { id: row.id, json_hint: nextJson };
      }
    );

    const updates = computed.filter(
      (u): u is { id: number; json_hint: string | null } => u !== null,
    );

    nextCursorId = rows[rows.length - 1]?.id ?? nextCursorId;

    let updated = 0;
    if (updates.length) {
      const ids = updates.map((u) => u.id);
      const cases = updates.map((u) => Prisma.sql`WHEN ${u.id} THEN ${u.json_hint}`);

      updated = await prisma.$executeRaw(
        Prisma.sql`
          UPDATE \`Word\`
          SET json_hint = CASE id
            ${Prisma.join(cases, " ")}
            ELSE json_hint
          END
          WHERE id IN (${Prisma.join(ids)})
        `
      );
    }

    return NextResponse.json({
      ok: true,
      q,
      processed,
      updated: Number.isFinite(updated) ? updated : updates.length,
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
      { status: 500 }
    );
  }
}
