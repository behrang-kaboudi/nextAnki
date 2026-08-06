import "server-only";

import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { updateManyWords } from "@/lib/words/wordRepo";
import { prisma } from "@/lib/prisma";
import { touchWordsByEnglishIds } from "@/lib/words/wordRepo";

export const runtime = "nodejs";

const CLEARABLE_FIELD_VALUES = {
  pos: "",
  concept_explained_fa: "",
  learning_depth: 0,
  other_meanings_en: "",
  category: "",
  hint_to_select: "",
  imageability: 0,
  productive_target: 0,
  createdAt: new Date(0),
  updatedAt: new Date(0),
} satisfies Prisma.WordUpdateManyMutationInput;

const CLEARABLE_ENGLISH_FIELD_VALUES = {
  phonetic_us: "",
  phonetic_us_normalized: "",
  json_hint: "",
} satisfies Prisma.EnglishWordUpdateManyMutationInput;

type ClearableField = keyof typeof CLEARABLE_FIELD_VALUES | keyof typeof CLEARABLE_ENGLISH_FIELD_VALUES;

const CLEARABLE_FIELDS = Object.keys(
  { ...CLEARABLE_FIELD_VALUES, ...CLEARABLE_ENGLISH_FIELD_VALUES },
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

  const wordFields = fields.filter((field) => field in CLEARABLE_FIELD_VALUES);
  const englishFields = fields.filter((field) => field in CLEARABLE_ENGLISH_FIELD_VALUES);
  const data = Object.fromEntries(
    wordFields.map((field) => [
      field,
      CLEARABLE_FIELD_VALUES[field as keyof typeof CLEARABLE_FIELD_VALUES],
    ]),
  ) as Prisma.WordUpdateManyMutationInput;

  const res = wordFields.length ? await updateManyWords({ data }) : { count: 0 };
  let englishUpdatedCount = 0;
  if (englishFields.length) {
    const englishData = Object.fromEntries(
      englishFields.map((field) => [field, CLEARABLE_ENGLISH_FIELD_VALUES[field as keyof typeof CLEARABLE_ENGLISH_FIELD_VALUES]]),
    ) as Prisma.EnglishWordUpdateManyMutationInput;
    if (englishFields.includes("phonetic_us")) englishData.phonetic_us_confirmed = false;
    const englishIds = (await prisma.englishWord.findMany({ select: { id: true } })).map((row) => row.id);
    const englishResult = await prisma.englishWord.updateMany({ data: englishData });
    englishUpdatedCount = englishResult.count;
    await touchWordsByEnglishIds(englishIds);
  }

  return NextResponse.json({
    ok: true,
    clearedFields: fields,
    updatedCount: Math.max(res.count, englishUpdatedCount),
    wordUpdatedCount: res.count,
    englishWordUpdatedCount: englishUpdatedCount,
  });
}
