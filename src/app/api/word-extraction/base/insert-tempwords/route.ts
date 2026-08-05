import "server-only";

import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";

import { prisma } from "@/lib/prisma";
import { normalizePersianForComparison, normalizePersianForStorage } from "@/lib/persian/normalize";
import { upsertPrimarySentenceByAnkiLinkId } from "@/lib/sentences/sentenceRepo";
import { addPersianWord } from "@/lib/tables/persianWord";
import { normalizeEnglishWordText } from "@/lib/english/normalize";

export const runtime = "nodejs";

type PayloadItem = {
  base_form: string;
  meaning_fa: string;
  sentence_en: string;
  sentence_en_meaning_fa: string;
};

const allowedKeys = ["base_form", "meaning_fa", "sentence_en", "sentence_en_meaning_fa"] as const;
const allowedKeySet = new Set<string>(allowedKeys);

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object") return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
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

  const base_form = normalizeEnglishWordText(asNonEmptyString(value.base_form) ?? "");
  const meaning_fa_raw = asNonEmptyString(value.meaning_fa);
  const sentence_en = asNonEmptyString(value.sentence_en);
  const sentence_en_meaning_fa = asNonEmptyString(value.sentence_en_meaning_fa);
  if (!base_form) issues.push("base_form must be a non-empty string");
  if (!meaning_fa_raw) issues.push("meaning_fa must be a non-empty string");
  if (!sentence_en) issues.push("sentence_en must be a non-empty string");
  if (!sentence_en_meaning_fa) issues.push("sentence_en_meaning_fa must be a non-empty string");

  if (issues.length) return { ok: false, issues };
  if (!base_form || !meaning_fa_raw || !sentence_en || !sentence_en_meaning_fa) {
    return { ok: false, issues: ["Invalid input"] };
  }

  const meaning_fa = normalizePersianForStorage(meaning_fa_raw);
  if (!meaning_fa) return { ok: false, issues: ["meaning_fa is empty after normalization"] };
  return { ok: true, item: { base_form, meaning_fa, sentence_en, sentence_en_meaning_fa } };
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as unknown;
    if (!Array.isArray(body)) {
      return NextResponse.json({ ok: false, error: "Body must be an array" }, { status: 400 });
    }

    const items: PayloadItem[] = [];
    const errors: Array<{ index: number; issues: string[] }> = [];

    for (let i = 0; i < body.length; i++) {
      const row = body[i];
      const validated = validateItem(row);
      if (!validated.ok) {
        errors.push({ index: i, issues: validated.issues });
        continue;
      }
      items.push(validated.item);
    }

    if (errors.length) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Invalid input items (must be exactly { base_form, meaning_fa, sentence_en, sentence_en_meaning_fa })",
          errors,
        },
        { status: 400 }
      );
    }

    if (items.length === 0) {
      return NextResponse.json(
        { ok: false, error: "No valid items (need {base_form, meaning_fa, sentence_en, sentence_en_meaning_fa})" },
        { status: 400 }
      );
    }

    let inserted = 0;
    let skippedExisting = 0;
    const results: Array<
      | {
          ok: true;
          action: "inserted";
          id: number;
          base_form: string;
          meaning_fa: string;
          sentence_en_meaning_fa: string;
        }
      | {
          ok: true;
          action: "skipped_exists";
          id: number;
          base_form: string;
          meaning_fa: string;
          sentence_en_meaning_fa: string;
        }
      | { ok: false; action: "error"; base_form: string; meaning_fa: string; error: string }
    > = [];

    for (const item of items) {
      try {
        const candidates = await prisma.word.findMany({
          where: { english: { is: { base_form: item.base_form } } },
          select: { id: true, anki_link_id: true, meaning: { select: { normalized_text: true } } },
        });

        const targetMeaning = normalizePersianForComparison(item.meaning_fa);
        const existing = candidates.find(
          (c) => c.meaning?.normalized_text === targetMeaning
        );

        if (existing) {
          await upsertPrimarySentenceByAnkiLinkId({
            ankiLinkId: existing.anki_link_id,
            sentence_en: item.sentence_en,
            sentence_en_meaning_fa: item.sentence_en_meaning_fa,
          });
          skippedExisting += 1;
          results.push({
            ok: true,
            action: "skipped_exists",
            id: existing.id,
            base_form: item.base_form,
            meaning_fa: item.meaning_fa,
            sentence_en_meaning_fa: item.sentence_en_meaning_fa,
          });
          continue;
        }

        const persianMeaning = await addPersianWord(item.meaning_fa);
        const created = await prisma.$transaction(async (tx) => {
          const englishWord = await tx.englishWord.upsert({
            where: { base_form: item.base_form },
            update: {},
            create: { base_form: item.base_form },
            select: { id: true },
          });
          const pending = await tx.word.create({
            data: {
              // anki_link_id is required + unique, but we want final format to be `${id}_${now}`.
              // So we create with a unique placeholder, then update after the DB assigns `id`.
              anki_link_id: `pending_${randomUUID()}`,
              englishId: englishWord.id,
              meaningId: persianMeaning.item.id,
            },
            select: { id: true },
          });

          const code = `${pending.id}_${Date.now()}`;
          await tx.word.update({
            where: { id: pending.id },
            data: { anki_link_id: code },
            select: { id: true },
          });

          const sentence = await tx.sentence.upsert({
            where: { sentence_en: item.sentence_en },
            update: {
              sentence_en_meaning_fa: item.sentence_en_meaning_fa,
            },
            create: {
              sentence_en: item.sentence_en,
              sentence_en_meaning_fa: item.sentence_en_meaning_fa,
            },
            select: { id: true },
          });

          await tx.sentenceWordLink.create({
            data: {
              sentenceId: sentence.id,
              wordId: pending.id,
              isPrimary: true,
            },
          });

          return pending;
        });

        inserted += 1;
        results.push({
          ok: true,
          action: "inserted",
          id: created.id,
          base_form: item.base_form,
          meaning_fa: item.meaning_fa,
          sentence_en_meaning_fa: item.sentence_en_meaning_fa,
        });
      } catch (e) {
        results.push({
          ok: false,
          action: "error",
          base_form: item.base_form,
          meaning_fa: item.meaning_fa,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    return NextResponse.json({
      ok: true,
      total: items.length,
      inserted,
      skippedExisting,
      results,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
