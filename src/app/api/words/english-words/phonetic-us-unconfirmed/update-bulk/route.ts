import { NextResponse } from "next/server";

import { normalizeIpaForDb } from "@/lib/ipa/normalize";
import { prisma } from "@/lib/prisma";
import { touchWordsByEnglishIds } from "@/lib/words/wordRepo";

export const runtime = "nodejs";

type Item = { id: number; phonetic_us: string };

function parseItems(value: unknown): Item[] | null {
  if (!Array.isArray(value)) return null;
  const seen = new Set<number>();
  const items: Item[] = [];
  for (const row of value) {
    if (!row || typeof row !== "object") return null;
    const item = row as Record<string, unknown>;
    if (Object.keys(item).length !== 2 || !("id" in item) || !("phonetic_us" in item)) return null;
    const id = item.id;
    const phonetic_us = typeof item.phonetic_us === "string" ? item.phonetic_us.trim() : "";
    if (typeof id !== "number" || !Number.isSafeInteger(id) || id <= 0 || !phonetic_us || seen.has(id)) return null;
    seen.add(id);
    items.push({ id, phonetic_us });
  }
  return items;
}

export async function POST(request: Request) {
  const items = parseItems(await request.json().catch(() => null));
  if (!items) return NextResponse.json({ ok: false, error: "Body must be an array of exact { id, phonetic_us } items." }, { status: 400 });

  const results: Array<{ ok: boolean; id: number; phonetic_us?: string; error?: string }> = [];
  const updatedIds: number[] = [];
  for (const item of items) {
    try {
      const changed = await prisma.englishWord.updateMany({
        where: { id: item.id, phonetic_us_confirmed: false, OR: [{ phonetic_us: null }, { phonetic_us: "" }] },
        data: {
          phonetic_us: item.phonetic_us,
          phonetic_us_normalized: normalizeIpaForDb(item.phonetic_us, 2000) || null,
          phonetic_us_confirmed: false,
          json_hint: null,
        },
      });
      if (changed.count !== 1) throw new Error("EnglishWord was not found or is already confirmed.");
      updatedIds.push(item.id);
      results.push({ ok: true, id: item.id, phonetic_us: item.phonetic_us });
    } catch (error) {
      results.push({ ok: false, id: item.id, error: error instanceof Error ? error.message : String(error) });
    }
  }
  if (updatedIds.length) await touchWordsByEnglishIds(updatedIds);
  return NextResponse.json({ ok: true, total: items.length, updated: updatedIds.length, results });
}
