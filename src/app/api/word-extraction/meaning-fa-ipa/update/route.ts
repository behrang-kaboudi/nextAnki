import "server-only";

import { NextResponse } from "next/server";

import { normalizeIpaForDb } from "@/lib/ipa/normalize";
import { prisma } from "@/lib/prisma";
import { touchWordsReferencingPersianWord } from "@/lib/words/persianMeanings.server";

export const runtime = "nodejs";

function asPositiveInt(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const i = Math.floor(value);
  return i > 0 ? i : null;
}

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as unknown;
    const id = asPositiveInt((body as { id?: unknown } | null)?.id);
    const meaning_fa_IPA = asNonEmptyString((body as { meaning_fa_IPA?: unknown } | null)?.meaning_fa_IPA);
    if (!id || !meaning_fa_IPA) {
      return NextResponse.json({ ok: false, error: "Body must include { id: number, meaning_fa_IPA: string }" }, { status: 400 });
    }

    const meaning_fa_IPA_normalized = normalizeIpaForDb(meaning_fa_IPA, 2000);

    const word = await prisma.word.findUnique({ where: { id }, select: { meaningId: true } });
    if (!word?.meaningId) return NextResponse.json({ ok: false, error: "Word has no primary PersianWord." }, { status: 409 });
    const updated = await prisma.persianWord.update({ where: { id: word.meaningId }, data: { meaning_fa_IPA, meaning_fa_IPA_normalize: meaning_fa_IPA_normalized }, select: { id: true, meaning_fa_IPA: true, meaning_fa_IPA_normalize: true } });
    await touchWordsReferencingPersianWord(updated.id);

    return NextResponse.json({ ok: true, item: { id, meaning_fa_IPA: updated.meaning_fa_IPA, meaning_fa_IPA_normalized: updated.meaning_fa_IPA_normalize } });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
