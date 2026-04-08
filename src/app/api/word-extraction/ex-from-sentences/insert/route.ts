import "server-only";

import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";

import { prisma } from "@/lib/prisma";
import { upsertPrimarySentenceByAnkiLinkId } from "@/lib/sentences/sentenceRepo";

export const runtime = "nodejs";

type MentionedWordItem = {
  base_form: string;
  meaning_fa: string;
};

type PayloadItem = {
  sentence_en: string;
  items: MentionedWordItem[];
};

const allowedItemKeys = ["base_form", "meaning_fa"] as const;
const allowedRowKeys = ["sentence_en", "items"] as const;
const allowedItemKeySet = new Set<string>(allowedItemKeys);
const allowedRowKeySet = new Set<string>(allowedRowKeys);

function normalizeMeaningFaForCompare(value: string): string {
  return value
    .replaceAll("\u200c", "")
    .replaceAll("\u200d", "")
    .replaceAll("\u00a0", "")
    .replace(/\s+/g, "")
    .trim();
}

function normalizeMeaningFaForStore(value: string): string {
  return value
    .replaceAll("\u200c", " ")
    .replaceAll("\u200d", " ")
    .replaceAll("\u00a0", " ")
    .replace(/\s+/g, " ")
    .trim();
}

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

function validateMentionedWordItem(
  value: unknown,
): { ok: true; item: MentionedWordItem } | { ok: false; issues: string[] } {
  if (!isPlainObject(value)) return { ok: false, issues: ["items[] entry must be an object"] };

  const keys = Object.keys(value);
  const issues: string[] = [];
  const extraKeys = keys.filter((k) => !allowedItemKeySet.has(k));
  if (extraKeys.length) issues.push(`Extra item field(s): ${extraKeys.join(", ")}`);

  const missingKeys = allowedItemKeys.filter((k) => !(k in value));
  if (missingKeys.length) issues.push(`Missing item field(s): ${missingKeys.join(", ")}`);

  if (keys.length !== allowedItemKeys.length) {
    issues.push(`Each items[] entry must have exactly ${allowedItemKeys.length} fields`);
  }

  const base_form = asNonEmptyString(value.base_form);
  const meaning_fa_raw = asNonEmptyString(value.meaning_fa);

  if (!base_form) issues.push("items[].base_form must be a non-empty string");
  if (!meaning_fa_raw) issues.push("items[].meaning_fa must be a non-empty string");

  if (issues.length) return { ok: false, issues };
  if (!base_form || !meaning_fa_raw) return { ok: false, issues: ["Invalid items[] entry"] };

  const meaning_fa = normalizeMeaningFaForStore(meaning_fa_raw);
  if (!meaning_fa) return { ok: false, issues: ["items[].meaning_fa is empty after normalization"] };

  return { ok: true, item: { base_form, meaning_fa } };
}

