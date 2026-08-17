import fs from "node:fs";

const args = new Map(process.argv.slice(2).map((arg) => {
  const [key, value = "true"] = arg.split("=", 2);
  return [key, value];
}));
const outputFile = args.get("--file") ?? "external-vocabulary-enrichment-pilot-output.json";
const manifestFile = args.get("--manifest") ?? "external-vocabulary-enrichment-manifest.json";

function persianWordCount(value) {
  return value.trim().split(/\s+/u).filter(Boolean).length;
}

function englishWordCount(value) {
  return value.match(/[A-Za-z]+(?:['’-][A-Za-z]+)*/gu)?.length ?? 0;
}

function normalizePersianLoose(value) {
  return value.normalize("NFC").replace(/[يى]/gu, "ی").replace(/ك/gu, "ک").replace(/[\s\u200c\p{P}\p{N}]/gu, "");
}

function main() {
  const wrapper = JSON.parse(fs.readFileSync(outputFile, "utf8"));
  const output = JSON.parse(wrapper.content);
  const manifest = JSON.parse(fs.readFileSync(manifestFile, "utf8"));
  const request = manifest.requests.find((item) => item.custom_id === wrapper.custom_id);
  if (!request) throw new Error(`No manifest entry for ${wrapper.custom_id}.`);
  const errors = [];
  const warnings = [];
  const items = Array.isArray(output.items) ? output.items : [];
  if (items.length !== request.source_row_indices.length) {
    errors.push(`Expected ${request.source_row_indices.length} items, received ${items.length}.`);
  }
  items.forEach((item, index) => {
    const label = `item ${index} / row ${item.source_row_index}`;
    if (item.source_row_index !== request.source_row_indices[index]) errors.push(`${label}: source_row_index order mismatch.`);
    for (const field of ["base_form", "meaning_fa", "pos", "concept_explained_fa", "sentence_en", "sentence_en_meaning_fa"]) {
      if (typeof item[field] !== "string" || !item[field].trim()) errors.push(`${label}: ${field} is blank.`);
    }
    if (!Array.isArray(item.other_meanings_fa) || item.other_meanings_fa.length > 3) errors.push(`${label}: invalid other_meanings_fa.`);
    const primary = normalizePersianLoose(item.meaning_fa ?? "");
    const alternatives = (item.other_meanings_fa ?? []).map(normalizePersianLoose);
    if (alternatives.includes(primary)) errors.push(`${label}: primary meaning repeated in other_meanings_fa.`);
    if (new Set(alternatives).size !== alternatives.length) errors.push(`${label}: duplicate other_meanings_fa.`);
    const conceptWords = persianWordCount(item.concept_explained_fa ?? "");
    if (conceptWords > 50) errors.push(`${label}: concept has ${conceptWords} words (maximum 50).`);
    const sentenceWords = englishWordCount(item.sentence_en ?? "");
    if (sentenceWords < 6 || sentenceWords > 14) warnings.push(`${label}: sentence has ${sentenceWords} words (ideal 6–14).`);
    if (!/[\u0600-\u06ff]/u.test(item.sentence_en_meaning_fa ?? "")) errors.push(`${label}: sentence translation is not Persian.`);
    if (!/[.!?]$/u.test((item.sentence_en ?? "").trim())) warnings.push(`${label}: sentence lacks terminal punctuation.`);
  });
  process.stdout.write(`${JSON.stringify({ file: outputFile, items: items.length, errors, warnings, passed: errors.length === 0 }, null, 2)}\n`);
  if (errors.length) process.exitCode = 1;
}

main();
