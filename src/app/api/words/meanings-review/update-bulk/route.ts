import { NextResponse } from "next/server";

import { addPersianWord } from "@/lib/tables/persianWord";
import { updateWord } from "@/lib/words/wordRepo";

export const runtime = "nodejs";

type Correction = { id: number; meaning_fa: string; other_meanings_fa: string[] };

function parse(value: unknown): { ids: number[]; corrections: Correction[] } | null {
  if (!value || typeof value !== "object") return null;
  const body = value as Record<string, unknown>;
  if (Object.keys(body).length !== 2 || !Array.isArray(body.ids) || !Array.isArray(body.corrections)) return null;
  const ids = body.ids;
  if (!ids.length || ids.some((id) => typeof id !== "number" || !Number.isSafeInteger(id) || id <= 0) || new Set(ids).size !== ids.length) return null;
  const seen = new Set<number>();
  const corrections: Correction[] = [];
  for (const row of body.corrections) {
    if (!row || typeof row !== "object") return null;
    const item = row as Record<string, unknown>;
    if (Object.keys(item).length !== 3 || typeof item.id !== "number" || !Number.isSafeInteger(item.id) || typeof item.meaning_fa !== "string" || !Array.isArray(item.other_meanings_fa) || !item.meaning_fa.trim() || seen.has(item.id) || item.other_meanings_fa.some((meaning) => typeof meaning !== "string" || !meaning.trim())) return null;
    seen.add(item.id); corrections.push({ id: item.id, meaning_fa: item.meaning_fa.trim(), other_meanings_fa: item.other_meanings_fa.map((meaning) => (meaning as string).trim()) });
  }
  return corrections.every((item) => ids.includes(item.id)) ? { ids, corrections } : null;
}

export async function POST(request: Request) {
  const body = parse(await request.json().catch(() => null));
  if (!body) return NextResponse.json({ ok: false, error: "Body must be { ids: number[], corrections: { id, meaning_fa, other_meanings_fa }[] }." }, { status: 400 });
  const corrections = new Map(body.corrections.map((item) => [item.id, item]));
  const results: Array<{ id: number; ok: boolean; error?: string }> = [];
  for (const id of body.ids) {
    try {
      const correction = corrections.get(id);
      if (correction) {
        const primary = await addPersianWord(correction.meaning_fa);
        const otherIds = await Promise.all(correction.other_meanings_fa.filter((meaning) => meaning !== correction.meaning_fa).map(async (meaning) => (await addPersianWord(meaning)).item.id));
        await updateWord({ where: { id }, data: { meaningId: primary.item.id, otherMeaningIds: [...new Set(otherIds.filter((otherId) => otherId !== primary.item.id))], meanings_confirmed: true }, select: { id: true } });
      } else {
        await updateWord({ where: { id }, data: { meanings_confirmed: true }, select: { id: true } });
      }
      results.push({ id, ok: true });
    } catch (error) { results.push({ id, ok: false, error: error instanceof Error ? error.message : String(error) }); }
  }
  return NextResponse.json({ ok: true, total: body.ids.length, updated: results.filter((result) => result.ok).length, results });
}
