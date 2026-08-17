import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const roundDir = resolve(process.argv[2] ?? "");
if (!process.argv[2]) throw new Error("Usage: node prepare-lane22-partial-apply.mjs <round-dir>");

const excludedId = 70226;
const input = JSON.parse(await readFile(resolve(roundDir, "lane-22-input.json"), "utf8"));
const responseText = await readFile(resolve(roundDir, "lane-22-response-revision-05.raw.json"), "utf8");
const response = JSON.parse(responseText);
const score = JSON.parse(await readFile(resolve(roundDir, "lane-22-score-06.raw.json"), "utf8"));
const persianPattern = /[\u0600-\u06ff]/u;
const issues = [];

if (input.length !== 300 || response.length !== input.length) issues.push({ type: "count", input: input.length, response: response.length });
for (let index = 0; index < Math.max(input.length, response.length); index += 1) {
  const source = input[index];
  const output = response[index];
  if (!output) { issues.push({ type: "missing", index, expectedId: source?.id }); continue; }
  if (Object.keys(output).sort().join(",") !== "id,meaning_fa_IPA") issues.push({ type: "schema", index, id: output.id });
  if (output.id !== source?.id) issues.push({ type: "id_or_order", index, expectedId: source?.id, actualId: output.id });
  if (typeof output.meaning_fa_IPA !== "string" || !output.meaning_fa_IPA.trim()) issues.push({ type: "empty_ipa", index, id: output.id });
  else {
    if (output.meaning_fa_IPA.includes("/")) issues.push({ type: "slash", index, id: output.id });
    if (persianPattern.test(output.meaning_fa_IPA)) issues.push({ type: "persian_character", index, id: output.id });
  }
}
if (issues.length) throw new Error(`Lane 22 response failed mechanical validation: ${JSON.stringify(issues.slice(0, 20))}`);
if (score.assessment !== "revise" || JSON.stringify(score.belowOrEqual8Ids) !== JSON.stringify([excludedId])) {
  throw new Error(`Unexpected lane 22 score scope: ${JSON.stringify(score)}`);
}

const accepted = response.flatMap((item, index) => item.id === excludedId
  ? []
  : [{ id: item.id, canonical_text: input[index].canonical_text, meaning_fa_IPA: item.meaning_fa_IPA }]);
const excluded = input.filter((item) => item.id === excludedId);
if (accepted.length !== 299 || excluded.length !== 1) throw new Error(`Unexpected partial scope: ${accepted.length} accepted, ${excluded.length} excluded.`);

const acceptedText = `${JSON.stringify(accepted, null, 2)}\n`;
await writeFile(resolve(roundDir, "lane-22-partial-accepted-299.json"), acceptedText, "utf8");
await writeFile(resolve(roundDir, "lane-22-partial-excluded-1.json"), `${JSON.stringify(excluded, null, 2)}\n`, "utf8");
await writeFile(resolve(roundDir, "lane-22-partial-scope-report.json"), `${JSON.stringify({
  status: "validated_pending_database_apply",
  authorization: "User explicitly approved applying all lane 22 records except the single below-threshold record.",
  sourceResponseFile: "lane-22-response-revision-05.raw.json",
  sourceScoreFile: "lane-22-score-06.raw.json",
  sourceResponseSha256: createHash("sha256").update(responseText).digest("hex"),
  finalScore: score,
  acceptedRecords: accepted.length,
  excludedRecords: excluded.length,
  excludedIds: [excludedId],
  mechanicalValidation: { status: "passed", issues: [] },
  acceptedFile: "lane-22-partial-accepted-299.json",
  excludedFile: "lane-22-partial-excluded-1.json",
}, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ acceptedRecords: accepted.length, excludedRecords: excluded.length, excludedIds: [excludedId] }, null, 2));
