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

function asImageability(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const i = Math.trunc(value);
  if (i < 0 || i > 100) return null;
  return i;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as unknown;
    const id = asPositiveInt((body as { id?: unknown } | null)?.id);
    const phonetic_us = asNonEmptyString((body as { phonetic_us?: unknown } | null)?.phonetic_us);
    const imageability = asImageability((body as { imageability?: unknown } | null)?.imageability);
    if (!id || !phonetic_us || imageability === null) {
      return NextResponse.json(
        { ok: false, error: "Body must include { id: number, phonetic_us: string, imageability: number(0-100) }" },
        { status: 400 },
      );
    }

    const phonetic_us_normalized = normalizeIpaForDb(phonetic_us, 2000);

    const updated = await prisma.word.update({
      where: { id },
      data: { phonetic_us, phonetic_us_normalized, imageability },
      select: { id: true, phonetic_us: true, phonetic_us_normalized: true, imageability: true },
    });

    return NextResponse.json({ ok: true, item: updated });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}

