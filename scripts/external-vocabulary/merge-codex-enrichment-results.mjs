import fs from "node:fs";

const INPUT_FILE = "structurally-valid-vocabulary-source-backed-with-database.json";
const RESULTS_FILE = "external-vocabulary-codex-results.jsonl";
const OUTPUT_FILE = "structurally-valid-vocabulary-codex-enriched.json";
const ISSUES_FILE = "external-vocabulary-codex-merge-issues.json";

function readLines(file) {
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, "utf8").split("\n").filter(Boolean).map((line) => JSON.parse(line));
}

const data = JSON.parse(fs.readFileSync(INPUT_FILE, "utf8"));
const issues = [];
const results = new Map();
for (const item of readLines(RESULTS_FILE)) {
  if (!Number.isInteger(item.source_row_index) || item.source_row_index < 0 || item.source_row_index >= data.entries.length) {
    issues.push({ type: "invalid_source_row_index", source_row_index: item.source_row_index });
    continue;
  }
  if (results.has(item.source_row_index)) {
    issues.push({ type: "duplicate_result", source_row_index: item.source_row_index });
    continue;
  }
  results.set(item.source_row_index, item);
}
let applied = 0;
const entries = data.entries.map((entry) => {
  const result = results.get(entry.source_row_index);
  if (!result) {
    return entry.meaning_fa ? entry : { ...entry, meaning_fa: entry.source_meaning_fa.trim() };
  }
  const missing = entry.missing_fields.filter((field) => {
    if (field === "other_meanings_fa") return !Array.isArray(result[field]);
    return typeof result[field] !== "string" || !result[field].trim();
  });
  if (missing.length) {
    issues.push({ type: "missing_requested_fields", source_row_index: entry.source_row_index, fields: missing });
    return entry;
  }
  const meaningFa = result.meaning_fa ?? entry.meaning_fa ?? entry.source_meaning_fa;
  applied += 1;
  return {
    ...entry,
    ...Object.fromEntries(entry.missing_fields.map((field) => [field, Array.isArray(result[field]) ? result[field] : result[field].trim()])),
    meaning_fa: meaningFa.trim(),
    ...(result.pos ? { pos: result.pos.trim() } : {}),
    ...(Array.isArray(result.other_meanings_fa) ? { other_meanings_fa: result.other_meanings_fa } : {}),
    ...(Number.isInteger(result.dictionary_sense_number) ? { dictionary_sense_number: result.dictionary_sense_number } : {}),
    confidence: result.confidence ?? "codex_reviewed",
    review_flags: result.review_flags ?? [],
    status: "completed_by_codex",
    missing_fields: [],
  };
});
const counts = entries.reduce((summary, entry) => {
  summary[entry.status] = (summary[entry.status] ?? 0) + 1;
  return summary;
}, {});
const output = { ...data, generated_at: new Date().toISOString(), entries, stats: { total_entries: entries.length, applied_codex_results: applied, merge_issues: issues.length, ...counts } };
fs.writeFileSync(OUTPUT_FILE, `${JSON.stringify(output)}\n`);
fs.writeFileSync(ISSUES_FILE, `${JSON.stringify({ generated_at: output.generated_at, issues })}\n`);
process.stdout.write(`${JSON.stringify({ output_file: OUTPUT_FILE, issues_file: ISSUES_FILE, ...output.stats }, null, 2)}\n`);
if (issues.length) process.exitCode = 2;
