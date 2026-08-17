import fs from "node:fs";

const INPUT_FILE = process.env.EXTERNAL_VOCAB_ENRICHED_FILE ?? "structurally-valid-vocabulary-enriched.json";
const REPORT_FILE = process.env.EXTERNAL_VOCAB_VALIDATION_FILE ?? "external-vocabulary-enrichment-validation.json";

function normalizePersianLoose(value) {
  return value.normalize("NFC").replace(/[يى]/gu, "ی").replace(/ك/gu, "ک").replace(/[\s\u200c\p{P}\p{N}]/gu, "");
}

function englishWordCount(value) {
  return value.match(/[A-Za-z]+(?:['’-][A-Za-z]+)*/gu)?.length ?? 0;
}

function persianWordCount(value) {
  return value.trim().split(/\s+/u).filter(Boolean).length;
}

const data = JSON.parse(fs.readFileSync(INPUT_FILE, "utf8"));
const issues = [];
const seenRows = new Set();
for (const item of data.entries ?? []) {
  const rowIssues = [];
  if (seenRows.has(item.source_row_index)) rowIssues.push({ severity: "error", code: "duplicate_row" });
  seenRows.add(item.source_row_index);
  for (const field of ["base_form", "meaning_fa", "pos", "concept_explained_fa", "sentence_en", "sentence_en_meaning_fa"]) {
    if (typeof item[field] !== "string" || !item[field].trim()) rowIssues.push({ severity: "error", code: `blank_${field}` });
  }
  if (!Array.isArray(item.other_meanings_fa) || item.other_meanings_fa.length > 3) {
    rowIssues.push({ severity: "error", code: "invalid_other_meanings_fa" });
  } else {
    const primary = normalizePersianLoose(item.meaning_fa ?? "");
    const alternatives = item.other_meanings_fa.map(normalizePersianLoose);
    if (alternatives.includes(primary)) rowIssues.push({ severity: "error", code: "primary_repeated_as_alternative" });
    if (new Set(alternatives).size !== alternatives.length) rowIssues.push({ severity: "error", code: "duplicate_alternative" });
  }
  if (persianWordCount(item.concept_explained_fa ?? "") > 50) rowIssues.push({ severity: "error", code: "concept_too_long" });
  const sentenceWords = englishWordCount(item.sentence_en ?? "");
  if (sentenceWords < 6 || sentenceWords > 14) rowIssues.push({ severity: "review", code: "sentence_length" });
  if (!/[.!?]$/u.test((item.sentence_en ?? "").trim())) rowIssues.push({ severity: "review", code: "sentence_punctuation" });
  if (!/[\u0600-\u06ff]/u.test(item.sentence_en_meaning_fa ?? "")) rowIssues.push({ severity: "error", code: "translation_not_persian" });
  if (item.confidence === "review") rowIssues.push({ severity: "review", code: "model_requested_review" });
  if (item.confidence === "medium") rowIssues.push({ severity: "review", code: "model_medium_confidence" });
  if (item.review_flags?.length) rowIssues.push({ severity: "review", code: "model_review_flags", flags: item.review_flags });
  if (rowIssues.length) issues.push({ source_row_index: item.source_row_index, base_form: item.base_form, meaning_fa: item.meaning_fa, issues: rowIssues });
}
for (let sourceRowIndex = 0; sourceRowIndex < data.expected_entries; sourceRowIndex += 1) {
  if (!seenRows.has(sourceRowIndex)) issues.push({ source_row_index: sourceRowIndex, issues: [{ severity: "error", code: "missing_row" }] });
}
const errorRows = issues.filter((item) => item.issues.some((issue) => issue.severity === "error")).length;
const reviewRows = issues.filter((item) => item.issues.some((issue) => issue.severity === "review")).length;
const report = {
  schema_version: 1,
  generated_at: new Date().toISOString(),
  input_file: INPUT_FILE,
  total_entries: data.entries?.length ?? 0,
  error_rows: errorRows,
  review_rows: reviewRows,
  passed_rows: (data.entries?.length ?? 0) - new Set(issues.map((item) => item.source_row_index)).size,
  issues,
};
fs.writeFileSync(REPORT_FILE, `${JSON.stringify(report)}\n`);
process.stdout.write(`${JSON.stringify({ report_file: REPORT_FILE, total_entries: report.total_entries, error_rows: errorRows, review_rows: reviewRows, passed_rows: report.passed_rows }, null, 2)}\n`);
if (errorRows) process.exitCode = 2;
