import "server-only";

import { randomUUID } from "node:crypto";

import { normalizeEnglishWordText } from "@/lib/english/normalize";
import { normalizeIpaForDb } from "@/lib/ipa/normalize";
import { normalizePersianForStorage, normalizePersianFull } from "@/lib/persian/normalize";
import { prisma } from "@/lib/prisma";
import { addPersianWordWithClient } from "@/lib/tables/persianWord";
import { idiomReviewCompletedForBaseForm } from "@/lib/words/idiomReview";
import { updateWordSense } from "@/lib/words/wordSenseRepo";

export type SevenFieldWordSenseInput = {
  base_form: string;
  pos: string;
  meaning_fa: string;
  other_meanings_fa: string[];
  concept_explained_fa: string;
  sentence_en: string;
  sentence_en_meaning_fa: string;
};

export type WordSenseIntakeEnrichment = {
  phonetic_us: string;
  meaning_fa_IPA: string;
  imageability: number;
  learning_depth: number;
  productive_target: number;
};

export type WordSenseIntakeInput = SevenFieldWordSenseInput & Partial<WordSenseIntakeEnrichment>;

const FIELD_NAMES = [
  "base_form",
  "pos",
  "meaning_fa",
  "other_meanings_fa",
  "concept_explained_fa",
  "sentence_en",
  "sentence_en_meaning_fa",
] as const;

