import "server-only";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const CLEARABLE_FIELDS = [
  "imageability",
  "phonetic_us",
  "phonetic_us_normalized",
  "pos",
  "concept_explained",
  "concept_explained_fa",
  "word_hint_story",
  "sentence_en_meaning_fa",
  "explanation_for_sentence_meaning",
  "learning_depth",
  "mixed_sentence",
  "other_meanings_fa",
  "category",
  "hint_sentence",
  "first_letter_en_hint",
  "first_letter_fa_hint",
  "hint_to_select",
  "json_hint",
  "word_note",
  "common_error",
] as const;

const clearableSet = new Set<string>(CLEARABLE_FIELDS);

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const fieldsRaw =
    body && typeof body === "object" && "fields" in body
      ? (body as { fields?: unknown }).fields
      : null;
  const confirm =
    body && typeof body === "object" && "confirm" in body
      ? Boolean((body as { confirm?: unknown }).confirm)
      : false;

  if (!confirm) {
    return NextResponse.json(
      { ok: false, error: "Missing confirm=true" },
      { status: 400 },
    );
  }

  if (!Array.isArray(fieldsRaw)) {
    return NextResponse.json(
      { ok: false, error: "fields must be an array" },
      { status: 400 },
    );
  }

  const fields = fieldsRaw.map((f) => String(f ?? "").trim()).filter(Boolean);
  if (fields.length === 0) {
    return NextResponse.json(
      { ok: false, error: "No fields selected" },
      { status: 400 },
    );
  }

  const invalid = fields.filter((f) => !clearableSet.has(f));
  if (invalid.length) {
    return NextResponse.json(
      { ok: false, error: `Invalid field(s): ${invalid.join(", ")}` },
      { status: 400 },
    );
  }

  const data: Record<string, null> = {};
  for (const f of fields) data[f] = null;

  const res = await prisma.word.updateMany({ data });

  return NextResponse.json({
    ok: true,
    clearedFields: fields,
    updatedCount: res.count,
  });
}
