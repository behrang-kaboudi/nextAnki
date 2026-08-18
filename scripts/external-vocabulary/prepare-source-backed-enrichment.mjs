import fs from "node:fs";

const CATALOG_FILE = "prompt-responses/external-vocabulary/2026-08-11-legacy-pipeline/structurally-valid-vocabulary-database-comparison.json";
const CACHE_FILE = "prompt-responses/external-vocabulary/2026-08-11-legacy-pipeline/external-vocabulary-bamooz-cache.jsonl";
const COMPLETED_FILE = "prompt-responses/external-vocabulary/2026-08-11-legacy-pipeline/structurally-valid-vocabulary-enriched.json";
const OUTPUT_FILE = "prompt-responses/external-vocabulary/2026-08-11-legacy-pipeline/structurally-valid-vocabulary-source-backed.json";

function readJsonLines(file) {
  return fs.readFileSync(file, "utf8").split("\n").filter(Boolean).map((line) => JSON.parse(line));
}

function normalizeTerm(value) {
  return value.normalize("NFKC").replace(/[’‘`]/gu, "'").replace(/\s+/gu, " ").trim().toLocaleLowerCase("en-US");
}

function normalizePersian(value) {
  return String(value ?? "").normalize("NFC").replace(/[يى]/gu, "ی").replace(/ك/gu, "ک").replace(/[\s\u200c\p{P}\p{N}]/gu, "");
}

function persianTokens(value) {
  return new Set(String(value ?? "").normalize("NFC").replace(/[يى]/gu, "ی").replace(/ك/gu, "ک")
    .split(/[،,؛;\/()\[\]\-ـ\s]+/u).map(normalizePersian).filter((token) => token.length > 1));
}

function lexicalType(term) {
  const words = term.trim().split(/\s+/u);
  if (words.length === 1) return "word";
  if (/^(?:to\s+)?\S+\s+(?:about|across|after|along|around|at|away|back|by|down|for|forward|from|in|into|off|on|out|over|through|to|together|up|upon|with)$/iu.test(term)) return "phrasal_verb";
  return words.length <= 4 ? "phrase" : "fixed_expression";
}

function validExample(example) {
  const wordCount = example.sentence_en?.match(/[A-Za-z]+(?:['’-][A-Za-z]+)*/gu)?.length ?? 0;
  return wordCount >= 6 && wordCount <= 14
    && /[.!?]$/u.test(example.sentence_en?.trim() ?? "")
    && /[\u0600-\u06ff]/u.test(example.sentence_en_meaning_fa ?? "");
}

function rankSense(inputMeaning, sense) {
  const input = normalizePersian(inputMeaning);
  const primary = normalizePersian(sense.meaning_fa);
  if (input && input === primary) return { score: 100, match: "exact_primary" };
  if ((sense.other_meanings_fa ?? []).some((value) => normalizePersian(value) === input)) return { score: 90, match: "exact_alternative" };
  if (input && primary && (input.includes(primary) || primary.includes(input))) return { score: 70, match: "contained_primary" };
  const inputTokens = persianTokens(inputMeaning);
  const senseTokens = new Set([sense.meaning_fa, ...(sense.other_meanings_fa ?? [])].flatMap((value) => [...persianTokens(value)]));
  const overlap = [...inputTokens].filter((token) => senseTokens.has(token)).length;
  return { score: overlap ? 40 + overlap : 0, match: overlap ? "token_overlap" : "none" };
}

function chooseSense(inputMeaning, senses) {
  const ranked = senses.map((sense) => ({ sense, ...rankSense(inputMeaning, sense) })).sort((a, b) => b.score - a.score);
  if (!ranked[0] || ranked[0].score === 0 || ranked[1]?.score === ranked[0].score) return null;
  return ranked[0];
}

function sourceBackedEntry(sourceRowIndex, source, dictionary) {
  const [sourceTerm, sourceMeaningFa, sourceRefs, pairExists, literalPairExists, matchStatus, englishWordId, wordSenseIds] = source;
  const selected = chooseSense(sourceMeaningFa, dictionary?.senses ?? []);
  if (!selected) {
    return {
      source_row_index: sourceRowIndex,
      source_term: sourceTerm,
      source_meaning_fa: sourceMeaningFa,
      source_refs: sourceRefs,
      database_before_enrichment: { pair_exists: pairExists, literal_pair_exists: literalPairExists, match_status: matchStatus, english_word_id: englishWordId, word_sense_ids: wordSenseIds },
      base_form: sourceTerm,
      lexical_type: lexicalType(sourceTerm),
      source_match: null,
      status: "review_dictionary_sense",
      missing_fields: ["other_meanings_fa", "pos", "concept_explained_fa", "sentence_en", "sentence_en_meaning_fa"],
    };
  }
  const primary = normalizePersian(sourceMeaningFa);
  const alternatives = (selected.sense.other_meanings_fa ?? [])
    .filter((value) => normalizePersian(value) && normalizePersian(value) !== primary)
    .filter((value, index, values) => values.findIndex((candidate) => normalizePersian(candidate) === normalizePersian(value)) === index)
    .slice(0, 3);
  const example = (selected.sense.examples ?? []).find(validExample) ?? null;
  const missingFields = ["concept_explained_fa", ...(!example ? ["sentence_en", "sentence_en_meaning_fa"] : [])];
  return {
    source_row_index: sourceRowIndex,
    source_term: sourceTerm,
    source_meaning_fa: sourceMeaningFa,
    source_refs: sourceRefs,
    database_before_enrichment: { pair_exists: pairExists, literal_pair_exists: literalPairExists, match_status: matchStatus, english_word_id: englishWordId, word_sense_ids: wordSenseIds },
    base_form: sourceTerm,
    meaning_fa: sourceMeaningFa,
    other_meanings_fa: alternatives,
    pos: selected.sense.pos,
    lexical_type: lexicalType(sourceTerm),
    concept_explained_fa: null,
    sentence_en: example?.sentence_en ?? null,
    sentence_en_meaning_fa: example?.sentence_en_meaning_fa ?? null,
    dictionary_sense_number: selected.sense.sense_number,
    dictionary_url: dictionary.url,
    source_match: selected.match,
    confidence: selected.score >= 90 ? "source_exact" : "source_candidate",
    field_origins: {
      meaning_fa: "input",
      other_meanings_fa: "bamooz",
      pos: "bamooz",
      concept_explained_fa: null,
      sentence_en: example ? "bamooz" : null,
      sentence_en_meaning_fa: example ? "bamooz" : null,
    },
    status: missingFields.length === 1 ? "needs_concept" : "needs_generation",
    missing_fields: missingFields,
  };
}

const catalog = JSON.parse(fs.readFileSync(CATALOG_FILE, "utf8"));
const cache = new Map(readJsonLines(CACHE_FILE).map((record) => [record.normalized_term, record]));
const completed = JSON.parse(fs.readFileSync(COMPLETED_FILE, "utf8"));
const completedByRow = new Map(completed.entries.map((entry) => [entry.source_row_index, entry]));
const entries = catalog.entries.map((source, sourceRowIndex) => {
  const existing = completedByRow.get(sourceRowIndex);
  if (existing) return { ...existing, status: "completed_existing", missing_fields: [] };
  return sourceBackedEntry(sourceRowIndex, source, cache.get(normalizeTerm(source[0])));
});
const counts = entries.reduce((result, entry) => {
  result[entry.status] = (result[entry.status] ?? 0) + 1;
  return result;
}, {});
const result = {
  schema_version: 1,
  generated_at: new Date().toISOString(),
  source_catalog: CATALOG_FILE,
  completed_source: COMPLETED_FILE,
  database_written: false,
  entries,
  stats: { total_entries: entries.length, ...counts },
};
fs.writeFileSync(OUTPUT_FILE, `${JSON.stringify(result)}\n`);
process.stdout.write(`${JSON.stringify({ output_file: OUTPUT_FILE, ...result.stats }, null, 2)}\n`);