const ENRICHMENT_FIELD_NAMES = [
  "phonetic_us",
  "meaning_fa_IPA",
  "imageability",
  "learning_depth",
  "productive_target",
] as const;

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function requiredString(value: unknown, field: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${field} must be a non-empty string.`);
  }
  return value.trim();
}

function parseCoreWordSenseInput(value: Record<string, unknown>): SevenFieldWordSenseInput {
  const missing = FIELD_NAMES.filter((key) => !(key in value));
  if (missing.length) throw new Error(`Missing sense field(s): ${missing.join(", ")}.`);

  const base_form = normalizeEnglishWordText(requiredString(value.base_form, "base_form"));
  if (!base_form) throw new Error("base_form must contain an English word.");
  const pos = requiredString(value.pos, "pos").toLocaleLowerCase("en-US");
  const meaning_fa = normalizePersianForStorage(requiredString(value.meaning_fa, "meaning_fa"));
  if (!normalizePersianFull(meaning_fa)) throw new Error("meaning_fa must contain Persian letters.");
  if (!Array.isArray(value.other_meanings_fa)) {
    throw new Error("other_meanings_fa must be an array.");
  }
  const other_meanings_fa = value.other_meanings_fa.map((item, index) => {
    const normalized = normalizePersianForStorage(requiredString(item, `other_meanings_fa[${index}]`));
    if (!normalizePersianFull(normalized)) {
      throw new Error(`other_meanings_fa[${index}] must contain Persian letters.`);
    }
    return normalized;
  });
  const normalizedMeanings = other_meanings_fa.map(normalizePersianFull);
  if (
    normalizedMeanings.includes(normalizePersianFull(meaning_fa)) ||
    new Set(normalizedMeanings).size !== normalizedMeanings.length
  ) {
    throw new Error("other_meanings_fa must be unique and must not repeat meaning_fa.");
  }

  return {
    base_form,
    pos,
    meaning_fa,
    other_meanings_fa,
    concept_explained_fa: requiredString(value.concept_explained_fa, "concept_explained_fa"),
    sentence_en: requiredString(value.sentence_en, "sentence_en"),
    sentence_en_meaning_fa: requiredString(value.sentence_en_meaning_fa, "sentence_en_meaning_fa"),
  };
}

export function parseSevenFieldWordSenseInput(value: unknown): SevenFieldWordSenseInput {
  if (!isObject(value)) throw new Error("sense must be an object.");
  const extras = Object.keys(value).filter(
    (key) => !FIELD_NAMES.includes(key as (typeof FIELD_NAMES)[number]),
  );
  if (extras.length) throw new Error(`Unexpected sense field(s): ${extras.join(", ")}.`);
  return parseCoreWordSenseInput(value);
}

export function parseWordSenseIntakeInput(value: unknown): WordSenseIntakeInput {
  if (!isObject(value)) throw new Error("sense must be an object.");
  const allowed = new Set<string>([...FIELD_NAMES, ...ENRICHMENT_FIELD_NAMES]);
  const extras = Object.keys(value).filter((key) => !allowed.has(key));
  if (extras.length) throw new Error(`Unexpected sense field(s): ${extras.join(", ")}.`);

  const core = parseCoreWordSenseInput(value);
  const suppliedEnrichment = ENRICHMENT_FIELD_NAMES.filter((key) => key in value);
  if (suppliedEnrichment.length === 0) return core;
  if (suppliedEnrichment.length !== ENRICHMENT_FIELD_NAMES.length) {
    const missing = ENRICHMENT_FIELD_NAMES.filter((key) => !(key in value));
    throw new Error(`A full sense must include every enrichment field. Missing: ${missing.join(", ")}.`);
  }

  const phonetic_us = requiredString(value.phonetic_us, "phonetic_us");
  const meaning_fa_IPA = requiredString(value.meaning_fa_IPA, "meaning_fa_IPA");
  const imageability = value.imageability;
  const learning_depth = value.learning_depth;
  const productive_target = value.productive_target;
  if (typeof imageability !== "number" || !Number.isInteger(imageability) || imageability < 1 || imageability > 100) {
    throw new Error("imageability must be an integer from 1 to 100.");
  }
  if (
    typeof learning_depth !== "number" ||
    !Number.isFinite(learning_depth) ||
    (learning_depth !== -100 && (learning_depth < 0 || learning_depth > 1))
  ) {
    throw new Error("learning_depth must be -100 or a number from 0 to 1.");
  }
  if (
    typeof productive_target !== "number" ||
    !Number.isInteger(productive_target) ||
    productive_target < 1 ||
    productive_target > 101
  ) {
    throw new Error("productive_target must be an integer from 1 to 101.");
  }

  return {
    ...core,
    phonetic_us,
    meaning_fa_IPA,
    imageability,
    learning_depth,
    productive_target,
  };
}

function hasFullEnrichment(input: WordSenseIntakeInput): input is SevenFieldWordSenseInput & WordSenseIntakeEnrichment {
  return ENRICHMENT_FIELD_NAMES.every((field) => input[field] !== undefined);
}

export async function createWordSenseFromIntake(input: WordSenseIntakeInput) {
  return prisma.$transaction(async (tx) => {
    const fullInput = hasFullEnrichment(input) ? input : null;
    const storedEnglish = await tx.englishWord.findUnique({
      where: { base_form: input.base_form },
      select: { id: true, phonetic_us: true },
    });
    let english = storedEnglish;
    if (!english) {
      english = await tx.englishWord.create({
        data: {
          base_form: input.base_form,
          ...(fullInput
            ? {
                phonetic_us: fullInput.phonetic_us,
                phonetic_us_normalized: normalizeIpaForDb(fullInput.phonetic_us, 2000),
              }
            : {}),
        },
        select: { id: true, phonetic_us: true },
      });
    } else if (fullInput) {
      if (english.phonetic_us && english.phonetic_us !== fullInput.phonetic_us) {
        throw new Error("phonetic_us conflicts with the existing EnglishWord value.");
      }
      if (!english.phonetic_us) {
        english = await tx.englishWord.update({
          where: { id: english.id },
          data: {
            phonetic_us: fullInput.phonetic_us,
            phonetic_us_normalized: normalizeIpaForDb(fullInput.phonetic_us, 2000),
            json_hint: null,
          },
          select: { id: true, phonetic_us: true },
        });
      }
    }
    const primaryMeaning = await addPersianWordWithClient(
      input.meaning_fa,
      fullInput
        ? {
            meaningFaIpa: fullInput.meaning_fa_IPA,
            meaningFaIpaNormalized: normalizeIpaForDb(fullInput.meaning_fa_IPA, 2000),
          }
        : {},
      tx,
    );
    const otherMeanings = await Promise.all(
      input.other_meanings_fa.map((meaning) => addPersianWordWithClient(meaning, {}, tx)),
    );

    const existing = await tx.wordSense.findFirst({
      where: {
        englishId: english.id,
        meaningId: primaryMeaning.item.id,
        pos: input.pos,
        concept_explained_fa: input.concept_explained_fa,
      },
      select: {
        id: true,
        anki_link_id: true,
        imageability: true,
        learning_depth: true,
        productive_target: true,
      },
      orderBy: { id: "asc" },
    });
    if (existing) {
      if (fullInput) {
        const scorePatch: {
          imageability?: number;
          learning_depth?: number;
          productive_target?: number;
        } = {};
        for (const field of ["imageability", "learning_depth", "productive_target"] as const) {
          const stored = existing[field];
          const incoming = fullInput[field];
          if (stored !== null && stored !== incoming) {
            throw new Error(`${field} conflicts with the existing WordSense value.`);
          }
          if (stored === null) scorePatch[field] = incoming;
        }
        if (Object.keys(scorePatch).length) {
          await updateWordSense({ where: { id: existing.id }, data: scorePatch }, tx);
        }
      }
      return { action: "existing" as const, id: existing.id, anki_link_id: existing.anki_link_id };
    }

    const storedSentence = await tx.sentence.findUnique({
      where: { sentence_en: input.sentence_en },
      select: { id: true, sentence_en_meaning_fa: true },
    });
    if (
      storedSentence?.sentence_en_meaning_fa &&
      storedSentence.sentence_en_meaning_fa !== input.sentence_en_meaning_fa
    ) {
      throw new Error("sentence_en already exists with a different Persian translation.");
    }
    const sentence = storedSentence
      ? storedSentence.sentence_en_meaning_fa
        ? storedSentence
        : await tx.sentence.update({
            where: { id: storedSentence.id },
            data: { sentence_en_meaning_fa: input.sentence_en_meaning_fa },
            select: { id: true, sentence_en_meaning_fa: true },
          })
      : await tx.sentence.create({
          data: {
        sentence_en: input.sentence_en,
        sentence_en_meaning_fa: input.sentence_en_meaning_fa,
          },
          select: { id: true, sentence_en_meaning_fa: true },
        });
    const otherMeaningIds = [
      ...new Set(
        otherMeanings
          .map((meaning) => meaning.item.id)
          .filter((id) => id !== primaryMeaning.item.id),
      ),
    ];
    const pending = await tx.wordSense.create({
      data: {
        anki_link_id: `pending_${randomUUID()}`,
        englishId: english.id,
        meaningId: primaryMeaning.item.id,
        otherMeaningIds,
        pos: input.pos,
        concept_explained_fa: input.concept_explained_fa,
        sentenceIds: [sentence.id],
        ...(fullInput
          ? {
              imageability: fullInput.imageability,
              learning_depth: fullInput.learning_depth,
              productive_target: fullInput.productive_target,
            }
          : {}),
        conceptMergeReviewed: false,
        idiomReviewCompleted: idiomReviewCompletedForBaseForm(input.base_form),
        meaningReviewStatus: "PENDING",
      },
      select: { id: true },
    });
    const created = await updateWordSense(
      {
        where: { id: pending.id },
        data: { anki_link_id: `${pending.id}_${Date.now()}` },
        select: { id: true, anki_link_id: true },
      },
      tx,
    );
    return { action: "created" as const, ...created };
  });
}
