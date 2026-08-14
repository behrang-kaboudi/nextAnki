import "server-only";

import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import {
  customExtractionMissingWhere,
  listWordIdsMissingSentenceTranslation,
} from "@/lib/word-extraction/customExtraction.server";
import {
  CUSTOM_EXTRACTION_INPUT_FIELDS,
  CUSTOM_EXTRACTION_OUTPUT_FIELDS,
  type CustomExtractionFieldKey,
} from "@/lib/word-extraction/customExtractionFields";
import { prisma } from "@/lib/prisma";
import { wordSentenceIds } from "@/lib/words/sentenceIds";

export const runtime = "nodejs";

const inputKeys = new Set(CUSTOM_EXTRACTION_INPUT_FIELDS.map((field) => field.key));
const outputKeys = new Set(CUSTOM_EXTRACTION_OUTPUT_FIELDS.map((field) => field.key));

function parseFields(value: string | null, allowed: Set<string>) {
  return [...new Set(String(value ?? "").split(",").map((item) => item.trim()).filter((item) => allowed.has(item)))] as CustomExtractionFieldKey[];
}

function parseLimit(value: string | null) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 20;
  return Math.min(Math.floor(parsed), 500);
}

function positiveJsonIds(value: Prisma.JsonValue | null) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.flatMap((item) => {
    const id = typeof item === "number" ? item : typeof item === "string" ? Number(item) : Number.NaN;
    return Number.isSafeInteger(id) && id > 0 ? [id] : [];
  }))];
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const inputs = parseFields(url.searchParams.get("inputs"), inputKeys);
    const outputs = parseFields(url.searchParams.get("outputs"), outputKeys);
    const limit = parseLimit(url.searchParams.get("limit"));

    if (!inputs.length) {
      return NextResponse.json({ ok: false, error: "Select at least one input field." }, { status: 400 });
    }
    if (!outputs.length) {
      return NextResponse.json({ ok: false, error: "Select at least one output field." }, { status: 400 });
    }

    const needsSentenceTranslation = outputs.includes("sentence_en_meaning_fa");
    const translationMissingWordIds = needsSentenceTranslation
      ? await listWordIdsMissingSentenceTranslation()
      : [];
    const regularOutputs = outputs.filter((field) => field !== "sentence_en_meaning_fa");
    const missingConditions: Prisma.WordSenseWhereInput[] = regularOutputs.map(customExtractionMissingWhere);
    if (translationMissingWordIds.length) missingConditions.push({ id: { in: translationMissingWordIds } });
    const where: Prisma.WordSenseWhereInput = missingConditions.length
      ? { OR: missingConditions }
      : { id: { lt: 0 } };
    const total = await prisma.wordSense.count({ where });
    const rows = await prisma.wordSense.findMany({
        where,
        orderBy: { id: "desc" },
        take: limit,
        select: {
          id: true,
          sentenceIds: true,
          meanings_confirmed: true,
          imageability: true,
          learning_depth: true,
          productive_target: true,
          pos: true,
          concept_explained_fa: true,
          other_meanings_en: true,
          category: true,
          hint_to_select: true,
          english: { select: { id: true, base_form: true, phonetic_us: true } },
          meaning: { select: { id: true, canonical_text: true, meaning_fa_IPA: true } },
          otherMeaningIds: true,
        },
      });

    const otherMeaningIds = [...new Set(rows.flatMap((row) => positiveJsonIds(row.otherMeaningIds)))];
    const otherMeanings = otherMeaningIds.length
      ? await prisma.persianWord.findMany({
          where: { id: { in: otherMeaningIds } },
          select: { id: true, canonical_text: true },
        })
      : [];
    const otherMeaningsById = new Map(
      otherMeanings.map((meaning) => [meaning.id, meaning.canonical_text]),
    );
    const sentenceIds = [...new Set(rows.flatMap((row) => wordSentenceIds(row.sentenceIds)))];
    const sentences = sentenceIds.length
      ? await prisma.sentence.findMany({
          where: { id: { in: sentenceIds } },
          select: { id: true, sentence_en: true, sentence_en_meaning_fa: true },
        })
      : [];
    const sentencesById = new Map(sentences.map((sentence) => [sentence.id, sentence]));
    const items = rows.map((row) => {
      const associatedSentences = wordSentenceIds(row.sentenceIds).flatMap((sentenceId) => {
        const sentence = sentencesById.get(sentenceId);
        return sentence ? [sentence] : [];
      });
      const values: Record<CustomExtractionFieldKey, unknown> = {
        base_form: row.english.base_form,
        meaning_fa: row.meaning?.canonical_text ?? null,
        other_meanings_fa: positiveJsonIds(row.otherMeaningIds).flatMap((id) => {
          const meaning = otherMeaningsById.get(id);
          return meaning ? [meaning] : [];
        }),
        meaning_fa_IPA: row.meaning?.meaning_fa_IPA ?? null,
        phonetic_us: row.english.phonetic_us,
        sentence_en: null,
        sentence_en_meaning_fa: null,
        imageability: row.imageability,
        learning_depth: row.learning_depth,
        productive_target: row.productive_target,
        pos: row.pos,
        concept_explained_fa: row.concept_explained_fa,
        other_meanings_en: row.other_meanings_en,
        category: row.category,
        hint_to_select: row.hint_to_select,
      };
      const requestedOutputs = outputs.filter((field) => {
        switch (field) {
          case "base_form": return !row.english.base_form.trim();
          case "meaning_fa": return !row.meaning?.canonical_text?.trim();
          case "other_meanings_fa": return !row.meanings_confirmed && Boolean(row.meaning);
          case "meaning_fa_IPA": return Boolean(row.meaning) && !row.meaning?.meaning_fa_IPA?.trim();
          case "phonetic_us": return !row.english.phonetic_us?.trim();
          case "sentence_en": return associatedSentences.length === 0;
          case "sentence_en_meaning_fa": return associatedSentences.length === 0
            ? outputs.includes("sentence_en")
            : associatedSentences.some((sentence) => !sentence.sentence_en_meaning_fa?.trim());
          case "imageability": return row.imageability == null || row.imageability <= 0;
          case "learning_depth": return row.learning_depth == null || row.learning_depth === 0;
          case "productive_target": return row.productive_target == null || row.productive_target === 0;
          case "pos": return !row.pos?.trim();
          case "concept_explained_fa": return !row.concept_explained_fa?.trim();
          default: return false;
        }
      });
      const needsOtherMeaningsReview = requestedOutputs.includes("other_meanings_fa");
      const selectedFieldValues = Object.fromEntries(
        inputs
          .filter((key) => key !== "sentence_en" && key !== "sentence_en_meaning_fa")
          .map((key) => [key, values[key]]),
      );
      const fieldValues = needsOtherMeaningsReview
        ? {
            ...selectedFieldValues,
            base_form: values.base_form,
            meaning_fa: values.meaning_fa,
            other_meanings_fa: values.other_meanings_fa,
            pos: values.pos,
            concept_explained_fa: values.concept_explained_fa,
          }
        : selectedFieldValues;
      const includeSentenceContext =
        inputs.includes("sentence_en") ||
        inputs.includes("sentence_en_meaning_fa") ||
        requestedOutputs.includes("sentence_en_meaning_fa") ||
        needsOtherMeaningsReview;
      const sentenceValues = includeSentenceContext
        ? associatedSentences.flatMap((sentence) => {
            if (
              requestedOutputs.includes("sentence_en_meaning_fa") &&
              !needsOtherMeaningsReview &&
              typeof sentence.sentence_en_meaning_fa === "string" &&
              sentence.sentence_en_meaning_fa.trim()
            ) {
              return [];
            }
            return [{
              sentence_id: sentence.id,
              ...(inputs.includes("sentence_en") || requestedOutputs.includes("sentence_en_meaning_fa") || needsOtherMeaningsReview
                ? { sentence_en: sentence.sentence_en }
                : {}),
              ...(inputs.includes("sentence_en_meaning_fa") || needsOtherMeaningsReview
                ? { sentence_en_meaning_fa: sentence.sentence_en_meaning_fa }
                : {}),
            }];
          })
        : [];
      return { word_id: row.id, requested_outputs: requestedOutputs, fields: fieldValues, sentences: sentenceValues };
    });

    return NextResponse.json({ ok: true, inputs, outputs, total, fetched: items.length, limit, items });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
