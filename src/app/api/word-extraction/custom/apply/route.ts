import "server-only";

import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { normalizeIpaForDb } from "@/lib/ipa/normalize";
import { prisma } from "@/lib/prisma";
import { addPersianWordWithClient } from "@/lib/tables/persianWord";
import {
  CUSTOM_EXTRACTION_OUTPUT_FIELDS,
  type CustomExtractionFieldKey,
} from "@/lib/word-extraction/customExtractionFields";
import { touchWordSensesLinkedToSentenceId, updateWordSense } from "@/lib/words/wordSenseRepo";
import { wordSentenceIds } from "@/lib/words/sentenceIds";

export const runtime = "nodejs";

type ResponseSentence = {
  sentence_id: number | null;
  sentence_en?: string;
  sentence_en_meaning_fa?: string;
};

type ResponseItem = {
  word_id: number;
  fields: Record<string, unknown>;
  sentences: ResponseSentence[];
};

type RequestItem = {
  word_id: number;
  requested_outputs: CustomExtractionFieldKey[];
};

const outputKeySet = new Set(CUSTOM_EXTRACTION_OUTPUT_FIELDS.map((field) => field.key));
const sentenceOutputKeys = new Set<CustomExtractionFieldKey>(["sentence_en", "sentence_en_meaning_fa"]);

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function positiveInt(value: unknown) {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : null;
}

function nonEmptyString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function parseOutputs(value: unknown): CustomExtractionFieldKey[] | null {
  if (!Array.isArray(value)) return null;
  const outputs = [...new Set(value.filter((field): field is CustomExtractionFieldKey =>
    typeof field === "string" && outputKeySet.has(field as CustomExtractionFieldKey),
  ))];
  return outputs.length === value.length && outputs.length ? outputs : null;
}

function parseRequests(value: unknown, outputs: CustomExtractionFieldKey[]) {
  const issues: string[] = [];
  const requests = new Map<number, RequestItem>();
  if (!Array.isArray(value)) return { requests, issues: ["requests must be an array"] };

  value.forEach((raw, index) => {
    if (!isObject(raw)) {
      issues.push(`requests[${index}] must be an object`);
      return;
    }
    const wordId = positiveInt(raw.word_id);
    const requestedOutputs = parseOutputs(raw.requested_outputs);
    if (!wordId) issues.push(`requests[${index}].word_id must be a positive integer`);
    else if (requests.has(wordId)) issues.push(`requests contains duplicate word_id: ${wordId}`);
    if (!requestedOutputs) issues.push(`requests[${index}].requested_outputs must contain unique supported fields`);
    const unselected = requestedOutputs?.filter((field) => !outputs.includes(field)) ?? [];
    if (unselected.length) issues.push(`requests[${index}] contains unselected output(s): ${unselected.join(", ")}`);
    if (wordId && requestedOutputs) requests.set(wordId, { word_id: wordId, requested_outputs: requestedOutputs });
  });
  return { requests, issues };
}

