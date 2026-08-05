import "server-only";

import { NextResponse } from "next/server";

import { generateEnglishWordJsonHint } from "@/lib/english/englishWordJsonHint.server";
import { normalizeEnglishWordText } from "@/lib/english/normalize";
import { normalizeIpaForDb } from "@/lib/ipa/normalize";
import { prisma } from "@/lib/prisma";
import { upsertPrimarySentenceByAnkiLinkId } from "@/lib/sentences/sentenceRepo";
import { touchWordsByEnglishId, touchWordsLinkedToSentenceId, updateWord } from "@/lib/words/wordRepo";

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

function normalizeProductiveTarget(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 101) {
    return undefined;
  }
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

    const base_form = normalizeEnglishWordText(normalizeRequiredString(d.base_form) ?? "");
    const sentence_en = normalizeRequiredString(d.sentence_en);
    const typeOfWordInDb = normalizeRequiredString(d.typeOfWordInDb);
    const productive_target = normalizeProductiveTarget(d.productive_target);

    if (d.productive_target !== undefined && productive_target === undefined) {
      return NextResponse.json(
        { ok: false, error: "productive_target must be an integer between 0 and 101, or null." },
        { status: 400 },
      );
    }

    if (
      !base_form ||
      sentence_en == null ||
      typeOfWordInDb == null
    ) {
      return NextResponse.json(
        { ok: false, error: "Missing required string fields." },
        { status: 400 },
      );
    }

    const phonetic_us = normalizeNullableString(d.phonetic_us) ?? null;
    const phonetic_us_normalized = phonetic_us ? normalizeIpaForDb(phonetic_us, 2000) || null : null;
    const existing = await prisma.word.findUnique({
      where: { id },
      include: { english: true },
    });

    if (!existing) {
      return NextResponse.json({ ok: false, error: `Word ${id} not found.` }, { status: 404 });
    }

    const targetBefore = existing.english.base_form === base_form
      ? existing.english
      : await prisma.englishWord.findUnique({ where: { base_form } });
    const englishChanged =
      !targetBefore ||
      targetBefore.phonetic_us !== phonetic_us ||
      targetBefore.phonetic_us_normalized !== phonetic_us_normalized;
    const englishWord = targetBefore
      ? await prisma.englishWord.update({
          where: { id: targetBefore.id },
          data: {
            phonetic_us,
            phonetic_us_normalized,
            ...(englishChanged ? { json_hint: null } : {}),
          },
        })
      : await prisma.englishWord.create({
          data: { base_form, phonetic_us, phonetic_us_normalized },
        });

    if (englishChanged && phonetic_us_normalized) {
      await generateEnglishWordJsonHint(englishWord.id);
    }
    if (englishChanged) await touchWordsByEnglishId(englishWord.id);

    const updated = await updateWord({
      where: { id },
      data: {
        englishId: englishWord.id,
        pos: normalizeNullableString(d.pos),
        concept_explained: normalizeNullableString(d.concept_explained),
        concept_explained_fa: normalizeNullableString(d.concept_explained_fa),
        word_hint_story: normalizeNullableString(d.word_hint_story),
        explanation_for_sentence_meaning: normalizeNullableString(d.explanation_for_sentence_meaning),
        learning_depth: normalizeNullableNumber(d.learning_depth),
        mixed_sentence: normalizeNullableString(d.mixed_sentence),
        other_meanings_en: normalizeNullableString(d.other_meanings_en),
        category: normalizeNullableString(d.category),
        typeOfWordInDb,
        hint_sentence: normalizeNullableString(d.hint_sentence),
        first_letter_en_hint: normalizeNullableString(d.first_letter_en_hint),
        first_letter_fa_hint: normalizeNullableString(d.first_letter_fa_hint),
        hint_to_select: normalizeNullableString(d.hint_to_select),
        word_note: normalizeNullableString(d.word_note),
        common_error: normalizeNullableString(d.common_error),
        imageability: normalizeNullableNumber(d.imageability),
        productive_target,
      },
      select: {
        id: true,
        updatedAt: true,
      },
    });

    const englishFields = await prisma.englishWord.findUniqueOrThrow({
      where: { id: englishWord.id },
      select: { phonetic_us_normalized: true, json_hint: true },
    });

    const sentence = await upsertPrimarySentenceByAnkiLinkId({
      ankiLinkId: existing.anki_link_id,
      sentence_en,
      sentence_en_meaning_fa: normalizeNullableString(d.sentence_en_meaning_fa) ?? null,
    });
    await touchWordsLinkedToSentenceId(sentence.id);

    return NextResponse.json({
      ok: true as const,
      item: {
        id: updated.id,
        sentenceRecordId: sentence.id,
        updatedAt: updated.updatedAt.toISOString(),
        phonetic_us_normalized: englishFields.phonetic_us_normalized,
        json_hint: englishFields.json_hint,
      },
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
