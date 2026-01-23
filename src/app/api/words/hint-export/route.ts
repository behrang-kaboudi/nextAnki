import "server-only";

import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

function parsePositiveInt(value: string | null, fallback: number) {
  const n = value ? Number(value) : Number.NaN;
  if (!Number.isFinite(n)) return fallback;
  const i = Math.floor(n);
  return i > 0 ? i : fallback;
}

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function extractPersianImageFa(jsonHint: unknown): string | null {
  if (jsonHint == null) return null;

  let obj: unknown = null;
  if (typeof jsonHint === "string") {
    const raw = jsonHint.trim();
    if (!raw) return null;
    try {
      obj = JSON.parse(raw) as unknown;
    } catch {
      return null;
    }
  } else if (typeof jsonHint === "object") {
    obj = jsonHint;
  } else {
    return null;
  }

  const persianImageFa = (obj as { persianImage?: { fa?: unknown } | null } | null)?.persianImage
    ?.fa;
  return asNonEmptyString(persianImageFa);
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const q = String(url.searchParams.get("q") ?? "").trim();
    const takeRaw = parsePositiveInt(url.searchParams.get("take"), 50);
    const take = Math.min(Math.max(takeRaw, 1), 500);

    const where = q
      ? {
          OR: [
            { base_form: { contains: q } },
            { meaning_fa: { contains: q } },
            { anki_link_id: { contains: q } },
          ],
        }
      : undefined;

    const rows = await prisma.word.findMany({
      where,
      orderBy: [{ id: "desc" }],
      take,
      select: {
        id: true,
        meaning_fa: true,
        json_hint: true,
        hint_sentence: true,
      },
    });

    const items = rows
      .filter((r) => !asNonEmptyString(r.hint_sentence))
      .map((r) => {
      const words: string[] = [];
      const img = extractPersianImageFa(r.json_hint);
      if (img) words.push(img);
      const meaning = asNonEmptyString(r.meaning_fa);
      if (meaning) words.push(meaning);
      return { id: r.id, words };
    });

    return NextResponse.json({ ok: true, take, q, items });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
