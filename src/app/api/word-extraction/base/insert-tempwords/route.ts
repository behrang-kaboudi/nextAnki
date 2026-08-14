import "server-only";

import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { normalizeEnglishWordText } from "@/lib/english/normalize";
import { findEnglishWordIdsByKnownForm } from "@/lib/english/englishWordForms.server";
import {
  normalizePersianForStorage,
  normalizePersianFull,
} from "@/lib/persian/normalize";
import { prisma } from "@/lib/prisma";
import { addPersianWord, findPersianWord } from "@/lib/tables/persianWord";
import { updateWordSense } from "@/lib/words/wordSenseRepo";
import { primarySentenceId } from "@/lib/words/sentenceIds";

export const runtime = "nodejs";

type PayloadItem = {
  base_form: string;
  meaning_fa: string;
  pos: string;
  concept_explained_fa: string;
  sentence_en: string;
  sentence_en_meaning_fa: string;
};

type AuditChange = {
  entity: "WordSense" | "EnglishWord" | "PersianWord" | "Sentence";
  field: string;
  action: "created" | "reused" | "kept" | "linked";
  recordId?: number;
  before?: string | number | number[] | null;
  after?: string | number | number[] | null;
  incoming?: string | number | number[] | null;
  reason: string;
};

const allowedKeys = [
  "base_form",
  "meaning_fa",
  "pos",
  "concept_explained_fa",
  "sentence_en",
  "sentence_en_meaning_fa",
] as const;
const allowedKeySet = new Set<string>(allowedKeys);

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function normalizePos(value: string | null | undefined): string {
  return value?.trim().toLocaleLowerCase("en-US") ?? "";
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object") return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function validateItem(
  value: unknown,
): { ok: true; item: PayloadItem } | { ok: false; issues: string[] } {
  if (!isPlainObject(value)) {
    return { ok: false, issues: ["Item must be an object"] };
  }

  const keys = Object.keys(value);
  const issues: string[] = [];
  const extraKeys = keys.filter((key) => !allowedKeySet.has(key));
  const missingKeys = allowedKeys.filter((key) => !(key in value));
  if (extraKeys.length) issues.push(`Extra field(s): ${extraKeys.join(", ")}`);
  if (missingKeys.length) issues.push(`Missing field(s): ${missingKeys.join(", ")}`);
  if (keys.length !== allowedKeys.length) {
    issues.push(`Item must have exactly ${allowedKeys.length} fields`);
  }

  const base_form = normalizeEnglishWordText(asNonEmptyString(value.base_form) ?? "");
  const meaningFaRaw = asNonEmptyString(value.meaning_fa);
  const pos = normalizePos(asNonEmptyString(value.pos));
  const concept_explained_fa = asNonEmptyString(value.concept_explained_fa);
  const sentence_en = asNonEmptyString(value.sentence_en);
  const sentence_en_meaning_fa = asNonEmptyString(value.sentence_en_meaning_fa);

  if (!base_form) issues.push("base_form must be a non-empty string");
  if (!meaningFaRaw) issues.push("meaning_fa must be a non-empty string");
  if (!pos) issues.push("pos must be a non-empty string");
  if (!concept_explained_fa) issues.push("concept_explained_fa must be a non-empty string");
  if (!sentence_en) issues.push("sentence_en must be a non-empty string");
  if (!sentence_en_meaning_fa) issues.push("sentence_en_meaning_fa must be a non-empty string");
  if (issues.length) return { ok: false, issues };
  if (!meaningFaRaw || !concept_explained_fa || !sentence_en || !sentence_en_meaning_fa) {
    return { ok: false, issues: ["Invalid input"] };
  }

  const meaning_fa = normalizePersianForStorage(meaningFaRaw);
  if (!meaning_fa || !normalizePersianFull(meaning_fa)) {
    return { ok: false, issues: ["meaning_fa must contain Persian letters"] };
  }

  return {
    ok: true,
    item: {
      base_form,
      meaning_fa,
      pos,
      concept_explained_fa,
      sentence_en,
      sentence_en_meaning_fa,
    },
  };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as unknown;
    if (!Array.isArray(body)) {
      return NextResponse.json({ ok: false, error: "Body must be an array" }, { status: 400 });
    }

    const items: PayloadItem[] = [];
    const validationErrors: Array<{ index: number; issues: string[] }> = [];
    body.forEach((row, index) => {
      const validated = validateItem(row);
      if (validated.ok) items.push(validated.item);
      else validationErrors.push({ index, issues: validated.issues });
    });
    if (validationErrors.length) {
      return NextResponse.json(
        {
          ok: false,
          error: "Invalid input items (six exact base-data fields are required)",
          errors: validationErrors,
        },
        { status: 400 },
      );
    }
    if (!items.length) {
      return NextResponse.json({ ok: false, error: "No valid items" }, { status: 400 });
    }

    let inserted = 0;
    let skippedExisting = 0;
    let failed = 0;
    const results: Array<
      | {
          ok: true;
          action: "inserted" | "skipped_exists";
          id: number;
          base_form: string;
          meaning_fa: string;
          changes: AuditChange[];
        }
      | {
          ok: false;
          action: "error";
          base_form: string;
          meaning_fa: string;
          error: string;
        }
    > = [];

    for (const item of items) {
      try {
        const normalizedMeaning = normalizePersianFull(item.meaning_fa);
        const knownEnglishWordIds = await findEnglishWordIdsByKnownForm(item.base_form);
        const candidates = await prisma.wordSense.findMany({
          where: knownEnglishWordIds.length
            ? { englishId: { in: knownEnglishWordIds } }
            : { english: { is: { base_form: item.base_form } } },
          orderBy: { id: "asc" },
          select: {
            id: true,
            englishId: true,
            meaningId: true,
            pos: true,
            concept_explained_fa: true,
            sentenceIds: true,
            updatedAt: true,
            meaning: {
              select: { canonical_text: true, normalized_text: true },
            },
          },
        });
        const existing = candidates.find(
          (candidate) =>
            candidate.meaning?.normalized_text === normalizedMeaning &&
            normalizePos(candidate.pos) === item.pos,
        );

        if (existing) {
          const existingSentenceId = primarySentenceId(existing.sentenceIds);
          const existingSentence = existingSentenceId
            ? await prisma.sentence.findUnique({
                where: { id: existingSentenceId },
                select: {
                  id: true,
                  sentence_en: true,
                  sentence_en_meaning_fa: true,
                },
              })
            : null;
          const changes: AuditChange[] = [
            {
              entity: "WordSense",
              field: "record",
              action: "kept",
              recordId: existing.id,
              reason: "کلید base_form + meaning_fa + pos یکسان بود؛ هیچ رکوردی Insert یا Update نشد.",
            },
            {
              entity: "EnglishWord",
              field: "base_form",
              action: "kept",
              recordId: existing.englishId,
              before: item.base_form,
              after: item.base_form,
              incoming: item.base_form,
              reason: "base_form بخشی از کلید تکراری بود و بدون تغییر باقی ماند.",
            },
            {
              entity: "PersianWord",
              field: "meaning_fa",
              action: "kept",
              recordId: existing.meaningId ?? undefined,
              before: existing.meaning?.canonical_text ?? null,
              after: existing.meaning?.canonical_text ?? null,
              incoming: item.meaning_fa,
              reason: "meaning_fa بخشی از کلید تکراری بود و بدون تغییر باقی ماند.",
            },
            {
              entity: "WordSense",
              field: "pos",
              action: "kept",
              recordId: existing.id,
              before: existing.pos,
              after: existing.pos,
              incoming: item.pos,
              reason: "pos بخشی از کلید تکراری بود و بدون تغییر باقی ماند.",
            },
            {
              entity: "WordSense",
              field: "concept_explained_fa",
              action: "kept",
              recordId: existing.id,
              before: existing.concept_explained_fa,
              after: existing.concept_explained_fa,
              incoming: item.concept_explained_fa,
              reason: "رکورد تکراری بود؛ مفهوم ورودی نادیده گرفته شد و مقدار قبلی تغییر نکرد.",
            },
            {
              entity: "Sentence",
              field: "sentence_en",
              action: "kept",
              recordId: existingSentence?.id,
              before: existingSentence?.sentence_en ?? null,
              after: existingSentence?.sentence_en ?? null,
              incoming: item.sentence_en,
              reason: "رکورد تکراری بود؛ جملهٔ ورودی نادیده گرفته شد و هیچ Sentence ساخته یا تغییر داده نشد.",
            },
            {
              entity: "Sentence",
              field: "sentence_en_meaning_fa",
              action: "kept",
              recordId: existingSentence?.id,
              before: existingSentence?.sentence_en_meaning_fa ?? null,
              after: existingSentence?.sentence_en_meaning_fa ?? null,
              incoming: item.sentence_en_meaning_fa,
              reason: "رکورد تکراری بود؛ ترجمهٔ ورودی نادیده گرفته شد و مقدار قبلی تغییر نکرد.",
            },
            {
              entity: "WordSense",
              field: "updatedAt",
              action: "kept",
              recordId: existing.id,
              before: existing.updatedAt.toISOString(),
              after: existing.updatedAt.toISOString(),
              reason: "هیچ Write انجام نشد؛ updatedAt نیز تغییر نکرد.",
            },
          ];
          skippedExisting += 1;
          results.push({
            ok: true,
            action: "skipped_exists",
            id: existing.id,
            base_form: item.base_form,
            meaning_fa: item.meaning_fa,
            changes,
          });
          continue;
        }

        const existingEnglishWord = await prisma.englishWord.findUnique({
          where: { base_form: item.base_form },
          select: { id: true },
        });
        const foundPersianWord = await findPersianWord(item.meaning_fa);
        const persianMeaning = foundPersianWord.item
          ? { action: "unchanged" as const, item: foundPersianWord.item }
          : await addPersianWord(item.meaning_fa);

        const created = await prisma.$transaction(async (tx) => {
          const englishWord = existingEnglishWord ?? await tx.englishWord.create({
            data: { base_form: item.base_form },
            select: { id: true },
          });
          const existingSentence = await tx.sentence.findUnique({
            where: { sentence_en: item.sentence_en },
            select: {
              id: true,
              sentence_en: true,
              sentence_en_meaning_fa: true,
            },
          });
          const sentence = existingSentence ?? await tx.sentence.create({
            data: {
              sentence_en: item.sentence_en,
              sentence_en_meaning_fa: item.sentence_en_meaning_fa,
            },
            select: {
              id: true,
              sentence_en: true,
              sentence_en_meaning_fa: true,
            },
          });
          const pending = await tx.wordSense.create({
            data: {
              anki_link_id: `pending_${randomUUID()}`,
              englishId: englishWord.id,
              meaningId: persianMeaning.item.id,
              pos: item.pos,
              concept_explained_fa: item.concept_explained_fa,
              sentenceIds: [sentence.id],
              conceptMergeReviewed: false,
            },
            select: { id: true },
          });
          await updateWordSense(
            {
              where: { id: pending.id },
              data: { anki_link_id: `${pending.id}_${Date.now()}` },
              select: { id: true },
            },
            tx,
          );
          return { pending, englishWord, existingSentence, sentence };
        });

        const changes: AuditChange[] = [
          {
            entity: "EnglishWord",
            field: "base_form",
            action: existingEnglishWord ? "reused" : "created",
            recordId: created.englishWord.id,
            after: item.base_form,
            reason: existingEnglishWord
              ? "EnglishWord موجود بدون تغییر استفاده شد."
              : "EnglishWord جدید Insert شد.",
          },
          {
            entity: "PersianWord",
            field: "meaning_fa",
            action: foundPersianWord.item ? "reused" : "created",
            recordId: persianMeaning.item.id,
            after: persianMeaning.item.canonical_text,
            incoming: item.meaning_fa,
            reason: foundPersianWord.item
              ? "PersianWord موجود بدون افزودن variant و بدون Update استفاده شد."
              : "PersianWord جدید Insert شد.",
          },
          {
            entity: "Sentence",
            field: "record",
            action: created.existingSentence ? "reused" : "created",
            recordId: created.sentence.id,
            after: created.sentence.sentence_en,
            incoming: item.sentence_en,
            reason: created.existingSentence
              ? "Sentence موجود بدون تغییر استفاده شد."
              : "Sentence جدید Insert شد.",
          },
          {
            entity: "Sentence",
            field: "sentence_en_meaning_fa",
            action: created.existingSentence ? "kept" : "created",
            recordId: created.sentence.id,
            before: created.existingSentence?.sentence_en_meaning_fa,
            after: created.sentence.sentence_en_meaning_fa,
            incoming: item.sentence_en_meaning_fa,
            reason: created.existingSentence
              ? "Sentence موجود Update نشد؛ ترجمهٔ موجود حفظ و ترجمهٔ ورودی نادیده گرفته شد."
              : "ترجمه همراه Sentence جدید Insert شد.",
          },
          {
            entity: "WordSense",
            field: "record",
            action: "created",
            recordId: created.pending.id,
            reason: "ترکیب base_form + meaning_fa + pos در دیتابیس وجود نداشت؛ WordSense Candidate جدید Insert شد.",
          },
          {
            entity: "WordSense",
            field: "pos",
            action: "created",
            recordId: created.pending.id,
            after: item.pos,
            reason: "pos روی WordSense جدید ذخیره شد.",
          },
          {
            entity: "WordSense",
            field: "concept_explained_fa",
            action: "created",
            recordId: created.pending.id,
            after: item.concept_explained_fa,
            reason: "مفهوم روی WordSense جدید ذخیره شد.",
          },
          {
            entity: "WordSense",
            field: "sentenceIds",
            action: "linked",
            recordId: created.pending.id,
            after: [created.sentence.id],
            reason: "Sentence فقط به WordSense جدید متصل شد؛ هیچ WordSense قبلی تغییر نکرد.",
          },
        ];
        inserted += 1;
        results.push({
          ok: true,
          action: "inserted",
          id: created.pending.id,
          base_form: item.base_form,
          meaning_fa: item.meaning_fa,
          changes,
        });
      } catch (error) {
        failed += 1;
        results.push({
          ok: false,
          action: "error",
          base_form: item.base_form,
          meaning_fa: item.meaning_fa,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return NextResponse.json({
      ok: true,
      total: items.length,
      inserted,
      skippedExisting,
      failed,
      results,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
