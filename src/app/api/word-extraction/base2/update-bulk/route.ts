import "server-only";

import { NextResponse } from "next/server";

import { normalizeIpaForDb } from "@/lib/ipa/normalize";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type PayloadItem = { id: number; phonetic_us: string; imageability: number };

const allowedKeys = ["id", "phonetic_us", "imageability"] as const;
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

function asImageability(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const i = Math.trunc(value);
  if (i < 0 || i > 100) return null;
  return i;
}

function validateItem(value: unknown): { ok: true; item: PayloadItem } | { ok: false; issues: string[] } {
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
  const phonetic_us = asNonEmptyString(value.phonetic_us);
  const imageability = asImageability(value.imageability);
  if (!id) issues.push("id must be a positive number");
  if (!phonetic_us) issues.push("phonetic_us must be a non-empty string");
  if (imageability === null) issues.push("imageability must be a number between 0 and 100");

  if (issues.length) return { ok: false, issues };
  return { ok: true, item: { id, phonetic_us, imageability } };
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
        { ok: false, error: "Invalid input items (must be exactly { id, phonetic_us, imageability })", errors },
        { status: 400 }
      );
    }

    let updated = 0;
    const results: Array<
      | { ok: true; id: number; phonetic_us_normalized: string; imageability: number }
      | { ok: false; id: number; error: string }
    > = [];

    for (const item of items) {
      try {
        const phonetic_us_normalized = normalizeIpaForDb(item.phonetic_us, 2000);
        const row = await prisma.word.update({
          where: { id: item.id },
          data: {
            phonetic_us: item.phonetic_us,
            phonetic_us_normalized,
            imageability: item.imageability,
          },
          select: { id: true },
        });
        updated += 1;
        results.push({
          ok: true,
          id: row.id,
          phonetic_us_normalized,
          imageability: item.imageability,
        });
      } catch (e) {
        results.push({ ok: false, id: item.id, error: e instanceof Error ? e.message : String(e) });
      }
    }

    return NextResponse.json({ ok: true, total: items.length, updated, results });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}

