import { NextResponse } from "next/server";

import { normalizeIpaForDb } from "@/lib/ipa/normalize";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type Item = { id: number; meaning_fa_IPA: string };

function parseItems(value: unknown): Item[] | null {
  if (!Array.isArray(value)) return null;
  const seen = new Set<number>();
  const items: Item[] = [];
  for (const row of value) {
    if (!row || typeof row !== "object") return null;
    const object = row as Record<string, unknown>;
    if (Object.keys(object).length !== 2 || !("id" in object) || !("meaning_fa_IPA" in object)) return null;
    const id = object.id;
    const meaning = typeof object.meaning_fa_IPA === "string" ? object.meaning_fa_IPA.trim() : "";
    if (typeof id !== "number" || !Number.isSafeInteger(id) || id <= 0 || !meaning || seen.has(id)) return null;
    seen.add(id); items.push({ id, meaning_fa_IPA: meaning });
  }
  return items;
}

export async function POST(request: Request) {
  const items = parseItems(await request.json().catch(() => null));
  if (!items) return NextResponse.json({ ok: false, error: "Body must be an array of exact { id, meaning_fa_IPA } items." }, { status: 400 });
  const results: Array<{ ok: boolean; id: number; meaning_fa_IPA?: string | null; meaning_fa_IPA_normalize?: string | null; error?: string }> = [];
  for (const item of items) {
    try {
      const normalized = normalizeIpaForDb(item.meaning_fa_IPA, 2000);
      const row = await prisma.persianWord.update({ where: { id: item.id }, data: { meaning_fa_IPA: item.meaning_fa_IPA, meaning_fa_IPA_normalize: normalized }, select: { id: true, meaning_fa_IPA: true, meaning_fa_IPA_normalize: true } });
      results.push({ ok: true, ...row });
    } catch (error) { results.push({ ok: false, id: item.id, error: error instanceof Error ? error.message : String(error) }); }
  }
  return NextResponse.json({ ok: true, total: items.length, updated: results.filter((result) => result.ok).length, results });
}
