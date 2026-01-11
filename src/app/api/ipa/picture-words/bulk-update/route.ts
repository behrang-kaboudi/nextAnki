import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const ALLOWED_FIELDS = [
  "type",
  "canBePersonal",
  "canImagineAsHuman",
  "canUseAsHumanAdj",
  "ipaVerified",
  "fa",
  "en",
  "ipa_fa",
  "ipa_fa_normalized",
  "phinglish",
] as const;

type AllowedField = (typeof ALLOWED_FIELDS)[number];

const TYPE_VALUES = [
  "noun",
  "adding",
  "animal",
  "person",
  "occupation",
  "notPersonal",
  "humanBody",
  "relationalObj",
  "personAdj",
  "personAdj_adj",
  "adj",
  "food",
  "place",
  "accessory",
  "tool",
  "sport",
] as const;

type PictureWordTypeValue = (typeof TYPE_VALUES)[number];

function normalizeIds(value: unknown): number[] | null {
  if (!Array.isArray(value)) return null;
  const ids = value
    .map((x) => (typeof x === "number" ? x : Number(x)))
    .filter((x) => Number.isFinite(x) && x > 0);
  return Array.from(new Set(ids));
}

function parseBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value > 0 : null;
  if (typeof value === "string") {
    const s = value.trim().toLowerCase();
    if (s === "true" || s === "1" || s === "yes") return true;
    if (s === "false" || s === "0" || s === "no") return false;
  }
  return null;
}

function isAllowedField(value: unknown): value is AllowedField {
  return typeof value === "string" && (ALLOWED_FIELDS as readonly string[]).includes(value);
}

function normalizeString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function isTypeValue(value: unknown): value is PictureWordTypeValue {
  return typeof value === "string" && (TYPE_VALUES as readonly string[]).includes(value);
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as unknown;
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }

    const obj = body as Record<string, unknown>;
    const ids = normalizeIds(obj.ids);
    if (!ids?.length) {
      return NextResponse.json({ error: "ids must be a non-empty array" }, { status: 400 });
    }

    if (!isAllowedField(obj.field)) {
      return NextResponse.json(
        { error: `field must be one of: ${ALLOWED_FIELDS.join(", ")}` },
        { status: 400 }
      );
    }
    const field = obj.field;

    const updateData: Record<string, unknown> = {};
    if (field === "type") {
      if (!isTypeValue(obj.value)) {
        return NextResponse.json(
          { error: `value must be one of: ${TYPE_VALUES.join(", ")}` },
          { status: 400 }
        );
      }
      updateData.type = obj.value;
    } else if (
      field === "canBePersonal" ||
      field === "canImagineAsHuman" ||
      field === "canUseAsHumanAdj" ||
      field === "ipaVerified"
    ) {
      const parsed = parseBoolean(obj.value);
      if (parsed === null) {
        return NextResponse.json(
          { error: "value must be boolean (true/false)" },
          { status: 400 }
        );
      }
      updateData[field] = parsed;
    } else {
      const s = normalizeString(obj.value);
      if (s === null) {
        return NextResponse.json(
          { error: "value must be a non-empty string" },
          { status: 400 }
        );
      }
      updateData[field] = s;
    }

    const result = await prisma.pictureWord.updateMany({
      where: { id: { in: ids } },
      data: updateData,
    });

    return NextResponse.json({ ok: true, updatedCount: result.count });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
