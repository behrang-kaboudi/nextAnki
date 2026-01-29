import "server-only";

import { NextResponse } from "next/server";

import { normalizeIpaForDb } from "@/lib/ipa/normalize";
import { prisma } from "@/lib/prisma";

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

    const updated = await prisma.word.update({
      where: { id },
      data: { meaning_fa_IPA, meaning_fa_IPA_normalized },
      select: { id: true, meaning_fa_IPA: true, meaning_fa_IPA_normalized: true },
    });

    return NextResponse.json({ ok: true, item: updated });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}

