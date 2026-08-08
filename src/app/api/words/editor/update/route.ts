import "server-only";

import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getWordEditorInitial } from "@/lib/words/editorPayload";
import { updateWord } from "@/lib/words/wordRepo";

export const runtime = "nodejs";

function asPositiveInt(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const i = Math.floor(value);
  return i > 0 ? i : null;
}

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  return value;
}

function normalizeNullableString(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const s = asString(value);
  if (s === null) return undefined;
  const trimmed = s.trim();
  return trimmed.length ? s : null;
}

function normalizeNullableNumber(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return value;
}

function normalizeNullablePositiveInt(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    return undefined;
  }
  return value;
}

function normalizeProductiveTarget(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 101) {
    return undefined;
  }
  return value;
}

function normalizePositiveIdArray(value: unknown): number[] | undefined {
  if (!Array.isArray(value)) return undefined;
  if (
    !value.every(
      (item) => typeof item === "number" && Number.isInteger(item) && item > 0,
    )
  ) {
    return undefined;
  }
  const unique = [...new Set(value)];
  return unique.length === value.length ? unique : undefined;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as unknown;
    const id = asPositiveInt((body as { id?: unknown } | null)?.id);
    const data = (body as { data?: unknown } | null)?.data;

    if (!id || !data || typeof data !== "object") {
      return NextResponse.json(
        { ok: false, error: "Body must include { id: number, data: object }" },
        { status: 400 },
      );
    }

    const d = data as Record<string, unknown>;

    const sentenceId = normalizeNullablePositiveInt(d.sentenceId);
    const productive_target = normalizeProductiveTarget(d.productive_target);
    const otherMeaningIds = normalizePositiveIdArray(d.otherMeaningIds);
    const sentenceIds = normalizePositiveIdArray(d.sentenceIds);
    const comparedMeaningWordIds = normalizePositiveIdArray(d.comparedMeaningWordIds);
    const synonymIds = normalizePositiveIdArray(d.synonymIds);

    if (d.productive_target !== undefined && productive_target === undefined) {
      return NextResponse.json(
        { ok: false, error: "productive_target must be an integer between 0 and 101, or null." },
        { status: 400 },
      );
    }

    if (d.sentenceId !== undefined && sentenceId === undefined) {
      return NextResponse.json(
        { ok: false, error: "sentenceId must be a positive integer or null." },
        { status: 400 },
      );
    }

    if (
      sentenceId !== null &&
      sentenceId !== undefined &&
      !(await prisma.sentence.findUnique({ where: { id: sentenceId }, select: { id: true } }))
    ) {
      return NextResponse.json(
        { ok: false, error: `Sentence ${sentenceId} does not exist.` },
        { status: 400 },
      );
    }


    for (const [field, raw, normalized] of [
      ["otherMeaningIds", d.otherMeaningIds, otherMeaningIds],
      ["sentenceIds", d.sentenceIds, sentenceIds],
      ["comparedMeaningWordIds", d.comparedMeaningWordIds, comparedMeaningWordIds],
      ["synonymIds", d.synonymIds, synonymIds],
    ] as const) {
      if (raw !== undefined && normalized === undefined) {
        return NextResponse.json(
          { ok: false, error: `${field} must be an array of unique positive integer ids.` },
          { status: 400 },
        );
      }
    }

    if (d.meanings_confirmed !== undefined && typeof d.meanings_confirmed !== "boolean") {
      return NextResponse.json(
        { ok: false, error: "meanings_confirmed must be a boolean." },
        { status: 400 },
      );
    }

    const updated = await updateWord({
      where: { id },
      data: {
        sentenceId,
        pos: normalizeNullableString(d.pos),
        concept_explained_fa: normalizeNullableString(d.concept_explained_fa),
        learning_depth: normalizeNullableNumber(d.learning_depth),
        other_meanings_en: normalizeNullableString(d.other_meanings_en),
        category: normalizeNullableString(d.category),
        hint_to_select: normalizeNullableString(d.hint_to_select),
        imageability: normalizeNullableNumber(d.imageability),
        productive_target,
        otherMeaningIds,
        sentenceIds,
        comparedMeaningWordIds,
        synonymIds,
        meanings_confirmed:
          typeof d.meanings_confirmed === "boolean" ? d.meanings_confirmed : undefined,
      },
      select: { id: true },
    });

    const item = await getWordEditorInitial(updated.id);

    return NextResponse.json({
      ok: true as const,
      item,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
