import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const planFile = process.env.EXTERNAL_VOCAB_IMPORT_PLAN_FILE
  ?? "prompt-responses/external-vocabulary/2026-08-11-legacy-pipeline/external-vocabulary-completed-at-least-35-14888-database-import-plan.json";
const ambiguitiesFile = process.env.EXTERNAL_VOCAB_IMPORT_AMBIGUITIES_FILE
  ?? "prompt-responses/external-vocabulary/2026-08-11-legacy-pipeline/external-vocabulary-completed-at-least-35-14888-database-import-ambiguities.json";
const outputFile = process.env.EXTERNAL_VOCAB_IMPORT_RESOLUTIONS_FILE
  ?? "prompt-responses/external-vocabulary/2026-08-11-legacy-pipeline/external-vocabulary-completed-at-least-35-14888-persian-resolutions.json";
const batchSize = 150;
const codex = "/Applications/ChatGPT.app/Contents/Resources/codex";
const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "persian-resolution-"));
const schemaPath = path.join(tempDirectory, "schema.json");
const responsePath = path.join(tempDirectory, "response.json");

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["decisions"],
  properties: {
    decisions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["source_row_index", "key", "persianWordId"],
        properties: {
          source_row_index: { type: "integer" },
          key: { type: "string" },
          persianWordId: { type: "integer" },
        },
      },
    },
  },
};
fs.writeFileSync(schemaPath, JSON.stringify(schema));

const plan = JSON.parse(fs.readFileSync(planFile, "utf8"));
const planByRow = new Map(plan.entries.map((entry) => [entry.source_row_index, entry]));
const ambiguityRows = JSON.parse(fs.readFileSync(ambiguitiesFile, "utf8")).ambiguities;
const occurrences = ambiguityRows.flatMap((row) => {
  const entry = planByRow.get(row.source_row_index);
  if (!entry) throw new Error(`Missing plan entry ${row.source_row_index}`);
  return row.ambiguities.map((ambiguity) => ({
    source_row_index: row.source_row_index,
    key: ambiguity.key,
    english_word: entry.base_form,
    part_of_speech: entry.pos,
    primary_persian_meaning: entry.meaning_fa,
    concept_fa: entry.concept_explained_fa,
    example_sentence: entry.sentence_en,
    field: ambiguity.field,
    ambiguous_persian_text: ambiguity.text,
    candidates: ambiguity.candidates,
  }));
});

const decisions = [];
for (let index = 0; index < occurrences.length; index += batchSize) {
  const batch = occurrences.slice(index, index + batchSize);
  const prompt = `Choose the PersianWord candidate whose Persian pronunciation and lexical meaning fit the supplied English word, field, Persian context, concept, and sentence. Each candidate differs by pronunciation despite sharing the same spelling. For every item, select exactly one candidate id from that item's candidates. Do not invent ids and do not omit items.\n\n${JSON.stringify(batch)}\n\nReturn only the JSON required by the schema.`;
  execFileSync(codex, [
    "exec",
    "--ephemeral",
    "--ignore-user-config",
    "--sandbox",
    "read-only",
    "--model",
    "gpt-5.6-sol",
    "-c",
    'model_reasoning_effort="medium"',
    "--output-schema",
    schemaPath,
    "--output-last-message",
    responsePath,
    "--cd",
    process.cwd(),
    "-",
  ], {
    input: prompt,
    encoding: "utf8",
    stdio: ["pipe", "ignore", "pipe"],
    timeout: 15 * 60 * 1000,
    maxBuffer: 10 * 1024 * 1024,
  });
  const response = JSON.parse(fs.readFileSync(responsePath, "utf8"));
  if (!Array.isArray(response.decisions) || response.decisions.length !== batch.length) {
    throw new Error(`Expected ${batch.length} decisions, received ${response.decisions?.length}`);
  }
  const expected = new Map(batch.map((item) => [`${item.source_row_index}\u0000${item.key}`, item]));
  const seen = new Set();
  for (const decision of response.decisions) {
    const decisionKey = `${decision.source_row_index}\u0000${decision.key}`;
    const item = expected.get(decisionKey);
    if (!item || seen.has(decisionKey) || !item.candidates.some((candidate) => candidate.id === decision.persianWordId)) {
      throw new Error(`Invalid decision ${JSON.stringify(decision)}`);
    }
    seen.add(decisionKey);
    decisions.push(decision);
  }
  process.stdout.write(`${JSON.stringify({ completed: decisions.length, total: occurrences.length })}\n`);
}

fs.writeFileSync(outputFile, `${JSON.stringify({
  generated_at: new Date().toISOString(),
  source_plan: planFile,
  source_ambiguities: ambiguitiesFile,
  row_count: ambiguityRows.length,
  decision_count: decisions.length,
  decisions,
}, null, 2)}\n`);
fs.rmSync(tempDirectory, { recursive: true, force: true });
process.stdout.write(`${JSON.stringify({ output_file: outputFile, rows: ambiguityRows.length, decisions: decisions.length }, null, 2)}\n`);
