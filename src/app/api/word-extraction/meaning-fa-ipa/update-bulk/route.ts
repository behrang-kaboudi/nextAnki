import "server-only";

import { NextResponse } from "next/server";

import { normalizeIpaForDb } from "@/lib/ipa/normalize";
import { prisma } from "@/lib/prisma";
import { touchWordsReferencingPersianWord } from "@/lib/words/persianMeanings.server";

export const runtime = "nodejs";

type PayloadItem = {
  id: number;
  meaning_fa_IPA: string;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object") return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

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

function validateItem(value: unknown): { ok: true; item: PayloadItem } | { ok: false; issues: string[] } {
  if (!isPlainObject(value)) return { ok: false, issues: ["Item must be an object"] };

  const keys = Object.keys(value);
  const allowed = ["id", "meaning_fa_IPA"];
  const issues: string[] = [];
  const extra = keys.filter((key) => !allowed.includes(key));
  const missing = allowed.filter((key) => !(key in value));

  if (extra.length) issues.push(`Extra field(s): ${extra.join(", ")}`);
  if (missing.length) issues.push(`Missing field(s): ${missing.join(", ")}`);

  const id = asPositiveInt(value.id);
  const meaning_fa_IPA = asNonEmptyString(value.meaning_fa_IPA);

  if (!id) issues.push("id must be a positive number");
  if (!meaning_fa_IPA) issues.push("meaning_fa_IPA must be a non-empty string");

  if (issues.length) return { ok: false, issues };

  return {
    ok: true,
    item: { id: id as number, meaning_fa_IPA: meaning_fa_IPA as string },
  };
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as unknown;
    if (!Array.isArray(body)) {
      return NextResponse.json(
        { ok: false, error: "Body must be an array of { id, meaning_fa_IPA }" },
        { status: 400 },
      );
    }

    const items: PayloadItem[] = [];
    const errors: Array<{ index: number; issues: string[] }> = [];
    const seen = new Set<number>();

    for (let i = 0; i < body.length; i++) {
      const validated = validateItem(body[i]);
      if (!validated.ok) {
        errors.push({ index: i, issues: validated.issues });
        continue;
      }
      if (seen.has(validated.item.id)) {
        errors.push({ index: i, issues: [`Duplicate id: ${validated.item.id}`] });
        continue;
      }
      seen.add(validated.item.id);
      items.push(validated.item);
    }

    if (errors.length) {
      return NextResponse.json(
        { ok: false, error: "Invalid input items (must be exactly { id, meaning_fa_IPA })", errors },
        { status: 400 },
      );
    }

    let updated = 0;
    const results: Array<
      | { ok: true; id: number; meaning_fa_IPA: string; meaning_fa_IPA_normalized: string }
      | { ok: false; id: number; error: string }
    > = [];

    for (const item of items) {
      try {
        const meaning_fa_IPA_normalized = normalizeIpaForDb(item.meaning_fa_IPA, 2000);
        const word = await prisma.word.findUnique({ where: { id: item.id }, select: { meaningId: true } });
        if (!word?.meaningId) throw new Error("Word has no primary PersianWord.");
        const row = await prisma.persianWord.update({
          where: { id: word.meaningId },
          data: { meaning_fa_IPA: item.meaning_fa_IPA, meaning_fa_IPA_normalize: meaning_fa_IPA_normalized },
          select: { id: true, meaning_fa_IPA: true, meaning_fa_IPA_normalize: true },
        });
        await touchWordsReferencingPersianWord(row.id);

        updated += 1;
        results.push({
          ok: true,
          id: row.id,
          meaning_fa_IPA: row.meaning_fa_IPA ?? "",
          meaning_fa_IPA_normalized: row.meaning_fa_IPA_normalize ?? "",
        });
      } catch (e) {
        results.push({ ok: false, id: item.id, error: e instanceof Error ? e.message : String(e) });
      }
    }

    return NextResponse.json({ ok: true, total: items.length, updated, results });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
