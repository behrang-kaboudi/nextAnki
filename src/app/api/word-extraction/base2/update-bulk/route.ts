import "server-only";

import { NextResponse } from "next/server";

import { normalizeIpaForDb } from "@/lib/ipa/normalize";
import { updateWord } from "@/lib/words/wordRepo";

export const runtime = "nodejs";

type PayloadItem = {
  id: number;
  phonetic_us?: string;
  imageability?: number;
  learning_depth?: number;
  productive_target?: number;
  pos?: string;
  other_meanings_fa?: string | null;
  concept_explained_fa?: string;
};

const requiredKeys = ["id"] as const;
const optionalKeys = [
  "phonetic_us",
  "imageability",
  "learning_depth",
  "productive_target",
  "pos",
  "other_meanings_fa",
  "concept_explained_fa",
] as const;
const allowedKeySet = new Set<string>([...requiredKeys, ...optionalKeys]);

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

function asLearningDepth(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (value === -100) return -100;
  if (value < 0 || value > 1) return null;
  return value;
}

function asProductiveTarget(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isInteger(value)) return null;
  if (value < 0 || value > 101) return null;
  return value;
}

function asNullableTrimmedStringAllowEmpty(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== "string") return null;
  return value.trim();
}

function validateItem(value: unknown): { ok: true; item: PayloadItem } | { ok: false; issues: string[] } {
  if (!isPlainObject(value)) return { ok: false, issues: ["Item must be an object"] };

  const keys = Object.keys(value);
  const issues: string[] = [];

  const extraKeys = keys.filter((k) => !allowedKeySet.has(k));
  if (extraKeys.length) issues.push(`Extra field(s): ${extraKeys.join(", ")}`);

  const missingKeys = requiredKeys.filter((k) => !(k in value));
  if (missingKeys.length) issues.push(`Missing field(s): ${missingKeys.join(", ")}`);

  if (keys.length < requiredKeys.length + 1) {
    issues.push("Item must include at least one updatable field besides id");
  }

  const id = asPositiveInt(value.id);
  if (!id) issues.push("id must be a positive number");

  const hasPhoneticUs = "phonetic_us" in value;
  const phonetic_us = hasPhoneticUs ? asNonEmptyString((value as Record<string, unknown>).phonetic_us) : undefined;
  if (hasPhoneticUs && !phonetic_us) issues.push("phonetic_us must be a non-empty string");

  const hasImageability = "imageability" in value;
  const imageability = hasImageability ? asImageability((value as Record<string, unknown>).imageability) : undefined;
  if (hasImageability && imageability === null) issues.push("imageability must be a number between 0 and 100");

  const hasLearningDepth = "learning_depth" in value;
  const learning_depth = hasLearningDepth
    ? asLearningDepth((value as Record<string, unknown>).learning_depth)
    : undefined;
  if (hasLearningDepth && learning_depth === null) issues.push("learning_depth must be -100 or a number between 0 and 1");

  const hasProductiveTarget = "productive_target" in value;
  const productive_target = hasProductiveTarget
    ? asProductiveTarget((value as Record<string, unknown>).productive_target)
    : undefined;
  if (hasProductiveTarget && productive_target === null) {
    issues.push("productive_target must be an integer between 0 and 101");
  }

  const hasPos = "pos" in value;
  const pos = hasPos ? asNonEmptyString((value as Record<string, unknown>).pos) : undefined;
  if (hasPos && !pos) issues.push("pos must be a non-empty string");

  const hasOtherMeanings = "other_meanings_fa" in value;
  const other_meanings_fa = hasOtherMeanings
    ? asNullableTrimmedStringAllowEmpty((value as Record<string, unknown>).other_meanings_fa)
    : undefined;
  if (hasOtherMeanings && other_meanings_fa === null && (value as Record<string, unknown>).other_meanings_fa !== null) {
    issues.push("other_meanings_fa must be a string (can be empty) or null");
  }

  const hasConceptExplainedFa = "concept_explained_fa" in value;
  const concept_explained_fa = hasConceptExplainedFa
    ? asNonEmptyString((value as Record<string, unknown>).concept_explained_fa)
    : undefined;
  if (hasConceptExplainedFa && !concept_explained_fa) {
    issues.push("concept_explained_fa must be a non-empty string");
  }

  if (issues.length) return { ok: false, issues };
  if (!id) return { ok: false, issues: ["Invalid input"] };

  return {
    ok: true,
    item: {
      id,
      ...(phonetic_us == null ? {} : { phonetic_us }),
      ...(imageability == null ? {} : { imageability }),
      ...(learning_depth == null ? {} : { learning_depth }),
      ...(productive_target == null ? {} : { productive_target }),
      ...(pos == null ? {} : { pos }),
      ...(other_meanings_fa === undefined ? {} : { other_meanings_fa }),
      ...(concept_explained_fa == null ? {} : { concept_explained_fa }),
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
            "Invalid input items (must be { id } plus one or more of: phonetic_us, imageability, learning_depth, productive_target, pos, other_meanings_fa, concept_explained_fa)",
          errors,
        },
        { status: 400 }
      );
    }

    let updated = 0;
    const results: Array<
      | {
          ok: true;
          id: number;
          phonetic_us_normalized?: string;
          imageability?: number;
          learning_depth?: number;
          productive_target?: number;
          pos?: string;
          other_meanings_fa?: string | null;
          concept_explained_fa?: string;
        }
      | { ok: false; id: number; error: string }
    > = [];

    for (const item of items) {
      try {
        const patch: Record<string, unknown> = {};
        let phonetic_us_normalized: string | undefined;

        if (item.phonetic_us !== undefined) {
          phonetic_us_normalized = normalizeIpaForDb(item.phonetic_us, 2000);
          patch.phonetic_us = item.phonetic_us;
          patch.phonetic_us_normalized = phonetic_us_normalized;
        }
        if (item.imageability !== undefined) patch.imageability = item.imageability;
        if (item.learning_depth !== undefined) patch.learning_depth = item.learning_depth;
        if (item.productive_target !== undefined) patch.productive_target = item.productive_target;
        if (item.pos !== undefined) patch.pos = item.pos;
        if (item.other_meanings_fa !== undefined) patch.other_meanings_fa = item.other_meanings_fa;
        if (item.concept_explained_fa !== undefined) patch.concept_explained_fa = item.concept_explained_fa;

        const row = await updateWord({
          where: { id: item.id },
          data: {
            ...patch,
          },
          select: { id: true },
        });
        updated += 1;
        results.push({
          ok: true,
          id: row.id,
          ...(phonetic_us_normalized === undefined ? {} : { phonetic_us_normalized }),
          ...(item.imageability === undefined ? {} : { imageability: item.imageability }),
          ...(item.learning_depth === undefined ? {} : { learning_depth: item.learning_depth }),
          ...(item.productive_target === undefined ? {} : { productive_target: item.productive_target }),
          ...(item.pos === undefined ? {} : { pos: item.pos }),
          ...(item.other_meanings_fa === undefined ? {} : { other_meanings_fa: item.other_meanings_fa }),
          ...(item.concept_explained_fa === undefined ? {} : { concept_explained_fa: item.concept_explained_fa }),
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
