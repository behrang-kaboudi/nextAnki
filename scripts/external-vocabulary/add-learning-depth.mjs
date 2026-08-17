import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";

const INPUT_FILE = process.env.LEARNING_DEPTH_INPUT ?? "structurally-valid-vocabulary-codex-enriched-32273.json";
const CATALOG_FILE = "structurally-valid-vocabulary-database-comparison.json";
const PYTHON = process.env.LEARNING_DEPTH_PYTHON ?? "/tmp/anki-productive-target-venv/bin/python";
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
  return Math.max(0, Math.min(1, Math.round(value * 100) / 100));
}

function frequencyDepth(zipf) {
  const points = [[0, 0.06], [1, 0.09], [2, 0.16], [2.5, 0.23], [3, 0.32], [3.5, 0.43], [4, 0.55], [4.5, 0.66], [5, 0.76], [5.5, 0.84], [6, 0.9], [6.5, 0.95], [7, 0.98], [8, 1]];
  for (let index = 1; index < points.length; index += 1) {
    if (zipf <= points[index][0]) {
      const [x0, y0] = points[index - 1];
      const [x1, y1] = points[index];
      return y0 + ((zipf - x0) / (x1 - x0)) * (y1 - y0);
    }
  }
  return 1;
}

function categoryAdjustment(slugs) {
  const joined = slugs.join(" ");
  if (/a1-level|basic-english|500-most-frequent|most-frequent-words/.test(joined)) return 0.1;
  if (/a2-level|starter|fundamentals|vocabulary-in-use-basic|word-skills-basic/.test(joined)) return 0.07;
  if (/b1-level|pre-intermediate/.test(joined)) return 0.04;
  if (/b2-level|intermediate/.test(joined)) return 0.01;
  if (/c1-level|advanced|gre|sat|academic/.test(joined)) return -0.04;
  return 0;
}

function meaningAdjustment(entry, slugs) {
  const text = `${entry.base_form ?? entry.source_term ?? ""} ${entry.meaning_fa ?? entry.source_meaning_fa ?? ""} ${entry.concept_explained_fa ?? ""}`.toLocaleLowerCase("en-US");
  let adjustment = Math.min(0.06, Math.max(0, ((entry.source_refs?.length ?? 1) - 1) * 0.01));
  if (slugs.some((slug) => /health|body|crime-and-law|work|travel/.test(slug))) adjustment += 0.04;
  if (/\b(?:warning|danger|emergency|disease|disorder|symptom|medicine|legal|illegal|allergy|poison|toxic)\b/.test(text)) adjustment += 0.08;
  if (/\b(?:species|chemical|enzyme|mineral|botanical|geological|technical term|scientific term)\b/.test(text)) adjustment -= 0.1;
  if (/\b(?:capital of|city in|town in|surname|given name|proper name)\b/.test(text)) adjustment -= 0.14;
  if (/\b(?:obsolete|archaic|dated|rare|literary)\b/.test(text)) adjustment -= 0.12;
  if (/\b(?:organization|abbreviation|acronym)\b/.test(text)) adjustment -= 0.06;
  return adjustment;
}

const document = JSON.parse(fs.readFileSync(INPUT_FILE, "utf8"));
const catalog = JSON.parse(fs.readFileSync(CATALOG_FILE, "utf8"));
if (!Array.isArray(document.entries) || document.entries.length !== 32_273) throw new Error("Expected exactly 32,273 entries.");
if (document.entries.some((entry) => !Number.isInteger(entry.productive_target))) throw new Error("productive_target must be present first.");

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
    where: { learning_depth: { not: null } },
    select: { pos: true, learning_depth: true, english: { select: { base_form: true } }, meaning: { select: { normalized_text: true } } },
  });
  const confirmedScores = new Map();
  for (const row of existing) {
    if (!row.meaning || row.learning_depth == null) continue;
    confirmedScores.set(`${normalizeEnglish(row.english.base_form)}\u0000${normalizePersian(row.meaning.normalized_text)}\u0000${String(row.pos ?? "").trim().toLowerCase()}`, row.learning_depth);
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
      if ((confirmed === -100) || (typeof confirmed === "number" && confirmed >= 0 && confirmed <= 1)) {
        entry.learning_depth = confirmed;
        reused += 1;
      } else {
        const slugs = [...new Set((entry.source_refs ?? []).flatMap((reference) => slugsByLocationId.get(reference) ?? []))];
        const productiveComponent = entry.productive_target / 101;
        const score = (frequencyDepth(frequencies[index]) * 0.62) + (productiveComponent * 0.38)
          + categoryAdjustment(slugs) + meaningAdjustment(entry, slugs);
        entry.learning_depth = clamp(score);
      }
    }
    const temporary = `${INPUT_FILE}.learning-depth.tmp`;
    fs.writeFileSync(temporary, `${JSON.stringify(document)}\n`);
    fs.renameSync(temporary, INPUT_FILE);
    process.stdout.write(`${JSON.stringify({ batch: Math.floor(start / BATCH_SIZE) + 1, total_batches: Math.ceil(document.entries.length / BATCH_SIZE), completed: end })}\n`);
  }
  document.learning_depth_enrichment = {
    prompt: "src/prompts/word-extraction/learning_depth/rulseV1.md",
    batch_size: BATCH_SIZE,
    completed_entries: document.entries.length,
    reused_exact_database_scores: reused,
    database_written: false,
  };
  fs.writeFileSync(INPUT_FILE, `${JSON.stringify(document)}\n`);
} finally {
  await prisma.$disconnect();
}
