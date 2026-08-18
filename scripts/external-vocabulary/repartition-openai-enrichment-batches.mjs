import fs from "node:fs";
import path from "node:path";

const REQUESTS_FILE = "prompt-responses/external-vocabulary/2026-08-11-legacy-pipeline/external-vocabulary-enrichment-requests.jsonl";
const MANIFEST_FILE = "prompt-responses/external-vocabulary/2026-08-11-legacy-pipeline/external-vocabulary-enrichment-manifest.json";
const STATE_FILE = "prompt-responses/external-vocabulary/2026-08-11-legacy-pipeline/external-vocabulary-enrichment-batch-state.json";
const PREFIX = "prompt-responses/external-vocabulary/2026-08-11-legacy-pipeline/external-vocabulary-enrichment-requests-part-";
const maxChars = Math.max(150_000, Number.parseInt(process.env.EXTERNAL_VOCAB_REPARTITION_CHARS ?? "950000", 10) || 950_000);

const manifest = JSON.parse(fs.readFileSync(MANIFEST_FILE, "utf8"));
const state = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
const completed = state.batches.filter((batch) => batch.status === "completed");
if (!completed.length) throw new Error("At least one completed batch is required before repartitioning.");
const completedIds = new Set(completed.flatMap((batch) => {
  if (!batch.output_file || !fs.existsSync(batch.output_file)) return [];
  return fs.readFileSync(batch.output_file, "utf8").split("\n").filter(Boolean).map((line) => JSON.parse(line).custom_id);
}));
const remainingLines = fs.readFileSync(REQUESTS_FILE, "utf8").split("\n").filter(Boolean)
  .filter((line) => !completedIds.has(JSON.parse(line).custom_id));
const partDirectory = path.dirname(PREFIX);
const partBasenamePrefix = path.basename(PREFIX);
for (const file of fs.readdirSync(partDirectory)) {
  if (!file.startsWith(partBasenamePrefix) || !file.endsWith(".jsonl")) continue;
  const filePath = path.join(partDirectory, file);
  if (!completed.some((batch) => batch.request_file === filePath)) fs.unlinkSync(filePath);
}

const completedParts = completed.map((batch) => {
  const content = fs.readFileSync(batch.request_file, "utf8");
  const requestCount = content.split("\n").filter(Boolean).length;
  return {
    part_number: batch.part_number,
    file: batch.request_file,
    request_count: requestCount,
    input_chars: content.length,
    estimated_input_tokens: Math.ceil(content.length / 3.5),
  };
}).sort((left, right) => left.part_number - right.part_number);
const parts = [...completedParts];
let lines = [];
let chars = 0;
const flush = () => {
  if (!lines.length) return;
  const partNumber = parts.length + 1;
  const file = `${PREFIX}${String(partNumber).padStart(3, "0")}.jsonl`;
  fs.writeFileSync(file, `${lines.join("\n")}\n`);
  parts.push({ part_number: partNumber, file, request_count: lines.length, input_chars: chars, estimated_input_tokens: Math.ceil(chars / 3.5) });
  lines = [];
  chars = 0;
};
for (const line of remainingLines) {
  if (lines.length && chars + line.length + 1 > maxChars) flush();
  lines.push(line);
  chars += line.length + 1;
}
flush();
manifest.max_batch_input_chars = maxChars;
manifest.request_parts = parts;
manifest.repartitioned_at = new Date().toISOString();
manifest.completed_request_ids_preserved = completedIds.size;
fs.writeFileSync(MANIFEST_FILE, `${JSON.stringify(manifest)}\n`);
process.stdout.write(`${JSON.stringify({ completed_request_ids_preserved: completedIds.size, remaining_requests: remainingLines.length, part_count: parts.length, max_batch_input_chars: maxChars, largest_estimated_input_tokens: Math.max(...parts.slice(completedParts.length).map((part) => part.estimated_input_tokens)) }, null, 2)}\n`);
