import { NextResponse } from "next/server";

import { normalizeIpaForDb } from "@/lib/ipa/normalize";
import { prisma } from "@/lib/prisma";
import { touchWordsByEnglishIds } from "@/lib/words/wordRepo";

export const runtime = "nodejs";

type Correction = { id: number; phonetic_us: string };

function parseCorrections(value: unknown): Correction[] | null {
  if (!Array.isArray(value)) return null;
  const seen = new Set<number>();
  const items: Correction[] = [];
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
  const body = await request.json().catch(() => null);
  const value = body && typeof body === "object" ? body as Record<string, unknown> : null;
  const ids = Array.isArray(value?.ids) ? value.ids : null;
  const corrections = parseCorrections(value?.corrections);
  if (!value || Object.keys(value).length !== 2 || !ids || !corrections) return NextResponse.json({ ok: false, error: "Body must be { ids: number[], corrections: { id, phonetic_us }[] }." }, { status: 400 });
  const uniqueIds = [...new Set(ids)];
  if (!uniqueIds.length || uniqueIds.length !== ids.length || uniqueIds.some((id) => typeof id !== "number" || !Number.isSafeInteger(id) || id <= 0)) return NextResponse.json({ ok: false, error: "ids must contain valid unique positive integers." }, { status: 400 });
  const correctionById = new Map(corrections.map((item) => [item.id, item]));
  if (corrections.some((item) => !uniqueIds.includes(item.id))) return NextResponse.json({ ok: false, error: "Every correction id must be included in ids." }, { status: 400 });

  const results: Array<{ ok: boolean; id: number; phonetic_us?: string; phonetic_us_confirmed?: boolean; error?: string }> = [];
  const updatedIds: number[] = [];
  const rows = await prisma.englishWord.findMany({
    where: { id: { in: uniqueIds }, phonetic_us_confirmed: false, AND: [{ phonetic_us: { not: null } }, { phonetic_us: { not: "" } }] },
    select: { id: true, phonetic_us: true },
  });
  const currentById = new Map(rows.map((row) => [row.id, row]));
  for (const id of uniqueIds) {
    try {
      const current = currentById.get(id);
      if (!current?.phonetic_us) throw new Error("EnglishWord was not found, has no phonetic_us, or is already confirmed.");
      const correction = correctionById.get(id);
      const changed = await prisma.englishWord.updateMany({
        where: { id, phonetic_us_confirmed: false },
        data: correction
          ? { phonetic_us: correction.phonetic_us, phonetic_us_normalized: normalizeIpaForDb(correction.phonetic_us, 2000) || null, phonetic_us_confirmed: true, json_hint: null }
          : { phonetic_us_confirmed: true },
      });
      if (changed.count !== 1) throw new Error("EnglishWord was not found or is already confirmed.");
      updatedIds.push(id);
      results.push({ ok: true, id, phonetic_us: correction?.phonetic_us ?? current.phonetic_us, phonetic_us_confirmed: true });
    } catch (error) {
      results.push({ ok: false, id, error: error instanceof Error ? error.message : String(error) });
    }
  }
  if (updatedIds.length) await touchWordsByEnglishIds(updatedIds);
  return NextResponse.json({ ok: true, total: uniqueIds.length, updated: updatedIds.length, results });
}