function validateItems(value: unknown, requests: Map<number, RequestItem>) {
  const issues: Array<{ index: number; issues: string[] }> = [];
  const items: ResponseItem[] = [];
  const seenWordIds = new Set<number>();
  if (!Array.isArray(value)) return { items, issues: [{ index: -1, issues: ["items must be an array"] }] };

  value.forEach((raw, index) => {
    const itemIssues: string[] = [];
    if (!isObject(raw)) {
      issues.push({ index, issues: ["Item must be an object"] });
      return;
    }
    const extraTopKeys = Object.keys(raw).filter((key) => !["word_id", "fields", "sentences"].includes(key));
    if (extraTopKeys.length) itemIssues.push(`Extra top-level field(s): ${extraTopKeys.join(", ")}`);

    const wordId = positiveInt(raw.word_id);
    if (!wordId) itemIssues.push("word_id must be a positive integer");
    else if (seenWordIds.has(wordId)) itemIssues.push(`Duplicate word_id: ${wordId}`);

    const itemOutputs = wordId ? requests.get(wordId)?.requested_outputs : undefined;
    if (wordId && !itemOutputs) itemIssues.push(`word_id ${wordId} is not part of the current input package`);
    const fieldOutputs = itemOutputs?.filter((field) => !sentenceOutputKeys.has(field)) ?? [];
    const sentenceEnRequested = itemOutputs?.includes("sentence_en") ?? false;
    const sentenceMeaningRequested = itemOutputs?.includes("sentence_en_meaning_fa") ?? false;

    const fields = isObject(raw.fields) ? raw.fields : null;
    if (!fields) itemIssues.push("fields must be an object");
    if (fields) {
      const extraFields = Object.keys(fields).filter((field) => !fieldOutputs.includes(field as CustomExtractionFieldKey));
      const missingFields = fieldOutputs.filter((field) => !(field in fields));
      if (extraFields.length) itemIssues.push(`Unrequested field(s): ${extraFields.join(", ")}`);
      if (missingFields.length) itemIssues.push(`Missing requested field(s): ${missingFields.join(", ")}`);
    }

    const rawSentences = Array.isArray(raw.sentences) ? raw.sentences : null;
    if (!rawSentences) itemIssues.push("sentences must be an array");
    const sentences: ResponseSentence[] = [];
    if (rawSentences) {
      if (!sentenceEnRequested && !sentenceMeaningRequested && rawSentences.length) {
        itemIssues.push("sentences must be empty when no sentence output is requested");
      }
      rawSentences.forEach((rawSentence, sentenceIndex) => {
        if (!isObject(rawSentence)) {
          itemIssues.push(`sentences[${sentenceIndex}] must be an object`);
          return;
        }
        const extraKeys = Object.keys(rawSentence).filter((key) =>
          !["sentence_id", "sentence_en", "sentence_en_meaning_fa"].includes(key),
        );
        if (extraKeys.length) itemIssues.push(`sentences[${sentenceIndex}] extra field(s): ${extraKeys.join(", ")}`);

        const sentenceId = rawSentence.sentence_id === null ? null : positiveInt(rawSentence.sentence_id);
        if (rawSentence.sentence_id !== null && !sentenceId) {
          itemIssues.push(`sentences[${sentenceIndex}].sentence_id must be a positive integer or null`);
        }
        const sentenceEn = rawSentence.sentence_en === undefined ? undefined : nonEmptyString(rawSentence.sentence_en);
        const sentenceMeaning = rawSentence.sentence_en_meaning_fa === undefined
          ? undefined
          : nonEmptyString(rawSentence.sentence_en_meaning_fa);
        if (rawSentence.sentence_en !== undefined && !sentenceEn) {
          itemIssues.push(`sentences[${sentenceIndex}].sentence_en must be a non-empty string`);
        }
        if (rawSentence.sentence_en_meaning_fa !== undefined && !sentenceMeaning) {
          itemIssues.push(`sentences[${sentenceIndex}].sentence_en_meaning_fa must be a non-empty string`);
        }
        if (sentenceId === null && (!sentenceEnRequested || !sentenceEn)) {
          itemIssues.push(`sentences[${sentenceIndex}] with sentence_id null requires requested sentence_en`);
        }
        if (sentenceMeaningRequested && !sentenceMeaning) {
          itemIssues.push(`sentences[${sentenceIndex}] requires sentence_en_meaning_fa`);
        }
        if (!sentenceEnRequested && rawSentence.sentence_en !== undefined) {
          itemIssues.push(`sentences[${sentenceIndex}].sentence_en was not requested`);
        }
        if (!sentenceMeaningRequested && rawSentence.sentence_en_meaning_fa !== undefined) {
          itemIssues.push(`sentences[${sentenceIndex}].sentence_en_meaning_fa was not requested`);
        }
        sentences.push({
          sentence_id: sentenceId,
          ...(sentenceEn ? { sentence_en: sentenceEn } : {}),
          ...(sentenceMeaning ? { sentence_en_meaning_fa: sentenceMeaning } : {}),
        });
      });
      if (sentenceEnRequested && !sentences.some((sentence) => sentence.sentence_id === null)) {
        itemIssues.push("sentence_en output requires one new sentence object with sentence_id null");
      }
      if (sentenceMeaningRequested && !sentences.length) {
        itemIssues.push("sentence_en_meaning_fa output requires at least one identified sentence object");
      }
    }

    if (itemIssues.length || !wordId || !itemOutputs || !fields || !rawSentences) {
      issues.push({ index, issues: itemIssues });
      return;
    }
    seenWordIds.add(wordId);
    items.push({ word_id: wordId, fields, sentences });
  });
  const missingWordIds = [...requests.keys()].filter((wordId) => !seenWordIds.has(wordId));
  if (missingWordIds.length) {
    issues.push({ index: -1, issues: [`Missing response object(s) for word_id: ${missingWordIds.join(", ")}`] });
  }
  return { items, issues };
}

function validateOtherMeanings(value: unknown): string[] {
  if (!Array.isArray(value) || value.some((meaning) => typeof meaning !== "string" || !meaning.trim())) {
    throw new Error("other_meanings_fa must be an array of non-empty strings or an empty array.");
  }
  return [...new Set(value.map((meaning) => meaning.trim()))];
}

