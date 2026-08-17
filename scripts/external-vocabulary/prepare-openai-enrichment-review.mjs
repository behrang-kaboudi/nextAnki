import fs from "node:fs";

const ENRICHED_FILE = "structurally-valid-vocabulary-enriched.json";
const VALIDATION_FILE = "external-vocabulary-enrichment-validation.json";
const SOURCE_REQUESTS_FILE = "external-vocabulary-enrichment-requests.jsonl";
const REQUESTS_FILE = "external-vocabulary-review-requests.jsonl";
const MANIFEST_FILE = "external-vocabulary-review-manifest.json";
const PART_PREFIX = "external-vocabulary-review-requests-part-";
const MAX_ITEMS = 5;
const MAX_PART_CHARS = Math.max(150_000, Number.parseInt(process.env.EXTERNAL_VOCAB_REVIEW_PART_CHARS ?? "190000", 10) || 190_000);

function readLines(file) {
  return fs.readFileSync(file, "utf8").split("\n").filter(Boolean).map((line) => JSON.parse(line));
}

const enriched = JSON.parse(fs.readFileSync(ENRICHED_FILE, "utf8"));
const validation = JSON.parse(fs.readFileSync(VALIDATION_FILE, "utf8"));
const sourceRequests = readLines(SOURCE_REQUESTS_FILE);
const sourceByRow = new Map();
for (const request of sourceRequests) {
  const payload = JSON.parse(request.body.messages.find((message) => message.role === "user").content);
  for (const group of payload.headword_groups) {
    for (const record of group.records) sourceByRow.set(record.source_row_index, group);
  }
}
const issueByRow = new Map(validation.issues.map((issue) => [issue.source_row_index, issue]));
const selected = enriched.entries.filter((item) => issueByRow.has(item.source_row_index) || item.source_row_index % 100 === 0);
const sampleRows = selected.filter((item) => !issueByRow.has(item.source_row_index)).map((item) => item.source_row_index);
const units = selected.map((item) => ({
  candidate: item,
  validation: issueByRow.get(item.source_row_index)?.issues ?? [{ severity: "audit", code: "one_percent_quality_sample" }],
  original_headword_context: sourceByRow.get(item.source_row_index),
}));
const groups = [];
for (let index = 0; index < units.length; index += MAX_ITEMS) groups.push(units.slice(index, index + MAX_ITEMS));
const template = sourceRequests[0];
const baseSystem = template.body.messages.find((message) => message.role === "system").content;
const reviewSystem = `${baseSystem}\n\nHIGH-REASONING REVIEW PASS\n
- Independently verify every candidate against the intended input sense, the dictionary evidence, and all project rules.
- Correct a field only when the correction is justified. Preserve a good candidate exactly.
- Resolve every supplied validation issue when evidence permits; never hide uncertainty.
- A one_percent_quality_sample item is an audit, not evidence of an error.
- Return exactly the candidate rows in the supplied order with unchanged source_row_index values.
- If a genuine ambiguity remains, retain confidence=review and explain it in review_flags.`;
const requests = groups.map((items, index) => ({
  custom_id: `external-vocab-review-${String(index + 1).padStart(6, "0")}`,
  method: "POST",
  url: "/v1/chat/completions",
  body: {
    ...template.body,
    model: "gpt-5.6-sol",
    reasoning_effort: "high",
    messages: [
      { role: "system", content: reviewSystem },
      { role: "user", content: JSON.stringify({ review_items: items }) },
    ],
  },
}));
fs.writeFileSync(REQUESTS_FILE, `${requests.map((request) => JSON.stringify(request)).join("\n")}\n`);
for (const file of fs.readdirSync(process.cwd())) {
  if (file.startsWith(PART_PREFIX) && file.endsWith(".jsonl")) fs.unlinkSync(file);
}
const parts = [];
let lines = [];
let chars = 0;
const flush = () => {
  if (!lines.length) return;
  const partNumber = parts.length + 1;
  const file = `${PART_PREFIX}${String(partNumber).padStart(3, "0")}.jsonl`;
  fs.writeFileSync(file, `${lines.join("\n")}\n`);
  parts.push({ part_number: partNumber, file, request_count: lines.length, input_chars: chars, estimated_input_tokens: Math.ceil(chars / 3.5) });
  lines = [];
  chars = 0;
};
for (const request of requests) {
  const line = JSON.stringify(request);
  if (lines.length && chars + line.length + 1 > MAX_PART_CHARS) flush();
  lines.push(line);
  chars += line.length + 1;
}
flush();
const manifest = {
  schema_version: 1,
  generated_at: new Date().toISOString(),
  model: "gpt-5.6-sol",
  reasoning_effort: "high",
  request_count: requests.length,
  included_entries: selected.length,
  issue_entries: selected.length - sampleRows.length,
  audit_sample_entries: sampleRows.length,
  audit_sample_source_row_indices: sampleRows,
  request_parts: parts,
  requests: groups.map((items, index) => ({ custom_id: `external-vocab-review-${String(index + 1).padStart(6, "0")}`, source_row_indices: items.map((item) => item.candidate.source_row_index) })),
};
fs.writeFileSync(MANIFEST_FILE, `${JSON.stringify(manifest)}\n`);
process.stdout.write(`${JSON.stringify({ requests_file: REQUESTS_FILE, manifest_file: MANIFEST_FILE, request_count: requests.length, included_entries: selected.length, issue_entries: manifest.issue_entries, audit_sample_entries: sampleRows.length, part_count: parts.length }, null, 2)}\n`);
