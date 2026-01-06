import fs from "node:fs";
import path from "node:path";

import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";

dotenv.config();

const prisma = new PrismaClient();

const inputPath =
  process.env.WORDS_JSON_PATH ||
  path.join(process.cwd(), "EnglishLearningApp.words.json");

const allowedFields = [
  "anki_link_id",
  "base_form",
  "phonetic_us",
  "meaning_fa",
  "meaning_fa_IPA",
  "pos",
  "concept_explained",
  "concept_explained_fa",
  "word_hint_story",
  "sentence_en",
  "example_meaning_fa",
  "explanation_for_sentence_meaning",
  "learning_depth",
  "mixed_sentence",
  "category",
  "typeOfWordInDb",
  "hint_sentence",
  "first_letter_en_hint",
  "first_letter_fa_hint",
  "hint_to_select",
  "word_note",
  "common_error",
];

function toWordCreateInput(doc) {
  const anki_link_id = doc?._id?.$oid;
  if (!anki_link_id) return null;

  const data = { anki_link_id };
  for (const field of allowedFields) {
    if (field === "anki_link_id") continue;
    if (doc[field] !== undefined) data[field] = doc[field];
  }

  if (!data.base_form || !data.meaning_fa || !data.meaning_fa_IPA || !data.sentence_en) {
    return null;
  }

  return data;
}

async function main() {
  if (!fs.existsSync(inputPath)) {
    throw new Error(`Input file not found: ${inputPath}`);
  }

  const raw = fs.readFileSync(inputPath, "utf8");
  const docs = JSON.parse(raw);
  if (!Array.isArray(docs)) {
    throw new Error("Expected JSON array at file root.");
  }

  const rows = [];
  let skipped = 0;

  for (const doc of docs) {
    const row = toWordCreateInput(doc);
    if (!row) {
      skipped += 1;
      continue;
    }
    rows.push(row);
  }

  const batchSize = 500;
  let inserted = 0;

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const result = await prisma.word.createMany({
      data: batch,
      skipDuplicates: true,
    });
    inserted += result.count;
    console.log(`Inserted so far: ${inserted}/${rows.length}`);
  }

  console.log(
    `Done. Total in file: ${docs.length}, prepared: ${rows.length}, inserted: ${inserted}, skipped: ${skipped}`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
