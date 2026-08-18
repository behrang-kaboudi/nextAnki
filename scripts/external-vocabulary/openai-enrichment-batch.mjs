import fs from "node:fs";
import path from "node:path";

import dotenv from "dotenv";
import OpenAI from "openai";

const BATCH_PREFIX = process.env.EXTERNAL_VOCAB_BATCH_PREFIX ?? "prompt-responses/external-vocabulary/2026-08-11-legacy-pipeline/external-vocabulary-enrichment";
const REQUESTS_FILE = `${BATCH_PREFIX}-requests.jsonl`;
const STATE_FILE = `${BATCH_PREFIX}-batch-state.json`;
const MANIFEST_FILE = `${BATCH_PREFIX}-manifest.json`;
const PILOT_OUTPUT_FILE = process.env.EXTERNAL_VOCAB_PILOT_OUTPUT ?? "prompt-responses/external-vocabulary/2026-08-11-legacy-pipeline/external-vocabulary-enrichment-pilot-output.json";
const MAX_ACTIVE_BATCHES = Math.max(1, Number.parseInt(process.env.EXTERNAL_VOCAB_MAX_ACTIVE_BATCHES ?? "1", 10) || 1);

for (const name of [".env.local", ".env"]) {
  const filePath = path.join(process.cwd(), name);
  if (fs.existsSync(filePath)) dotenv.config({ path: filePath, quiet: true });
}
if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is missing.");
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function pilot() {
  const line = fs.readFileSync(REQUESTS_FILE, "utf8").split("\n").find(Boolean);
  if (!line) throw new Error("The requests file is empty.");
  const request = JSON.parse(line);
  if (process.env.EXTERNAL_VOCAB_REASONING) request.body.reasoning_effort = process.env.EXTERNAL_VOCAB_REASONING;
  const response = await client.chat.completions.create(request.body);
  const output = {
    custom_id: request.custom_id,
    model: response.model,
    usage: response.usage,
    content: response.choices[0]?.message?.content ?? "",
  };
  fs.writeFileSync(PILOT_OUTPUT_FILE, `${JSON.stringify(output)}\n`);
  process.stdout.write(`${JSON.stringify({ file: PILOT_OUTPUT_FILE, custom_id: output.custom_id, model: output.model, usage: output.usage }, null, 2)}\n`);
}

async function submit() {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_FILE, "utf8"));
  const parts = manifest.request_parts?.length
    ? manifest.request_parts
    : [{ part_number: 1, file: REQUESTS_FILE, request_count: manifest.request_count }];
  const state = fs.existsSync(STATE_FILE)
    ? JSON.parse(fs.readFileSync(STATE_FILE, "utf8"))
    : { schema_version: 2, created_at: new Date().toISOString(), catalog_sha256: manifest.catalog_sha256, batches: [] };
  if (state.catalog_sha256 !== manifest.catalog_sha256) {
    throw new Error("The batch state belongs to a different catalog. Move it aside only after checking the existing paid jobs.");
  }
  const active = state.batches.filter((item) => !["completed", "failed", "expired", "cancelled"].includes(item.status));
  if (active.length >= MAX_ACTIVE_BATCHES) throw new Error(`${active.length} batches are active; the configured limit is ${MAX_ACTIVE_BATCHES}.`);
  const submittedParts = new Set(state.batches
    .filter((item) => item.status !== "failed" || !item.retryable)
    .map((item) => item.part_number));
  const part = parts.find((item) => !submittedParts.has(item.part_number));
  if (!part) throw new Error("All request parts have already been submitted.");
  const uploaded = await client.files.create({ file: fs.createReadStream(part.file), purpose: "batch" });
  const batch = await client.batches.create({
    input_file_id: uploaded.id,
    endpoint: "/v1/chat/completions",
    completion_window: "24h",
    metadata: { workflow: BATCH_PREFIX, part: String(part.part_number) },
  });
  state.batches.push({
    part_number: part.part_number,
    request_file: part.file,
    request_count: part.request_count,
    submitted_at: new Date().toISOString(),
    input_file_id: uploaded.id,
    batch_id: batch.id,
    status: batch.status,
    output_file_id: batch.output_file_id ?? null,
    error_file_id: batch.error_file_id ?? null,
    retryable: false,
  });
  fs.writeFileSync(STATE_FILE, `${JSON.stringify(state)}\n`);
  process.stdout.write(`${JSON.stringify(state.batches.at(-1), null, 2)}\n`);
}

