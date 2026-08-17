import fs from "node:fs";

const INPUT_FILE = "structurally-valid-vocabulary-enriched.json";
const MANIFEST_FILE = "external-vocabulary-review-manifest.json";
const STATE_FILE = "external-vocabulary-review-batch-state.json";
const OUTPUT_FILE = "structurally-valid-vocabulary-enriched-reviewed.json";
const ISSUES_FILE = "external-vocabulary-review-merge-issues.json";

function readLines(file) {
  return fs.readFileSync(file, "utf8").split("\n").filter(Boolean).map((line) => JSON.parse(line));
}

const enriched = JSON.parse(fs.readFileSync(INPUT_FILE, "utf8"));
const manifest = JSON.parse(fs.readFileSync(MANIFEST_FILE, "utf8"));
const state = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
const expected = new Map(manifest.requests.map((request) => [request.custom_id, request.source_row_indices]));
const reviewed = new Map();
const issues = [];
const usage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
for (const batch of state.batches.filter((item) => item.status === "completed")) {
  if (!batch.output_file) {
    issues.push({ type: "missing_output_file", part_number: batch.part_number });
    continue;
  }
  for (const line of readLines(batch.output_file)) {
    const expectedRows = expected.get(line.custom_id);
    if (!expectedRows || line.error || line.response?.status_code !== 200) {
      issues.push({ type: "request_error", custom_id: line.custom_id, error: line.error ?? line.response });
      continue;
    }
    const body = line.response.body;
    for (const key of Object.keys(usage)) usage[key] += body.usage?.[key] ?? 0;
    let result;
    try {
      result = JSON.parse(body.choices?.[0]?.message?.content ?? "");
    } catch (error) {
      issues.push({ type: "invalid_json", custom_id: line.custom_id, error: error.message });
      continue;
    }
    const actualRows = result.items?.map((item) => item.source_row_index) ?? [];
    if (JSON.stringify(actualRows) !== JSON.stringify(expectedRows)) {
      issues.push({ type: "row_mismatch", custom_id: line.custom_id, expected: expectedRows, actual: actualRows });
      continue;
    }
    for (const item of result.items) reviewed.set(item.source_row_index, item);
  }
}
for (const request of manifest.requests) {
  for (const sourceRowIndex of request.source_row_indices) {
    if (!reviewed.has(sourceRowIndex)) issues.push({ type: "missing_review", source_row_index: sourceRowIndex });
  }
}
const entries = enriched.entries.map((item) => {
  const correction = reviewed.get(item.source_row_index);
  return correction ? { ...item, ...correction, reviewed_with_high_reasoning: true } : item;
});
const result = {
  ...enriched,
  generated_at: new Date().toISOString(),
  review_model: manifest.model,
  review_reasoning_effort: manifest.reasoning_effort,
  review_usage: usage,
  reviewed_entries: reviewed.size,
  review_merge_issue_count: issues.length,
  entries,
};
fs.writeFileSync(OUTPUT_FILE, `${JSON.stringify(result)}\n`);
fs.writeFileSync(ISSUES_FILE, `${JSON.stringify({ generated_at: result.generated_at, issues })}\n`);
process.stdout.write(`${JSON.stringify({ output_file: OUTPUT_FILE, issues_file: ISSUES_FILE, reviewed_entries: reviewed.size, issue_count: issues.length, usage }, null, 2)}\n`);
if (issues.length) process.exitCode = 2;
