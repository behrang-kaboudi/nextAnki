import "server-only";

import { NextResponse } from "next/server";

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

function normalizeRequiredString(value: unknown): string | null {
  const s = asString(value);
  if (s === null) return null;
  return s;
}

function normalizeNullableNumber(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return value;
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

    const base_form = normalizeRequiredString(d.base_form);
    const meaning_fa = normalizeRequiredString(d.meaning_fa);
    const meaning_fa_IPA = normalizeRequiredString(d.meaning_fa_IPA);
    const meaning_fa_IPA_normalized = normalizeRequiredString(d.meaning_fa_IPA_normalized);
    const sentence_en = normalizeRequiredString(d.sentence_en);
    const typeOfWordInDb = normalizeRequiredString(d.typeOfWordInDb);

    if (
      base_form == null ||
      meaning_fa == null ||
      meaning_fa_IPA == null ||
      meaning_fa_IPA_normalized == null ||
      sentence_en == null ||
      typeOfWordInDb == null
    ) {
      return NextResponse.json(
        { ok: false, error: "Missing required string fields." },
        { status: 400 },
      );
    }

    const updated = await updateWord({
      where: { id },
      data: {
        base_form,
        phonetic_us: normalizeNullableString(d.phonetic_us),
        phonetic_us_normalized: normalizeNullableString(d.phonetic_us_normalized),
        meaning_fa,
        meaning_fa_IPA,
        meaning_fa_IPA_normalized,
        pos: normalizeNullableString(d.pos),
        concept_explained: normalizeNullableString(d.concept_explained),
        concept_explained_fa: normalizeNullableString(d.concept_explained_fa),
        word_hint_story: normalizeNullableString(d.word_hint_story),
        sentence_en,
        sentence_en_meaning_fa: normalizeNullableString(d.sentence_en_meaning_fa),
        explanation_for_sentence_meaning: normalizeNullableString(d.explanation_for_sentence_meaning),
        learning_depth: normalizeNullableNumber(d.learning_depth),
        mixed_sentence: normalizeNullableString(d.mixed_sentence),
        other_meanings_fa: normalizeNullableString(d.other_meanings_fa),
        category: normalizeNullableString(d.category),
        typeOfWordInDb,
        hint_sentence: normalizeNullableString(d.hint_sentence),
        first_letter_en_hint: normalizeNullableString(d.first_letter_en_hint),
        first_letter_fa_hint: normalizeNullableString(d.first_letter_fa_hint),
        hint_to_select: normalizeNullableString(d.hint_to_select),
        json_hint: normalizeNullableString(d.json_hint),
        word_note: normalizeNullableString(d.word_note),
        common_error: normalizeNullableString(d.common_error),
        imageability: normalizeNullableNumber(d.imageability),
      },
      select: { id: true, updatedAt: true },
    });

    return NextResponse.json({ ok: true as const, item: { id: updated.id, updatedAt: updated.updatedAt.toISOString() } });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}

