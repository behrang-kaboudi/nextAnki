import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const filePath = path.resolve(
  process.argv[2] ?? "prompt-responses/external-vocabulary/2026-08-11-legacy-pipeline/external-vocabulary-productive-target-above-40-20075.json",
);
const batchSize = Number(process.argv[3] ?? 200);
const workspace = process.cwd();
const codex = "/Applications/ChatGPT.app/Contents/Resources/codex";
const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "productive-target-"));
const schemaPath = path.join(tempDirectory, "schema.json");
const outputPath = path.join(tempDirectory, "output.json");
const logPath = path.join(
  workspace,
  "prompt-responses/external-vocabulary/2026-08-11-legacy-pipeline/external-vocabulary-new-productive-target-progress.log",
);

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["scores"],
  properties: {
    scores: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["source_row_index", "score"],
        properties: {
          source_row_index: { type: "integer" },
          score: { type: "integer", minimum: 1, maximum: 101 },
        },
      },
    },
  },
};
fs.writeFileSync(schemaPath, JSON.stringify(schema));

const rubric = `Assign a Productive Target score from 1 to 101 for each specific meaning.
Productive Target is the importance for an average person to recall and use the word quickly, accurately, and naturally in spoken contemporary North American English across age groups.

Judge every entry independently and only for its supplied meaning, POS, and example. Consider: how often an average person needs to express that exact concept; whether a short natural alternative makes the exact word unnecessary; productive need rather than receptive familiarity; everyday/general use versus specialized, scientific, literary, academic, technical, archaic, regional, or register-limited use; spoken naturalness; breadth of situations and collocations; obstruction or consequences in health, safety, work, and everyday life; need for quick recall; and whether speakers now normally choose another word. Names of specific species, objects, and similar items score high only when there is a genuine productive need.

Do not derive scores from the existing productive_target field, frequency formulas, CEFR, or neighboring entries. Use semantic judgment. Return exactly one score for every supplied source_row_index.`;

function save(document) {
  const temporaryPath = `${filePath}.tmp`;
  fs.writeFileSync(temporaryPath, `${JSON.stringify(document, null, 2)}\n`);
  fs.renameSync(temporaryPath, filePath);
}

function appendLog(message) {
  const line = `${new Date().toISOString()} ${message}\n`;
  fs.appendFileSync(logPath, line);
  process.stdout.write(line);
}

try {
  while (true) {
    const document = JSON.parse(fs.readFileSync(filePath, "utf8"));
    const pending = document.entries.filter(
      (entry) => !Number.isInteger(entry.new_productive_target),
    );
    if (pending.length === 0) {
      appendLog(`COMPLETE total=${document.entries.length}`);
      break;
    }

    const batch = pending.slice(0, batchSize);
    const expectedRows = new Set(batch.map((entry) => entry.source_row_index));
    const payload = batch.map((entry) => ({
      source_row_index: entry.source_row_index,
      word: entry.base_form,
      part_of_speech: entry.pos,
      persian_meaning: entry.meaning_fa,
      example_sentence: entry.sentence_en,
    }));
    const prompt = `${rubric}\n\nEntries:\n${JSON.stringify(payload)}\n\nReturn only the JSON object required by the output schema.`;

    let parsed;
    let lastError;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        execFileSync(
          codex,
          [
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
            outputPath,
            "--cd",
            workspace,
            "-",
          ],
          {
            input: prompt,
            encoding: "utf8",
            stdio: ["pipe", "ignore", "pipe"],
            timeout: 15 * 60 * 1000,
            maxBuffer: 10 * 1024 * 1024,
          },
        );
        parsed = JSON.parse(fs.readFileSync(outputPath, "utf8"));
        if (!Array.isArray(parsed.scores) || parsed.scores.length !== batch.length) {
          throw new Error(`expected ${batch.length} scores, received ${parsed.scores?.length}`);
        }
        const returnedRows = new Set();
        for (const result of parsed.scores) {
          if (
            !expectedRows.has(result.source_row_index) ||
            returnedRows.has(result.source_row_index) ||
            !Number.isInteger(result.score) ||
            result.score < 1 ||
            result.score > 101
          ) {
            throw new Error(`invalid result ${JSON.stringify(result)}`);
          }
          returnedRows.add(result.source_row_index);
        }
        lastError = undefined;
        break;
      } catch (error) {
        lastError = error;
        appendLog(`RETRY attempt=${attempt} error=${String(error.message).replaceAll("\n", " ")}`);
      }
    }
    if (lastError) throw lastError;

    const resultByRow = new Map(
      parsed.scores.map((result) => [result.source_row_index, result.score]),
    );
    for (const entry of document.entries) {
      const score = resultByRow.get(entry.source_row_index);
      if (score !== undefined) entry.new_productive_target = score;
    }

    const completed = document.entries.filter((entry) =>
      Number.isInteger(entry.new_productive_target),
    ).length;
    document.stats = {
      ...document.stats,
      new_productive_target_completed: completed,
      new_productive_target_total: document.entries.length,
      new_productive_target_method:
        "GPT-5.6-sol medium semantic evaluation using productive_target prompt",
    };
    save(document);
    appendLog(`BATCH applied=${batch.length} completed=${completed} total=${document.entries.length}`);
  }
} finally {
  fs.rmSync(tempDirectory, { recursive: true, force: true });
}
