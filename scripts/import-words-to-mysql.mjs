import fs from "node:fs";
import path from "node:path";

import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";

dotenv.config();

const prisma = new PrismaClient();
const inputPath = process.env.WORDS_JSON_PATH || path.join(process.cwd(), "EnglishLearningApp.words.json");

const WORD_FIELDS = [
  "pos",
  "concept_explained",
  "concept_explained_fa",
  "word_hint_story",
  "explanation_for_sentence_meaning",
  "learning_depth",
  "mixed_sentence",
  "other_meanings_en",
  "category",
  "typeOfWordInDb",
  "hint_sentence",
  "first_letter_en_hint",
  "first_letter_fa_hint",
  "hint_to_select",
  "word_note",
  "common_error",
  "imageability",
  "productive_target",
];

const ENGLISH_TEXT_SEPARATORS = /[\s\u00A0\u200B-\u200D\u2060\uFEFF]+/gu;
const HYPHEN_LIKE = /[-_\u058A\u05BE\u1400\u1806\u2010-\u2015\u2E17\u2E1A\u2E3A-\u2E3B\u2E40\u301C\u3030\u30A0\uFE31-\uFE32\uFE58\uFE63\uFF0D]+/gu;

function normalizeEnglishWordText(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036F]/gu, "")
    .replace(/[’‘`]/gu, "'")
    .replace(HYPHEN_LIKE, " ")
    .toLocaleLowerCase("en-US")
    .replace(/[^a-z'\s]/gu, " ")
    .replace(ENGLISH_TEXT_SEPARATORS, " ")
    .trim()
    .split(" ")
    .map((part) => part.replace(/^'+|'+$/gu, ""))
    .filter(Boolean)
    .join(" ");
}

const PERSIAN_REPLACEMENTS = { ك: "ک", ي: "ی", ى: "ی", ئ: "ی", أ: "ا", إ: "ا", ٱ: "ا", ؤ: "و", ة: "ه", ۀ: "ه" };
const PERSIAN_ALLOWED = /[^اآبپتثجچحخدذرزژسشصضطظعغفقکگلمنوهی]/gu;
function normalizePersian(value) {
  const canonical = String(value ?? "")
    .normalize("NFC")
    .replace(/[كيىئأإٱؤةۀ]/gu, (char) => PERSIAN_REPLACEMENTS[char] ?? char)
    .replace(/[ـ\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/gu, "")
    .replace(/[\s\u00A0\u200B-\u200D\u2060\uFEFF]+/gu, " ")
    .trim();
  return { canonical, normalized: canonical.replaceAll(" ", "").replace(PERSIAN_ALLOWED, "") };
}

function prepare(doc) {
  const anki_link_id = String(doc?._id?.$oid ?? doc?.anki_link_id ?? "").trim();
  const base_form = normalizeEnglishWordText(doc?.base_form);
  const meaning = normalizePersian(doc?.meaning_fa);
  const sentence_en = String(doc?.sentence_en ?? "").trim();
  if (!anki_link_id || !base_form || !meaning.normalized || !sentence_en) return null;

  const wordData = { anki_link_id };
  for (const field of WORD_FIELDS) {
    if (doc[field] !== undefined) wordData[field] = doc[field];
  }
  return {
    wordData,
    base_form,
    phonetic_us: String(doc?.phonetic_us ?? "").trim() || null,
    meaning,
    meaning_fa_IPA: String(doc?.meaning_fa_IPA ?? "").trim() || null,
    sentence_en,
    sentence_en_meaning_fa: String(doc?.sentence_en_meaning_fa ?? "").trim() || null,
  };
}

async function importRow(row) {
  return prisma.$transaction(async (tx) => {
    const english = await tx.englishWord.upsert({
      where: { base_form: row.base_form },
      update: row.phonetic_us ? { phonetic_us: row.phonetic_us } : {},
      create: { base_form: row.base_form, phonetic_us: row.phonetic_us },
      select: { id: true },
    });
    const existingMeaning = await tx.persianWord.findFirst({
      where: { normalized_text: row.meaning.normalized },
      select: { id: true },
    });
    const meaning = existingMeaning ?? await tx.persianWord.create({
      data: {
        canonical_text: row.meaning.canonical,
        normalized_text: row.meaning.normalized,
        not_normalized_texts: [],
        meaning_fa_IPA: row.meaning_fa_IPA,
      },
      select: { id: true },
    });
    const word = await tx.word.create({
      data: { ...row.wordData, englishId: english.id, meaningId: meaning.id },
      select: { id: true },
    });
    const sentence = await tx.sentence.upsert({
      where: { sentence_en: row.sentence_en },
      update: { sentence_en_meaning_fa: row.sentence_en_meaning_fa },
      create: { sentence_en: row.sentence_en, sentence_en_meaning_fa: row.sentence_en_meaning_fa },
      select: { id: true },
    });
    await tx.sentenceWordLink.create({ data: { sentenceId: sentence.id, wordId: word.id, isPrimary: true } });
    return word;
  });
}

async function main() {
  if (!fs.existsSync(inputPath)) throw new Error(`Input file not found: ${inputPath}`);
  const docs = JSON.parse(fs.readFileSync(inputPath, "utf8"));
  if (!Array.isArray(docs)) throw new Error("Expected JSON array at file root.");

  let inserted = 0;
  let skipped = 0;
  for (const doc of docs) {
    const row = prepare(doc);
    if (!row) { skipped += 1; continue; }
    const exists = await prisma.word.findUnique({ where: { anki_link_id: row.wordData.anki_link_id }, select: { id: true } });
    if (exists) { skipped += 1; continue; }
    await importRow(row);
    inserted += 1;
    if (inserted % 100 === 0) process.stdout.write(`Imported ${inserted}\n`);
  }
  process.stdout.write(`Done. Total=${docs.length} inserted=${inserted} skipped=${skipped}\n`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => prisma.$disconnect());