async function status() {
  const state = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
  for (const item of state.batches) {
    const batch = await client.batches.retrieve(item.batch_id);
    item.status = batch.status;
    item.request_counts = batch.request_counts;
    item.output_file_id = batch.output_file_id ?? null;
    item.error_file_id = batch.error_file_id ?? null;
    item.errors = batch.errors ?? null;
    item.retryable = batch.status === "failed" && batch.errors?.data?.some((error) => error.code === "token_limit_exceeded");
    item.completed_at = batch.completed_at ?? null;
  }
  state.updated_at = new Date().toISOString();
  fs.writeFileSync(STATE_FILE, `${JSON.stringify(state)}\n`);
  process.stdout.write(`${JSON.stringify(state, null, 2)}\n`);
}

async function download() {
  const state = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
  for (const item of state.batches) {
    if (item.output_file_id && !item.output_file) {
      const response = await client.files.content(item.output_file_id);
      item.output_file = `${BATCH_PREFIX}-output-part-${String(item.part_number).padStart(3, "0")}.jsonl`;
      fs.writeFileSync(item.output_file, Buffer.from(await response.arrayBuffer()));
    }
    if (item.error_file_id && !item.error_file) {
      const response = await client.files.content(item.error_file_id);
      item.error_file = `${BATCH_PREFIX}-errors-part-${String(item.part_number).padStart(3, "0")}.jsonl`;
      fs.writeFileSync(item.error_file, Buffer.from(await response.arrayBuffer()));
    }
  }
  state.updated_at = new Date().toISOString();
  fs.writeFileSync(STATE_FILE, `${JSON.stringify(state)}\n`);
  process.stdout.write(`${JSON.stringify(state, null, 2)}\n`);
}

async function run() {
  const lastStatusByPart = new Map();
  while (true) {
    if (!fs.existsSync(STATE_FILE)) await submit();
    let state = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
    const manifest = JSON.parse(fs.readFileSync(MANIFEST_FILE, "utf8"));
    const totalParts = manifest.request_parts?.length ?? 1;
    const active = state.batches.filter((item) => !["completed", "failed", "expired", "cancelled"].includes(item.status));
    for (const item of active) {
      const batch = await client.batches.retrieve(item.batch_id);
      item.status = batch.status;
      item.request_counts = batch.request_counts;
      item.output_file_id = batch.output_file_id ?? null;
      item.error_file_id = batch.error_file_id ?? null;
      item.errors = batch.errors ?? null;
      item.retryable = batch.status === "failed" && batch.errors?.data?.some((error) => error.code === "token_limit_exceeded");
      item.completed_at = batch.completed_at ?? null;
      state.updated_at = new Date().toISOString();
      fs.writeFileSync(STATE_FILE, `${JSON.stringify(state)}\n`);
      const compactStatus = `${item.part_number}:${item.status}:${batch.request_counts?.completed ?? 0}:${batch.request_counts?.failed ?? 0}`;
      if (compactStatus !== lastStatusByPart.get(item.part_number)) {
        process.stdout.write(`${JSON.stringify({ part_number: item.part_number, total_parts: totalParts, status: item.status, request_counts: item.request_counts })}\n`);
        lastStatusByPart.set(item.part_number, compactStatus);
      }
    }
    state = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
    for (const item of state.batches.filter((batch) => batch.status === "failed" && itemNeedsErrorDetails(batch))) {
      const batch = await client.batches.retrieve(item.batch_id);
      item.errors = batch.errors ?? null;
      item.retryable = batch.errors?.data?.some((error) => error.code === "token_limit_exceeded") ?? false;
    }
    fs.writeFileSync(STATE_FILE, `${JSON.stringify(state)}\n`);
    const failed = state.batches.find((item) =>
      ["expired", "cancelled"].includes(item.status) || (item.status === "failed" && !item.retryable),
    );
    if (failed) throw new Error(`Batch part ${failed.part_number} ended with ${failed.status}; inspect it before retrying.`);
    const readyToDownload = state.batches.some((item) => item.output_file_id && !item.output_file);
    if (readyToDownload) await download();
    state = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
    let activeCount = state.batches.filter((item) => !["completed", "failed", "expired", "cancelled"].includes(item.status)).length;
    const finishedParts = new Set(state.batches.filter((item) => item.status === "completed").map((item) => item.part_number));
    while (activeCount < MAX_ACTIVE_BATCHES && finishedParts.size + activeCount < totalParts) {
      await submit();
      state = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
      activeCount += 1;
    }
    const completedParts = new Set(state.batches.filter((item) => item.status === "completed" && item.output_file).map((item) => item.part_number));
    if (activeCount === 0 && completedParts.size === totalParts) {
      process.stdout.write(`${JSON.stringify({ done: true, total_parts: totalParts })}\n`);
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 30_000));
  }
}

function itemNeedsErrorDetails(item) {
  return !item.errors;
}

const command = process.argv[2];
if (command === "pilot") await pilot();
else if (command === "submit") await submit();
else if (command === "status") await status();
else if (command === "download") await download();
else if (command === "run") await run();
else throw new Error("Usage: node openai-enrichment-batch.mjs <pilot|submit|status|download|run>");
