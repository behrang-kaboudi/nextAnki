import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";

const INPUT_FILE = "prompt-responses/external-vocabulary/2026-08-11-legacy-pipeline/external-vocabulary-needs-generation-at-least-35-2067.json";
const RESULTS_FILE = "prompt-responses/external-vocabulary/2026-08-11-legacy-pipeline/external-vocabulary-needs-generation-at-least-35-2067-import-results.jsonl";
const execute = process.argv.includes("--execute");

for (const name of [".env.local", ".env"]) {
  const file = path.join(process.cwd(), name);
  if (fs.existsSync(file)) dotenv.config({ path: file, quiet: true });
}

function normalizeEnglish(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036F]/gu, "")
    .replace(/[’‘`]/gu, "'")
    .replace(/[-_\u058A\u05BE\u1400\u1806\u2010-\u2015\u2E17\u2E1A\u2E3A-\u2E3B\u2E40\u301C\u3030\u30A0\uFE31-\uFE32\uFE58\uFE63\uFF0D]+/gu, " ")
    .toLocaleLowerCase("en-US")
    .replace(/[^a-z'\s]/gu, " ")
    .replace(/[\s\u00A0\u200B-\u200D\u2060\uFEFF]+/gu, " ")
    .trim()
    .split(" ")
    .map((part) => part.replace(/^'+|'+$/gu, ""))
    .filter(Boolean)
    .join(" ");
}

function normalizePersian(value) {
  const replacements = { "ك": "ک", "ي": "ی", "ى": "ی", "ۍ": "ی", "ې": "ی", "ے": "ی", "ئ": "ی", "أ": "ا", "إ": "ا", "ٱ": "ا", "ؤ": "و", "ة": "ه", "ۀ": "ه" };
  return String(value ?? "").normalize("NFC")
    .replace(/[كيىۍېےئأإٱؤةۀ]/gu, (character) => replacements[character] ?? character)
    .replace(/[ـ\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/gu, "")
    .replace(/[^اآبپتثجچحخدذرزژسشصضطظعغفقکگلمنوهی]/gu, "");
}

function canonicalPersian(value) {
  const replacements = { "ك": "ک", "ي": "ی", "ى": "ی", "ۍ": "ی", "ې": "ی", "ے": "ی", "ئ": "ی", "أ": "ا", "إ": "ا", "ٱ": "ا", "ؤ": "و", "ة": "ه", "ۀ": "ه" };
  return String(value ?? "").normalize("NFC")
    .replace(/[كيىۍېےئأإٱؤةۀ]/gu, (character) => replacements[character] ?? character)
    .replace(/\s+/gu, " ")
    .trim();
}

const document = JSON.parse(fs.readFileSync(INPUT_FILE, "utf8"));
if (!Array.isArray(document.entries) || document.entries.length !== 2067) {
  throw new Error(`Expected 2067 entries, received ${document.entries?.length}`);
}

const prepared = document.entries.map((entry) => ({
  source_row_index: entry.source_row_index,
  base_form: normalizeEnglish(entry.base_form),
  meaning_fa: canonicalPersian(entry.meaning_fa),
  normalized_meaning: normalizePersian(entry.meaning_fa),
  other_meanings_fa: Array.isArray(entry.other_meanings_fa) ? entry.other_meanings_fa : [],
  pos: String(entry.pos ?? "").trim().toLocaleLowerCase("en-US"),
  productive_target: entry.new_productive_target,
}));

for (const entry of prepared) {
  if (!entry.base_form || !entry.meaning_fa || !entry.normalized_meaning || !entry.pos) {
    throw new Error(`Invalid required field at source_row_index ${entry.source_row_index}`);
  }
  if (!Number.isInteger(entry.productive_target) || entry.productive_target < 1 || entry.productive_target > 101) {
    throw new Error(`Invalid new_productive_target at source_row_index ${entry.source_row_index}`);
  }
}

const prisma = new PrismaClient();
try {
  const existingRows = await prisma.wordSense.findMany({
    where: { meaningId: { not: null } },
    select: {
      english: { select: { base_form: true } },
      meaning: { select: { normalized_text: true } },
    },
  });
  const existingPairs = new Set(existingRows.map((row) =>
    `${normalizeEnglish(row.english.base_form)}\u0000${row.meaning?.normalized_text ?? ""}`
  ));
  const seenPairs = new Set();
  const pending = [];
  const skippedDatabase = [];
  const skippedInternal = [];
  for (const entry of prepared) {
    const pair = `${entry.base_form}\u0000${entry.normalized_meaning}`;
    if (existingPairs.has(pair)) {
      skippedDatabase.push(entry.source_row_index);
      continue;
    }
    if (seenPairs.has(pair)) {
      skippedInternal.push(entry.source_row_index);
      continue;
    }
    seenPairs.add(pair);
    pending.push(entry);
  }

  process.stdout.write(`${JSON.stringify({
    dry_run: !execute,
    total: prepared.length,
    pending_insert: pending.length,
    skipped_existing_pair: skippedDatabase.length,
    skipped_internal_pair: skippedInternal.length,
  }, null, 2)}\n`);
  if (!execute) process.exit(0);

  fs.writeFileSync(RESULTS_FILE, "");
  let inserted = 0;
  for (const entry of pending) {
    const wordSense = await prisma.$transaction(async (tx) => {
      const english = await tx.englishWord.upsert({
        where: { base_form: entry.base_form },
        update: {},
        create: { base_form: entry.base_form },
        select: { id: true },
      });
      const primaryMeaning = await tx.persianWord.findFirst({
        where: { normalized_text: entry.normalized_meaning },
        orderBy: { id: "asc" },
        select: { id: true },
      }) ?? await tx.persianWord.create({
        data: {
          canonical_text: entry.meaning_fa,
          normalized_text: entry.normalized_meaning,
          not_normalized_texts: [],
        },
        select: { id: true },
      });
      const otherMeaningIds = [];
      const seenMeaningIds = new Set([primaryMeaning.id]);
      for (const rawMeaning of entry.other_meanings_fa) {
        const normalized = normalizePersian(rawMeaning);
        const canonical = canonicalPersian(rawMeaning);
        if (!normalized || !canonical) continue;
        const meaning = await tx.persianWord.findFirst({
          where: { normalized_text: normalized },
          orderBy: { id: "asc" },
          select: { id: true },
        }) ?? await tx.persianWord.create({
          data: { canonical_text: canonical, normalized_text: normalized, not_normalized_texts: [] },
          select: { id: true },
        });
        if (seenMeaningIds.has(meaning.id)) continue;
        seenMeaningIds.add(meaning.id);
        otherMeaningIds.push(meaning.id);
      }
      return tx.wordSense.create({
        data: {
          anki_link_id: `import_${randomUUID()}`,
          englishId: english.id,
          meaningId: primaryMeaning.id,
          otherMeaningIds,
          pos: entry.pos,
          productive_target: entry.productive_target,
          concept_explained_fa: null,
          sentenceIds: [],
          idiomReviewCompleted: !/[\s\u2010-\u2015-]/u.test(entry.base_form.trim()),
          meaningReviewStatus: "PENDING",
          conceptMergeReviewed: false,
          inflectionMergeReviewed: false,
        },
        select: { id: true },
      });
    });
    inserted += 1;
    fs.appendFileSync(RESULTS_FILE, `${JSON.stringify({
      source_row_index: entry.source_row_index,
      status: "inserted",
      word_sense_id: wordSense.id,
      productive_target: entry.productive_target,
    })}\n`);
    if (inserted % 100 === 0 || inserted === pending.length) {
      process.stdout.write(`${JSON.stringify({ inserted, pending: pending.length })}\n`);
    }
  }
  process.stdout.write(`${JSON.stringify({
    done: true,
    total: prepared.length,
    inserted,
    skipped_existing_pair: skippedDatabase.length,
    skipped_internal_pair: skippedInternal.length,
    results_file: RESULTS_FILE,
  }, null, 2)}\n`);
} finally {
  await prisma.$disconnect();
}
