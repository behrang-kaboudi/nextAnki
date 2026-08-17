import fs from "node:fs";

const PLAN_FILE = process.env.EXTERNAL_VOCAB_IMPORT_PLAN_FILE ?? "external-vocabulary-database-import-plan.json";
const RESULTS_FILE = process.env.EXTERNAL_VOCAB_IMPORT_RESULTS_FILE ?? "external-vocabulary-database-import-results.jsonl";
const AMBIGUITIES_FILE = process.env.EXTERNAL_VOCAB_IMPORT_AMBIGUITIES_FILE ?? "external-vocabulary-database-import-ambiguities.json";
const endpoint = process.env.EXTERNAL_VOCAB_IMPORT_URL ?? "http://localhost:3000/api/word-extraction/base/insert-tempwords";
const execute = process.argv.includes("--execute");
const batchSize = Math.max(1, Math.min(100, Number.parseInt(process.env.EXTERNAL_VOCAB_IMPORT_BATCH_SIZE ?? "25", 10) || 25));

function readResults() {
  if (!fs.existsSync(RESULTS_FILE)) return [];
  return fs.readFileSync(RESULTS_FILE, "utf8").split("\n").filter(Boolean).map((line) => JSON.parse(line));
}

function appendResult(value) {
  fs.appendFileSync(RESULTS_FILE, `${JSON.stringify(value)}\n`);
}

const plan = JSON.parse(fs.readFileSync(PLAN_FILE, "utf8"));
const previous = readResults();
const completed = new Set(previous.filter((item) => item.status === "inserted" || item.status === "skipped_exists").map((item) => item.source_row_index));
const pending = plan.entries.filter((item) => !completed.has(item.source_row_index));
if (!execute) {
  process.stdout.write(`${JSON.stringify({ dry_run: true, endpoint, plan_entries: plan.entries.length, already_completed: completed.size, pending: pending.length, batch_size: batchSize }, null, 2)}\n`);
  process.exit(0);
}

const ambiguities = [];
let inserted = 0;
let skipped = 0;
let failed = 0;

function normalizePersian(value) {
  const replacements = { "ك": "ک", "ي": "ی", "ى": "ی", "ۍ": "ی", "ې": "ی", "ے": "ی", "ئ": "ی", "أ": "ا", "إ": "ا", "ٱ": "ا", "ؤ": "و", "ة": "ه", "ۀ": "ه" };
  return String(value ?? "").normalize("NFC")
    .replace(/[كيىۍېےئأإٱؤةۀ]/gu, (character) => replacements[character] ?? character)
    .replace(/[ـ\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/gu, "")
    .replace(/[^اآبپتثجچحخدذرزژسشصضطظعغفقکگلمنوهی]/gu, "");
}

function payloadItem(item) {
  const primaryMeaning = normalizePersian(item.meaning_fa);
  const seenMeanings = new Set([primaryMeaning]);
  const otherMeanings = (item.other_meanings_fa ?? []).filter((meaning) => {
    const normalized = normalizePersian(meaning);
    if (!normalized || seenMeanings.has(normalized)) return false;
    seenMeanings.add(normalized);
    return true;
  });
  return {
    base_form: item.base_form,
    meaning_fa: item.meaning_fa,
    other_meanings_fa: otherMeanings,
    pos: item.pos,
    concept_explained_fa: item.concept_explained_fa,
    sentence_en: item.sentence_en,
    sentence_en_meaning_fa: item.sentence_en_meaning_fa,
    productive_target: item.productive_target,
  };
}

async function send(items) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ items: items.map(payloadItem) }),
    signal: AbortSignal.timeout(120_000),
  });
  const body = await response.json().catch(() => null);
  if (response.ok && body?.ok) {
    body.results.forEach((result, index) => {
      const source = items[index];
      const status = result.ok ? result.action : "error";
      appendResult({ source_row_index: source.source_row_index, status, word_sense_id: result.id ?? null, error: result.error ?? null });
      if (status === "inserted") inserted += 1;
      else if (status === "skipped_exists") skipped += 1;
      else failed += 1;
    });
    return;
  }
  if (items.length > 1) {
    const middle = Math.ceil(items.length / 2);
    await send(items.slice(0, middle));
    await send(items.slice(middle));
    return;
  }
  const source = items[0];
  if (response.status === 409 && body?.code === "PERSIAN_WORD_RESOLUTION_REQUIRED") {
    ambiguities.push({ source_row_index: source.source_row_index, base_form: source.base_form, meaning_fa: source.meaning_fa, ambiguities: body.ambiguities });
    return;
  }
  failed += 1;
  appendResult({ source_row_index: source.source_row_index, status: "error", error: body?.error ?? `HTTP ${response.status}` });
}

for (let index = 0; index < pending.length; index += batchSize) {
  await send(pending.slice(index, index + batchSize));
  process.stdout.write(`${JSON.stringify({ processed_this_run: Math.min(index + batchSize, pending.length), pending_this_run: pending.length, inserted, skipped, failed, ambiguities: ambiguities.length })}\n`);
}
fs.writeFileSync(AMBIGUITIES_FILE, `${JSON.stringify({ generated_at: new Date().toISOString(), ambiguities })}\n`);
process.stdout.write(`${JSON.stringify({ done: true, inserted, skipped, failed, ambiguity_count: ambiguities.length, results_file: RESULTS_FILE, ambiguities_file: AMBIGUITIES_FILE }, null, 2)}\n`);
if (failed || ambiguities.length) process.exitCode = 2;
