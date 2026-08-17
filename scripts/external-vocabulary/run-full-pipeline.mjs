import { spawnSync } from "node:child_process";
import fs from "node:fs";

const allowDatabaseImport = process.env.EXTERNAL_VOCAB_ALLOW_DATABASE_IMPORT === "1";
const targetPartChars = Math.max(150_000, Number.parseInt(process.env.EXTERNAL_VOCAB_TARGET_PART_CHARS ?? "950000", 10) || 950_000);
const maxActiveBatches = process.env.EXTERNAL_VOCAB_MAX_ACTIVE_BATCHES ?? "4";

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    env: { ...process.env, ...options.env },
    encoding: "utf8",
    stdio: options.capture ? "pipe" : "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0 && !options.allowedStatuses?.includes(result.status)) {
    throw new Error(`${command} ${args.join(" ")} exited with ${result.status}.`);
  }
  return result;
}

function state(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

async function waitForFirstBatch() {
  while (true) {
    run("node", ["scripts/external-vocabulary/openai-enrichment-batch.mjs", "status"], { capture: true });
    const first = state("external-vocabulary-enrichment-batch-state.json").batches.find((batch) => batch.part_number === 1);
    process.stdout.write(`${JSON.stringify({ stage: "initial_batch", status: first.status, request_counts: first.request_counts })}\n`);
    if (first.status === "completed") return;
    if (["failed", "expired", "cancelled"].includes(first.status)) throw new Error(`Initial batch ended with ${first.status}.`);
    await new Promise((resolve) => setTimeout(resolve, 30_000));
  }
}

await waitForFirstBatch();
run("node", ["scripts/external-vocabulary/openai-enrichment-batch.mjs", "download"]);
const manifest = state("external-vocabulary-enrichment-manifest.json");
if (manifest.max_batch_input_chars > targetPartChars) {
  while (true) {
    run("node", ["scripts/external-vocabulary/openai-enrichment-batch.mjs", "status"], { capture: true });
    const batches = state("external-vocabulary-enrichment-batch-state.json").batches;
    const active = batches.filter((batch) => !["completed", "failed", "expired", "cancelled"].includes(batch.status));
    const fatal = batches.find((batch) => ["expired", "cancelled"].includes(batch.status) || (batch.status === "failed" && !batch.retryable));
    if (fatal) throw new Error(`Batch part ${fatal.part_number} ended with ${fatal.status}.`);
    process.stdout.write(`${JSON.stringify({ stage: "waiting_to_repartition", active_parts: active.map((batch) => batch.part_number) })}\n`);
    if (!active.length) break;
    await new Promise((resolve) => setTimeout(resolve, 30_000));
  }
  run("node", ["scripts/external-vocabulary/openai-enrichment-batch.mjs", "download"]);
  run("node", ["scripts/external-vocabulary/repartition-openai-enrichment-batches.mjs"], {
    env: { EXTERNAL_VOCAB_REPARTITION_CHARS: String(targetPartChars) },
  });
}
run("node", ["scripts/external-vocabulary/openai-enrichment-batch.mjs", "run"], {
  env: { EXTERNAL_VOCAB_MAX_ACTIVE_BATCHES: maxActiveBatches },
});
run("node", ["scripts/external-vocabulary/collect-openai-enrichment-output.mjs"]);
run("node", ["scripts/external-vocabulary/validate-enriched-vocabulary.mjs"], { allowedStatuses: [2] });
run("node", ["scripts/external-vocabulary/prepare-openai-enrichment-review.mjs"]);
const reviewManifest = state("external-vocabulary-review-manifest.json");
if (reviewManifest.request_count > 0) {
  run("node", ["scripts/external-vocabulary/openai-enrichment-batch.mjs", "run"], {
    env: { EXTERNAL_VOCAB_BATCH_PREFIX: "external-vocabulary-review", EXTERNAL_VOCAB_MAX_ACTIVE_BATCHES: "20" },
  });
  run("node", ["scripts/external-vocabulary/merge-openai-enrichment-review.mjs"]);
} else {
  fs.copyFileSync("structurally-valid-vocabulary-enriched.json", "structurally-valid-vocabulary-enriched-reviewed.json");
}
run("node", ["scripts/external-vocabulary/validate-enriched-vocabulary.mjs"], {
  allowedStatuses: [2],
  env: {
    EXTERNAL_VOCAB_ENRICHED_FILE: "structurally-valid-vocabulary-enriched-reviewed.json",
    EXTERNAL_VOCAB_VALIDATION_FILE: "external-vocabulary-enrichment-reviewed-validation.json",
  },
});
const finalValidation = state("external-vocabulary-enrichment-reviewed-validation.json");
if (finalValidation.error_rows || finalValidation.review_rows) {
  fs.writeFileSync("external-vocabulary-pipeline-status.json", `${JSON.stringify({ status: "quality_gate", generated_at: new Date().toISOString(), error_rows: finalValidation.error_rows, review_rows: finalValidation.review_rows })}\n`);
  throw new Error(`Final quality gate has ${finalValidation.error_rows} error rows and ${finalValidation.review_rows} review rows; database import was not started.`);
}
run("node", ["scripts/external-vocabulary/prepare-database-import.mjs"]);
if (!allowDatabaseImport) {
  fs.writeFileSync("external-vocabulary-pipeline-status.json", `${JSON.stringify({ status: "ready_for_database_import", generated_at: new Date().toISOString() })}\n`);
  process.exit(0);
}
run("npm", ["run", "db:backup"]);
run("npm", ["run", "dev:start"]);
run("node", ["scripts/external-vocabulary/import-enriched-vocabulary.mjs", "--execute"], { allowedStatuses: [2] });
fs.writeFileSync("external-vocabulary-pipeline-status.json", `${JSON.stringify({ status: "database_import_finished", generated_at: new Date().toISOString() })}\n`);
