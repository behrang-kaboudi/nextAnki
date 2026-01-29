import "server-only";

import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type PayloadItem = {
  id: number;
  sentence_en_meaning_fa: string;
  pos: string;
  other_meanings_fa: string | null;
};

const allowedKeys = ["id", "sentence_en_meaning_fa", "pos", "other_meanings_fa"] as const;
const allowedKeySet = new Set<string>(allowedKeys);

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

function asNullableTrimmedStringAllowEmpty(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== "string") return null;
  return value.trim();
}

function validateItem(
  value: unknown,
): { ok: true; item: PayloadItem } | { ok: false; issues: string[] } {
  if (!isPlainObject(value)) return { ok: false, issues: ["Item must be an object"] };

  const keys = Object.keys(value);
  const issues: string[] = [];

  const extraKeys = keys.filter((k) => !allowedKeySet.has(k));
  if (extraKeys.length) issues.push(`Extra field(s): ${extraKeys.join(", ")}`);

  const missingKeys = allowedKeys.filter((k) => !(k in value));
  if (missingKeys.length) issues.push(`Missing field(s): ${missingKeys.join(", ")}`);

  if (keys.length !== allowedKeys.length) {
    issues.push(`Item must have exactly ${allowedKeys.length} fields`);
  }

  const id = asPositiveInt(value.id);
  const sentence_en_meaning_fa = asNonEmptyString(value.sentence_en_meaning_fa);
  const pos = asNonEmptyString(value.pos);
  const other_meanings_fa = asNullableTrimmedStringAllowEmpty(value.other_meanings_fa);

  if (!id) issues.push("id must be a positive number");
  if (!sentence_en_meaning_fa) issues.push("sentence_en_meaning_fa must be a non-empty string");
  if (!pos) issues.push("pos must be a non-empty string");
  if (other_meanings_fa === null && value.other_meanings_fa !== null) {
    issues.push("other_meanings_fa must be a string (can be empty) or null");
  }

  if (issues.length) return { ok: false, issues };

  return {
    ok: true,
    item: {
      id,
      sentence_en_meaning_fa,
      pos,
      other_meanings_fa,
    },
  };
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as unknown;
    if (!Array.isArray(body)) {
      return NextResponse.json({ ok: false, error: "Body must be an array" }, { status: 400 });
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
        {
          ok: false,
          error:
            "Invalid input items (must be exactly { id, sentence_en_meaning_fa, pos, other_meanings_fa })",
          errors,
        },
        { status: 400 },
      );
    }

    let updated = 0;
    const results: Array<
      | { ok: true; id: number }
      | { ok: false; id: number; error: string }
    > = [];

    for (const item of items) {
      try {
        const row = await prisma.word.update({
          where: { id: item.id },
          data: {
            sentence_en_meaning_fa: item.sentence_en_meaning_fa,
            pos: item.pos,
            other_meanings_fa: item.other_meanings_fa,
          },
          select: { id: true },
        });
        updated += 1;
        results.push({ ok: true, id: row.id });
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

