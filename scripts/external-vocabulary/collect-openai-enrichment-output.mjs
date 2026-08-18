import fs from "node:fs";

const CATALOG_FILE = "prompt-responses/external-vocabulary/2026-08-11-legacy-pipeline/structurally-valid-vocabulary-database-comparison.json";
const MANIFEST_FILE = "prompt-responses/external-vocabulary/2026-08-11-legacy-pipeline/external-vocabulary-enrichment-manifest.json";
const STATE_FILE = "prompt-responses/external-vocabulary/2026-08-11-legacy-pipeline/external-vocabulary-enrichment-batch-state.json";
const OUTPUT_FILE = "prompt-responses/external-vocabulary/2026-08-11-legacy-pipeline/structurally-valid-vocabulary-enriched.json";
const ISSUES_FILE = "prompt-responses/external-vocabulary/2026-08-11-legacy-pipeline/external-vocabulary-enrichment-issues.json";

function readJsonLines(file) {
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, "utf8").split("\n").filter(Boolean).map((line) => JSON.parse(line));
}

const catalog = JSON.parse(fs.readFileSync(CATALOG_FILE, "utf8"));
const manifest = JSON.parse(fs.readFileSync(MANIFEST_FILE, "utf8"));
const state = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
const expectedByRequest = new Map(manifest.requests.map((request) => [request.custom_id, request.source_row_indices]));
const entries = Array(catalog.entries.length).fill(null);
const issues = [];
let usage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

for (const batch of state.batches.filter((item) => item.status === "completed")) {
  if (!batch.output_file) {
    issues.push({ type: "missing_output_file", part_number: batch.part_number, status: batch.status });
    continue;
  }
  for (const line of readJsonLines(batch.output_file)) {
    const expected = expectedByRequest.get(line.custom_id);
    if (!expected) {
      issues.push({ type: "unexpected_custom_id", custom_id: line.custom_id });
      continue;
    }
    if (line.error || line.response?.status_code !== 200) {
      issues.push({ type: "request_error", custom_id: line.custom_id, error: line.error ?? line.response });
      continue;
    }
    const body = line.response.body;
    for (const key of Object.keys(usage)) usage[key] += body.usage?.[key] ?? 0;
    let parsed;
    try {
      parsed = JSON.parse(body.choices?.[0]?.message?.content ?? "");
    } catch (error) {
      issues.push({ type: "invalid_json", custom_id: line.custom_id, message: error.message });
      continue;
    }
    const actualIndices = parsed.items?.map((item) => item.source_row_index) ?? [];
    if (JSON.stringify(actualIndices) !== JSON.stringify(expected)) {
      issues.push({ type: "row_index_mismatch", custom_id: line.custom_id, expected, actual: actualIndices });
      continue;
    }
    for (const item of parsed.items) {
      if (entries[item.source_row_index]) {
        issues.push({ type: "duplicate_row", custom_id: line.custom_id, source_row_index: item.source_row_index });
        continue;
      }
      const source = catalog.entries[item.source_row_index];
      entries[item.source_row_index] = {
        source_row_index: item.source_row_index,
        source_term: source[0],
        source_meaning_fa: source[1],
        source_refs: source[2],
        database_before_enrichment: {
          pair_exists: source[3],
          literal_pair_exists: source[4],
          match_status: source[5],
          english_word_id: source[6],
          word_sense_ids: source[7],
        },
        ...item,
      };
    }
  }
}

entries.forEach((entry, sourceRowIndex) => {
  if (!entry) issues.push({ type: "missing_row", source_row_index: sourceRowIndex });
});
const completeEntries = entries.filter(Boolean);
const result = {
  schema_version: 1,
  generated_at: new Date().toISOString(),
  source_catalog: CATALOG_FILE,
  model: manifest.model,
  reasoning_effort: manifest.reasoning_effort,
  usage,
  expected_entries: catalog.entries.length,
  completed_entries: completeEntries.length,
  issue_count: issues.length,
  entries: completeEntries,
};
fs.writeFileSync(OUTPUT_FILE, `${JSON.stringify(result)}\n`);
fs.writeFileSync(ISSUES_FILE, `${JSON.stringify({ generated_at: result.generated_at, issues })}\n`);
process.stdout.write(`${JSON.stringify({ output_file: OUTPUT_FILE, issues_file: ISSUES_FILE, expected_entries: result.expected_entries, completed_entries: result.completed_entries, issue_count: issues.length, usage }, null, 2)}\n`);
if (issues.length) process.exitCode = 2;