function validateFieldValue(field: CustomExtractionFieldKey, value: unknown): string | number {
  if (["base_form", "meaning_fa", "meaning_fa_IPA", "phonetic_us", "pos", "concept_explained_fa"].includes(field)) {
    const text = nonEmptyString(value);
    if (!text) throw new Error(`${field} must be a non-empty string.`);
    return text;
  }
  if (field === "imageability") {
    if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 100) {
      throw new Error("imageability must be an integer between 0 and 100.");
    }
    return value;
  }
  if (field === "learning_depth") {
    if (typeof value !== "number" || (value !== -100 && (value < 0 || value > 1))) {
      throw new Error("learning_depth must be -100 or a number between 0 and 1.");
    }
    return value;
  }
  if (field === "productive_target") {
    if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 101) {
      throw new Error("productive_target must be an integer between 0 and 101.");
    }
    return value;
  }
  throw new Error(`Unsupported field: ${field}`);
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    const outputs = parseOutputs(body?.outputs);
    if (!outputs) {
      return NextResponse.json({ ok: false, error: "outputs must contain unique supported output fields." }, { status: 400 });
    }
    const parsedRequests = parseRequests(body?.requests, outputs);
    if (parsedRequests.issues.length) {
      return NextResponse.json(
        { ok: false, error: "Invalid extraction input package.", issues: parsedRequests.issues },
        { status: 400 },
      );
    }
    const validated = validateItems(body?.items, parsedRequests.requests);
    if (validated.issues.length) {
      return NextResponse.json({ ok: false, error: "Invalid AI response structure.", issues: validated.issues }, { status: 400 });
    }

    const results: Array<{ word_id: number; ok: boolean; updated_fields?: string[]; sentence_ids?: number[]; error?: string }> = [];
    for (const item of validated.items) {
      try {
        const result = await prisma.$transaction(async (tx) => {
          const word = await tx.wordSense.findUnique({
            where: { id: item.word_id },
            select: {
              id: true,
              anki_link_id: true,
              englishId: true,
              meaningId: true,
              sentenceIds: true,
            },
          });
          if (!word) throw new Error(`WordSense ${item.word_id} not found.`);

          const updatedFields: string[] = [];
          const wordPatch: Prisma.WordSenseUpdateInput = {};
          let meaningId = word.meaningId;

          if ("base_form" in item.fields) {
            const baseForm = validateFieldValue("base_form", item.fields.base_form) as string;
            await tx.englishWord.update({ where: { id: word.englishId }, data: { base_form: baseForm } });
            wordPatch.conceptMergeReviewed = false;
            updatedFields.push("base_form");
          }
          if ("phonetic_us" in item.fields) {
            const phonetic = validateFieldValue("phonetic_us", item.fields.phonetic_us) as string;
            await tx.englishWord.update({
              where: { id: word.englishId },
              data: {
                phonetic_us: phonetic,
                phonetic_us_normalized: normalizeIpaForDb(phonetic, 2000),
                json_hint: null,
              },
            });
            updatedFields.push("phonetic_us");
          }
          if ("meaning_fa" in item.fields) {
            const meaningFa = validateFieldValue("meaning_fa", item.fields.meaning_fa) as string;
            const meaningFaIpa = "meaning_fa_IPA" in item.fields
              ? validateFieldValue("meaning_fa_IPA", item.fields.meaning_fa_IPA) as string
              : null;
            meaningId = (await addPersianWordWithClient(meaningFa, {
              meaningFaIpa,
              meaningFaIpaNormalized: meaningFaIpa ? normalizeIpaForDb(meaningFaIpa, 2000) : null,
            }, tx)).item.id;
            wordPatch.meaning = { connect: { id: meaningId } };
            updatedFields.push("meaning_fa");
          }
          if ("other_meanings_fa" in item.fields) {
            if (!meaningId) {
              throw new Error("other_meanings_fa cannot be applied because this WordSense has no primary PersianWord.");
            }
            const otherMeanings = validateOtherMeanings(item.fields.other_meanings_fa);
            const otherIds = await Promise.all(
              otherMeanings.map(async (meaning) =>
                (await addPersianWordWithClient(meaning, {}, tx)).item.id,
              ),
            );
            wordPatch.otherMeaningIds = [
              ...new Set(otherIds.filter((otherId) => otherId !== meaningId)),
            ];
            updatedFields.push("other_meanings_fa");
          }
          if ("meaning_fa_IPA" in item.fields) {
            const meaningIpa = validateFieldValue("meaning_fa_IPA", item.fields.meaning_fa_IPA) as string;
            if (!meaningId) throw new Error("meaning_fa_IPA cannot be applied because this WordSense has no PersianWord.");
            await tx.persianWord.update({
              where: { id: meaningId },
              data: {
                meaning_fa_IPA: meaningIpa,
                meaning_fa_IPA_normalize: normalizeIpaForDb(meaningIpa, 2000),
                meaning_fa_IPA_confirmed: false,
              },
            });
            updatedFields.push("meaning_fa_IPA");
          }

          for (const field of ["imageability", "learning_depth", "productive_target", "pos", "concept_explained_fa"] as const) {
            if (!(field in item.fields)) continue;
            wordPatch[field] = validateFieldValue(field, item.fields[field]);
            updatedFields.push(field);
          }

          const associatedSentenceIds = new Set(wordSentenceIds(word.sentenceIds));
          for (const sentence of item.sentences) {
            if (sentence.sentence_id !== null) {
              if (!associatedSentenceIds.has(sentence.sentence_id)) {
                throw new Error(`Sentence ${sentence.sentence_id} is not linked to WordSense ${word.id}.`);
              }
              const existing = await tx.sentence.findUnique({
                where: { id: sentence.sentence_id },
                select: { sentence_en: true, sentence_en_meaning_fa: true },
              });
              if (!existing) throw new Error(`Sentence ${sentence.sentence_id} not found.`);
              if (sentence.sentence_en !== undefined && sentence.sentence_en !== existing.sentence_en) {
                throw new Error(`Existing Sentence ${sentence.sentence_id} text cannot be replaced by sentence_en extraction.`);
              }
              if (
                sentence.sentence_en_meaning_fa !== undefined &&
                sentence.sentence_en_meaning_fa !== existing.sentence_en_meaning_fa
              ) {
                await tx.sentence.update({
                  where: { id: sentence.sentence_id },
                  data: {
                    sentence_en_meaning_fa: sentence.sentence_en_meaning_fa,
                  },
                });
                await touchWordSensesLinkedToSentenceId(
                  sentence.sentence_id,
                  { resetMeaningReviewStatus: true },
                  tx,
                );
                updatedFields.push(`sentence_en_meaning_fa:${sentence.sentence_id}`);
              }
              continue;
            }

            const sentenceEn = sentence.sentence_en!;
            const existingByText = await tx.sentence.findUnique({
              where: { sentence_en: sentenceEn },
              select: { id: true, sentence_en_meaning_fa: true },
            });
            const createdOrFound = await tx.sentence.upsert({
              where: { sentence_en: sentenceEn },
              create: {
                sentence_en: sentenceEn,
                sentence_en_meaning_fa: sentence.sentence_en_meaning_fa ?? null,
              },
              update: sentence.sentence_en_meaning_fa === undefined
                ? {}
                : {
                    sentence_en_meaning_fa: sentence.sentence_en_meaning_fa,
                  },
              select: { id: true },
            });
            associatedSentenceIds.add(createdOrFound.id);
            updatedFields.push(`sentence_en:${createdOrFound.id}`);
            if (
              sentence.sentence_en_meaning_fa !== undefined &&
              existingByText?.sentence_en_meaning_fa !== sentence.sentence_en_meaning_fa
            ) {
              await touchWordSensesLinkedToSentenceId(
                createdOrFound.id,
                { resetMeaningReviewStatus: true },
                tx,
              );
              updatedFields.push(`sentence_en_meaning_fa:${createdOrFound.id}`);
            }
          }

          if (item.sentences.some((sentence) => sentence.sentence_id === null)) {
            wordPatch.sentenceIds = [...associatedSentenceIds];
          }
          if (!Object.keys(wordPatch).length) wordPatch.anki_link_id = word.anki_link_id;
          await updateWordSense({ where: { id: word.id }, data: wordPatch, select: { id: true } }, tx);

          return { updatedFields, sentenceIds: [...associatedSentenceIds] };
        });
        results.push({
          word_id: item.word_id,
          ok: true,
          updated_fields: result.updatedFields,
          sentence_ids: result.sentenceIds,
        });
      } catch (error) {
        results.push({ word_id: item.word_id, ok: false, error: error instanceof Error ? error.message : String(error) });
      }
    }

    const updated = results.filter((result) => result.ok).length;
    return NextResponse.json({ ok: true, total: results.length, updated, failed: results.length - updated, results });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
