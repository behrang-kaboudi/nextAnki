import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";

const INPUT_FILE = process.env.PRODUCTIVE_TARGET_INPUT ?? "prompt-responses/external-vocabulary/2026-08-11-legacy-pipeline/structurally-valid-vocabulary-codex-enriched-32273.json";
const CATALOG_FILE = "prompt-responses/external-vocabulary/2026-08-11-legacy-pipeline/structurally-valid-vocabulary-database-comparison.json";
const PYTHON = process.env.PRODUCTIVE_TARGET_PYTHON ?? "/tmp/anki-productive-target-venv/bin/python";
const BATCH_SIZE = 150;

for (const name of [".env.local", ".env"]) {
  const file = path.join(process.cwd(), name);
  if (fs.existsSync(file)) dotenv.config({ path: file, quiet: true });
}

function normalizeEnglish(value) {
  return String(value ?? "").normalize("NFKD").replace(/[\u0300-\u036F]/gu, "")
    .replace(/[’‘`]/gu, "'").replace(/[-_\u2010-\u2015]+/gu, " ")
    .toLocaleLowerCase("en-US").replace(/[^a-z'\s]/gu, " ").replace(/\s+/gu, " ").trim();
}

function normalizePersian(value) {
  const replacements = { "ك": "ک", "ي": "ی", "ى": "ی", "ۍ": "ی", "ې": "ی", "ے": "ی", "ئ": "ی", "أ": "ا", "إ": "ا", "ٱ": "ا", "ؤ": "و", "ة": "ه", "ۀ": "ه" };
  return String(value ?? "").normalize("NFC")
    .replace(/[كيىۍېےئأإٱؤةۀ]/gu, (character) => replacements[character] ?? character)
    .replace(/[ـ\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/gu, "")
    .replace(/[^اآبپتثجچحخدذرزژسشصضطظعغفقکگلمنوهی]/gu, "");
}

function clamp(value) {
  return Math.max(1, Math.min(101, Math.round(value)));
}

function baseScore(zipf) {
  const points = [[0, 4], [1, 7], [2, 14], [2.5, 20], [3, 29], [3.5, 39], [4, 50], [4.5, 61], [5, 72], [5.5, 82], [6, 90], [6.5, 96], [7, 99], [8, 101]];
  for (let index = 1; index < points.length; index += 1) {
    if (zipf <= points[index][0]) {
      const [x0, y0] = points[index - 1];
      const [x1, y1] = points[index];
      return y0 + ((zipf - x0) / (x1 - x0)) * (y1 - y0);
    }
  }
  return 101;
}

function categoryAdjustment(slugs) {
  const joined = slugs.join(" ");
  if (/a1-level|basic-english|500-most-frequent|most-frequent-words/.test(joined)) return 10;
  if (/a2-level|starter|fundamentals|vocabulary-in-use-basic|word-skills-basic/.test(joined)) return 7;
  if (/b1-level|pre-intermediate|interchange-book-1|four-corners-1|touchstone-1/.test(joined)) return 4;
  if (/b2-level|intermediate/.test(joined)) return 1;
  if (/c1-level|advanced|gre|sat|academic/.test(joined)) return -4;
  return 0;
}

function senseAdjustment(entry, slugs) {
  const text = `${entry.base_form ?? entry.source_term ?? ""} ${entry.meaning_fa ?? entry.source_meaning_fa ?? ""} ${entry.concept_explained_fa ?? ""}`.toLocaleLowerCase("en-US");
  let adjustment = Math.min(6, Math.max(0, (entry.source_refs?.length ?? 1) - 1));
  if (entry.source_refs?.some((reference) => reference.startsWith("tt-"))) adjustment += 3;
  if (slugs.some((slug) => /health|body|work|family|food|travel|retail|houses/.test(slug))) adjustment += 2;
  if (slugs.some((slug) => /science|animals|nature|religion-and-politics|war-and-conflict/.test(slug))) adjustment -= 3;
  if (/\b(?:species|chemical|enzyme|mineral|botanical|geological|technical term|scientific term)\b/.test(text)) adjustment -= 9;
  if (/\b(?:capital of|city in|town in|surname|given name|proper name|organization|abbreviation|acronym)\b/.test(text)) adjustment -= 12;
  if (/^[a-z]{1,4}$/.test(normalizeEnglish(entry.base_form ?? entry.source_term)) && /\b(?:organization|abbreviation|acronym)\b/.test(text)) adjustment -= 6;
  if ((entry.lexical_type === "phrase" || normalizeEnglish(entry.base_form ?? entry.source_term).includes(" ")) && /\b(?:idiom|informal|used to|phrase)\b/.test(text)) adjustment += 2;
  return adjustment;
}

const document = JSON.parse(fs.readFileSync(INPUT_FILE, "utf8"));
const catalog = JSON.parse(fs.readFileSync(CATALOG_FILE, "utf8"));
if (!Array.isArray(document.entries) || document.entries.length !== 32_273) throw new Error("Expected exactly 32,273 entries.");

const categorySlugById = new Map(catalog.categories.map(([id, , slug]) => [id, slug]));
const slugsByLocationId = new Map(catalog.locations.map(([id, , categoryIds]) => [id, categoryIds.map((categoryId) => categorySlugById.get(categoryId)).filter(Boolean)]));
const terms = document.entries.map((entry) => normalizeEnglish(entry.base_form ?? entry.source_term));
const frequencyRun = spawnSync(PYTHON, ["-c", "import json,sys; from wordfreq import zipf_frequency; print(json.dumps([zipf_frequency(x, 'en', wordlist='best') for x in json.load(sys.stdin)]))"], {
  input: JSON.stringify(terms), encoding: "utf8", maxBuffer: 16 * 1024 * 1024,
});
if (frequencyRun.status !== 0) throw new Error(frequencyRun.stderr || "wordfreq failed");
const frequencies = JSON.parse(frequencyRun.stdout);

const prisma = new PrismaClient();
try {
  const existing = await prisma.wordSense.findMany({
    where: { productive_target: { not: null } },
    select: { pos: true, productive_target: true, english: { select: { base_form: true } }, meaning: { select: { normalized_text: true } } },
  });
  const confirmedScores = new Map();
  for (const row of existing) {
    if (!row.meaning || row.productive_target == null) continue;
    confirmedScores.set(`${normalizeEnglish(row.english.base_form)}\u0000${normalizePersian(row.meaning.normalized_text)}\u0000${String(row.pos ?? "").trim().toLowerCase()}`, row.productive_target);
  }

  let reused = 0;
  for (let start = 0; start < document.entries.length; start += BATCH_SIZE) {
    const end = Math.min(start + BATCH_SIZE, document.entries.length);
    for (let index = start; index < end; index += 1) {
      const entry = document.entries[index];
      const english = terms[index];
      const persian = normalizePersian(entry.meaning_fa ?? entry.source_meaning_fa);
      const pos = String(entry.pos ?? "").trim().toLowerCase();
      const confirmed = confirmedScores.get(`${english}\u0000${persian}\u0000${pos}`);
      if (Number.isInteger(confirmed) && confirmed >= 1 && confirmed <= 101) {
        entry.productive_target = confirmed;
        reused += 1;
      } else {
        const slugs = [...new Set((entry.source_refs ?? []).flatMap((reference) => slugsByLocationId.get(reference) ?? []))];
        entry.productive_target = clamp(baseScore(frequencies[index]) + categoryAdjustment(slugs) + senseAdjustment(entry, slugs));
      }
    }
    const temporary = `${INPUT_FILE}.productive-target.tmp`;
    fs.writeFileSync(temporary, `${JSON.stringify(document)}\n`);
    fs.renameSync(temporary, INPUT_FILE);
    process.stdout.write(`${JSON.stringify({ batch: Math.floor(start / BATCH_SIZE) + 1, total_batches: Math.ceil(document.entries.length / BATCH_SIZE), completed: end })}\n`);
  }
  document.productive_target_enrichment = {
    prompt: "src/prompts/word-extraction/productive_target/rulseV1.md",
    batch_size: BATCH_SIZE,
    completed_entries: document.entries.length,
    reused_exact_database_scores: reused,
    database_written: false,
  };
  fs.writeFileSync(INPUT_FILE, `${JSON.stringify(document)}\n`);
} finally {
  await prisma.$disconnect();
}
