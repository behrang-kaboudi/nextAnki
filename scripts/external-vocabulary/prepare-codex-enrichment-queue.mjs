import fs from "node:fs";

const INPUT_FILE = "prompt-responses/external-vocabulary/2026-08-11-legacy-pipeline/structurally-valid-vocabulary-source-backed-with-database.json";
const CACHE_FILE = "prompt-responses/external-vocabulary/2026-08-11-legacy-pipeline/external-vocabulary-bamooz-cache.jsonl";
const RESULTS_FILE = "prompt-responses/external-vocabulary/2026-08-11-legacy-pipeline/external-vocabulary-codex-results.jsonl";
const OUTPUT_FILE = "prompt-responses/external-vocabulary/2026-08-11-legacy-pipeline/external-vocabulary-codex-queue.jsonl";

function normalizeTerm(value) {
  return value.normalize("NFKC").replace(/[’‘`]/gu, "'").replace(/\s+/gu, " ").trim().toLocaleLowerCase("en-US");
}

function readLines(file) {
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, "utf8").split("\n").filter(Boolean).map((line) => JSON.parse(line));
}

const data = JSON.parse(fs.readFileSync(INPUT_FILE, "utf8"));
const cache = new Map(readLines(CACHE_FILE).map((record) => [record.normalized_term, record]));
const completedRows = new Set(readLines(RESULTS_FILE).map((record) => record.source_row_index));
const queue = data.entries.filter((entry) => entry.missing_fields.length && !completedRows.has(entry.source_row_index)).map((entry) => {
  const dictionary = cache.get(normalizeTerm(entry.source_term));
  const matchingSense = dictionary?.senses?.find((sense) => sense.sense_number === entry.dictionary_sense_number) ?? null;
  return {
    source_row_index: entry.source_row_index,
    base_form: entry.base_form,
    meaning_fa: entry.meaning_fa ?? entry.source_meaning_fa,
    other_meanings_fa: entry.other_meanings_fa ?? [],
    pos: entry.pos ?? null,
    lexical_type: entry.lexical_type,
    sentence_en: entry.sentence_en ?? null,
    sentence_en_meaning_fa: entry.sentence_en_meaning_fa ?? null,
    missing_fields: entry.missing_fields,
    dictionary_sense_number: entry.dictionary_sense_number ?? null,
    dictionary_senses: entry.status === "review_dictionary_sense" ? (dictionary?.senses ?? []) : (matchingSense ? [matchingSense] : []),
  };
});
fs.writeFileSync(OUTPUT_FILE, `${queue.map((item) => JSON.stringify(item)).join("\n")}${queue.length ? "\n" : ""}`);
process.stdout.write(`${JSON.stringify({ output_file: OUTPUT_FILE, pending: queue.length, already_completed_by_codex: completedRows.size }, null, 2)}\n`);
