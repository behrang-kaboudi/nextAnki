import fs from "node:fs";

const planFile = process.env.EXTERNAL_VOCAB_IMPORT_PLAN_FILE
  ?? "external-vocabulary-completed-at-least-35-14888-database-import-plan.json";
const resolutionsFile = process.env.EXTERNAL_VOCAB_IMPORT_RESOLUTIONS_FILE
  ?? "external-vocabulary-completed-at-least-35-14888-persian-resolutions.json";
const resultsFile = process.env.EXTERNAL_VOCAB_IMPORT_RESOLVED_RESULTS_FILE
  ?? "external-vocabulary-completed-at-least-35-14888-resolved-import-results.jsonl";
const endpoint = process.env.EXTERNAL_VOCAB_IMPORT_URL
  ?? "http://localhost:3000/api/word-extraction/base/insert-tempwords";

const plan = JSON.parse(fs.readFileSync(planFile, "utf8"));
const planByRow = new Map(plan.entries.map((entry) => [entry.source_row_index, entry]));
const resolutionDocument = JSON.parse(fs.readFileSync(resolutionsFile, "utf8"));
const resolutionsByRow = Map.groupBy(resolutionDocument.decisions, (decision) => decision.source_row_index);

let inserted = 0;
let skipped = 0;
let failed = 0;
for (const [sourceRowIndex, decisions] of resolutionsByRow) {
  const item = planByRow.get(sourceRowIndex);
  if (!item) throw new Error(`Missing plan entry ${sourceRowIndex}`);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      items: [{
        base_form: item.base_form,
        meaning_fa: item.meaning_fa,
        other_meanings_fa: item.other_meanings_fa ?? [],
        pos: item.pos,
        concept_explained_fa: item.concept_explained_fa,
        sentence_en: item.sentence_en,
        sentence_en_meaning_fa: item.sentence_en_meaning_fa,
        productive_target: item.productive_target,
      }],
      persian_word_resolutions: decisions.map((decision) => ({
        key: decision.key,
        persianWordId: decision.persianWordId,
      })),
    }),
    signal: AbortSignal.timeout(120_000),
  });
  const body = await response.json().catch(() => null);
  const result = body?.results?.[0];
  const status = response.ok && body?.ok && result?.ok ? result.action : "error";
  if (status === "inserted") inserted += 1;
  else if (status === "skipped_exists") skipped += 1;
  else failed += 1;
  fs.appendFileSync(resultsFile, `${JSON.stringify({
    source_row_index: sourceRowIndex,
    status,
    word_sense_id: result?.id ?? null,
    error: result?.error ?? body?.error ?? `HTTP ${response.status}`,
  })}\n`);
  if ((inserted + skipped + failed) % 50 === 0) {
    process.stdout.write(`${JSON.stringify({ processed: inserted + skipped + failed, total: resolutionsByRow.size, inserted, skipped, failed })}\n`);
  }
}
process.stdout.write(`${JSON.stringify({ done: true, total: resolutionsByRow.size, inserted, skipped, failed, results_file: resultsFile }, null, 2)}\n`);
if (failed) process.exitCode = 2;
