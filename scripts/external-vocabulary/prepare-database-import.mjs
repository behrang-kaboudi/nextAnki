import fs from "node:fs";
import path from "node:path";

import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";

const INPUT_FILE = process.env.EXTERNAL_VOCAB_ENRICHED_FILE ?? "prompt-responses/external-vocabulary/2026-08-11-legacy-pipeline/structurally-valid-vocabulary-enriched-reviewed.json";
const VALIDATION_FILE = process.env.EXTERNAL_VOCAB_VALIDATION_FILE ?? "prompt-responses/external-vocabulary/2026-08-11-legacy-pipeline/external-vocabulary-enrichment-reviewed-validation.json";
const OUTPUT_FILE = process.env.EXTERNAL_VOCAB_IMPORT_PLAN_FILE ?? "prompt-responses/external-vocabulary/2026-08-11-legacy-pipeline/external-vocabulary-database-import-plan.json";
const MATCH_POS = process.env.EXTERNAL_VOCAB_MATCH_POS === "1";

for (const name of [".env.local", ".env"]) {
  const file = path.join(process.cwd(), name);
  if (fs.existsSync(file)) dotenv.config({ path: file, quiet: true });
}

function normalizeEnglish(value) {
  return value.normalize("NFKC").replace(/[’‘`]/gu, "'").replace(/\s+/gu, " ").trim().toLocaleLowerCase("en-US");
}

function normalizePersian(value) {
  const replacements = { "ك": "ک", "ي": "ی", "ى": "ی", "ۍ": "ی", "ې": "ی", "ے": "ی", "ئ": "ی", "أ": "ا", "إ": "ا", "ٱ": "ا", "ؤ": "و", "ة": "ه", "ۀ": "ه" };
  return value.normalize("NFC")
    .replace(/[كيىۍېےئأإٱؤةۀ]/gu, (character) => replacements[character] ?? character)
    .replace(/[ـ\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/gu, "")
    .replace(/[^اآبپتثجچحخدذرزژسشصضطظعغفقکگلمنوهی]/gu, "");
}

const enriched = JSON.parse(fs.readFileSync(INPUT_FILE, "utf8"));
if (fs.existsSync(VALIDATION_FILE)) {
  const validation = JSON.parse(fs.readFileSync(VALIDATION_FILE, "utf8"));
  if (validation.error_rows || validation.review_rows) {
    throw new Error(`Validation still has ${validation.error_rows} error rows and ${validation.review_rows} review rows.`);
  }
}
const completedEntries = enriched.entries.filter((item) => !item.status || String(item.status).startsWith("completed"));

const prisma = new PrismaClient();
try {
  const existing = await prisma.wordSense.findMany({
    select: {
      id: true,
      pos: true,
      english: { select: { base_form: true } },
      meaning: { select: { normalized_text: true } },
    },
  });
  const databasePairs = new Map();
  for (const row of existing) {
    if (!row.meaning) continue;
    const pairKey = `${normalizeEnglish(row.english.base_form)}\u0000${row.meaning.normalized_text}`;
    const key = MATCH_POS ? `${pairKey}\u0000${row.pos?.trim().toLocaleLowerCase("en-US") ?? ""}` : pairKey;
    const values = databasePairs.get(key) ?? [];
    values.push({ word_sense_id: row.id, pos: row.pos });
    databasePairs.set(key, values);
  }

  const seenTriples = new Map();
  const insert = [];
  const syncExisting = [];
  const skippedDatabasePair = [];
  const skippedInternalDuplicate = [];
  const samePairDifferentPos = [];
  const generatedPairPos = new Map();
  for (const item of completedEntries) {
    const english = normalizeEnglish(item.base_form);
    const persian = normalizePersian(item.meaning_fa);
    const pos = item.pos.trim().toLocaleLowerCase("en-US");
    const pairKey = `${english}\u0000${persian}`;
    const tripleKey = `${pairKey}\u0000${pos}`;
    const databaseKey = MATCH_POS ? tripleKey : pairKey;
    if (databasePairs.has(databaseKey)) {
      skippedDatabasePair.push({ source_row_index: item.source_row_index, base_form: item.base_form, meaning_fa: item.meaning_fa, existing: databasePairs.get(databaseKey) });
      syncExisting.push({
        source_row_index: item.source_row_index,
        source_refs: item.source_refs,
        lexical_type: item.lexical_type,
        base_form: item.base_form,
        meaning_fa: item.meaning_fa,
        other_meanings_fa: item.other_meanings_fa,
        pos: item.pos,
        concept_explained_fa: item.concept_explained_fa,
        sentence_en: item.sentence_en,
        sentence_en_meaning_fa: item.sentence_en_meaning_fa,
        productive_target: item.new_productive_target ?? item.productive_target,
      });
      continue;
    }
    if (seenTriples.has(tripleKey)) {
      skippedInternalDuplicate.push({ source_row_index: item.source_row_index, duplicate_of_source_row_index: seenTriples.get(tripleKey), base_form: item.base_form, meaning_fa: item.meaning_fa, pos: item.pos });
      continue;
    }
    seenTriples.set(tripleKey, item.source_row_index);
    const priorPos = generatedPairPos.get(pairKey) ?? [];
    if (priorPos.length && !priorPos.includes(pos)) {
      samePairDifferentPos.push({ source_row_index: item.source_row_index, base_form: item.base_form, meaning_fa: item.meaning_fa, pos: item.pos, other_pos: priorPos });
    }
    generatedPairPos.set(pairKey, [...new Set([...priorPos, pos])]);
    insert.push({
      source_row_index: item.source_row_index,
      source_refs: item.source_refs,
      lexical_type: item.lexical_type,
      base_form: item.base_form,
      meaning_fa: item.meaning_fa,
      other_meanings_fa: item.other_meanings_fa,
      pos: item.pos,
      concept_explained_fa: item.concept_explained_fa,
      sentence_en: item.sentence_en,
      sentence_en_meaning_fa: item.sentence_en_meaning_fa,
      productive_target: item.new_productive_target ?? item.productive_target,
    });
  }
  const result = {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    source_file: INPUT_FILE,
    live_database_word_senses: existing.length,
    total_enriched_entries: completedEntries.length,
    insert_count: insert.length,
    sync_existing_count: syncExisting.length,
    execute_count: insert.length + syncExisting.length,
    skipped_database_pair_count: skippedDatabasePair.length,
    skipped_internal_duplicate_count: skippedInternalDuplicate.length,
    same_pair_different_pos_count: samePairDifferentPos.length,
    skipped_database_pairs: skippedDatabasePair,
    skipped_internal_duplicates: skippedInternalDuplicate,
    same_pair_different_pos: samePairDifferentPos,
    entries: [...insert, ...syncExisting],
  };
  fs.writeFileSync(OUTPUT_FILE, `${JSON.stringify(result)}\n`);
  process.stdout.write(`${JSON.stringify({ output_file: OUTPUT_FILE, ...Object.fromEntries(Object.entries(result).filter(([key]) => key.endsWith("_count") || key === "total_enriched_entries" || key === "live_database_word_senses")) }, null, 2)}\n`);
} finally {
  await prisma.$disconnect();
}