function validateRow(value: unknown): { ok: true; item: PayloadItem } | { ok: false; issues: string[] } {
  if (!isPlainObject(value)) return { ok: false, issues: ["Row must be an object"] };

  const keys = Object.keys(value);
  const issues: string[] = [];
  const extraKeys = keys.filter((k) => !allowedRowKeySet.has(k));
  if (extraKeys.length) issues.push(`Extra field(s): ${extraKeys.join(", ")}`);

  const missingKeys = allowedRowKeys.filter((k) => !(k in value));
  if (missingKeys.length) issues.push(`Missing field(s): ${missingKeys.join(", ")}`);

  if (keys.length !== allowedRowKeys.length) {
    issues.push(`Row must have exactly ${allowedRowKeys.length} fields`);
  }

  const sentence_en = asNonEmptyString(value.sentence_en);
  if (!sentence_en) issues.push("sentence_en must be a non-empty string");

  const itemsRaw = value.items;
  if (!Array.isArray(itemsRaw) || itemsRaw.length === 0) {
    issues.push("items must be a non-empty array");
  }

  const items: MentionedWordItem[] = [];
  if (Array.isArray(itemsRaw)) {
    for (let i = 0; i < itemsRaw.length; i += 1) {
      const validated = validateMentionedWordItem(itemsRaw[i]);
      if (!validated.ok) {
        issues.push(`items[${i}]: ${validated.issues.join("; ")}`);
        continue;
      }
      items.push(validated.item);
    }
  }

  if (issues.length) return { ok: false, issues };
  if (!sentence_en || items.length === 0) return { ok: false, issues: ["Invalid row"] };

  return { ok: true, item: { sentence_en, items } };
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as unknown;
    if (!Array.isArray(body)) {
      return NextResponse.json({ ok: false, error: "Body must be an array" }, { status: 400 });
    }

    const rows: PayloadItem[] = [];
    const errors: Array<{ index: number; issues: string[] }> = [];

    for (let i = 0; i < body.length; i += 1) {
      const validated = validateRow(body[i]);
      if (!validated.ok) {
        errors.push({ index: i, issues: validated.issues });
        continue;
      }
      rows.push(validated.item);
    }

    if (errors.length) {
      return NextResponse.json(
        {
          ok: false,
          error: "Invalid input rows (must be exactly { sentence_en, items: [{ base_form, meaning_fa }] })",
          errors,
        },
        { status: 400 },
      );
    }

    if (!rows.length) {
      return NextResponse.json(
        { ok: false, error: "No valid rows (need { sentence_en, items: [{ base_form, meaning_fa }] })" },
        { status: 400 },
      );
    }

    let inserted = 0;
    let skippedExisting = 0;
    let sentencesUpserted = 0;

    const results: Array<
      | {
          ok: true;
          sentence_en: string;
          action: "inserted" | "skipped_exists";
          id: number;
          base_form: string;
          meaning_fa: string;
        }
      | {
          ok: false;
          sentence_en: string;
          action: "error";
          base_form: string;
          meaning_fa: string;
          error: string;
        }
    > = [];

    for (const row of rows) {
      await prisma.sentence.upsert({
        where: { sentence_en: row.sentence_en },
        update: { mentionedWordsJson: row.items },
        create: {
          sentence_en: row.sentence_en,
          mentionedWordsJson: row.items,
        },
      });
      sentencesUpserted += 1;

      for (const item of row.items) {
        try {
          const candidates = await prisma.word.findMany({
            where: { base_form: item.base_form },
            select: { id: true, meaning_fa: true },
          });

          const targetMeaning = normalizeMeaningFaForCompare(item.meaning_fa);
          const existing = candidates.find(
            (candidate) => normalizeMeaningFaForCompare(candidate.meaning_fa) === targetMeaning,
          );

          if (existing) {
            skippedExisting += 1;
            results.push({
              ok: true,
              sentence_en: row.sentence_en,
              action: "skipped_exists",
              id: existing.id,
              base_form: item.base_form,
              meaning_fa: item.meaning_fa,
            });
            continue;
          }

          const created = await prisma.$transaction(async (tx) => {
            const pending = await tx.word.create({
              data: {
                anki_link_id: `pending_${randomUUID()}`,
                base_form: item.base_form,
                meaning_fa: item.meaning_fa,
                meaning_fa_IPA: "",
              },
              select: { id: true },
            });

            const code = `${pending.id}_${Date.now()}`;
            const createdWord = await tx.word.update({
              where: { id: pending.id },
              data: { anki_link_id: code },
              select: { id: true, anki_link_id: true },
            });

            return createdWord;
          });

          await upsertPrimarySentenceByAnkiLinkId({
            ankiLinkId: created.anki_link_id,
            sentence_en: row.sentence_en,
          });

          inserted += 1;
          results.push({
            ok: true,
            sentence_en: row.sentence_en,
            action: "inserted",
            id: created.id,
            base_form: item.base_form,
            meaning_fa: item.meaning_fa,
          });
        } catch (error) {
          results.push({
            ok: false,
            sentence_en: row.sentence_en,
            action: "error",
            base_form: item.base_form,
            meaning_fa: item.meaning_fa,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }

    return NextResponse.json({
      ok: true,
      totalRows: rows.length,
      totalItems: rows.reduce((sum, row) => sum + row.items.length, 0),
      sentencesUpserted,
      inserted,
      skippedExisting,
      results,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
