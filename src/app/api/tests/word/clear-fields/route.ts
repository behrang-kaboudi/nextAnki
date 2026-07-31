import "server-only";

import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { updateManyWords } from "@/lib/words/wordRepo";

export const runtime = "nodejs";

const CLEARABLE_FIELD_VALUES = {
  phonetic_us: "",
  phonetic_us_normalized: "",
  meaning_fa: "",
  meaning_fa_IPA: "",
  meaning_fa_IPA_normalized: "",
  pos: "",
  concept_explained: "",
  concept_explained_fa: "",
  word_hint_story: "",
  explanation_for_sentence_meaning: "",
  learning_depth: 0,
  mixed_sentence: "",
  other_meanings_fa: "",
  other_meanings_en: "",
  category: "",
  typeOfWordInDb: "",
  hint_sentence: "",
  first_letter_en_hint: "",
  first_letter_fa_hint: "",
  hint_to_select: "",
  json_hint: "",
  word_note: "",
  common_error: "",
  imageability: 0,
  productive_target: 0,
  createdAt: new Date(0),
  updatedAt: new Date(0),
} satisfies Prisma.WordUpdateManyMutationInput;

type ClearableField = keyof typeof CLEARABLE_FIELD_VALUES;

const CLEARABLE_FIELDS = Object.keys(
  CLEARABLE_FIELD_VALUES,
) as ClearableField[];

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

  const data = Object.fromEntries(
    fields.map((field) => [
      field,
      CLEARABLE_FIELD_VALUES[field as ClearableField],
    ]),
  ) as Prisma.WordUpdateManyMutationInput;

  const res = await updateManyWords({ data });

  return NextResponse.json({
    ok: true,
    clearedFields: fields,
    updatedCount: res.count,
  });
}
