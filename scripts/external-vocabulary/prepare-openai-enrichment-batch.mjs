import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const CATALOG_FILE = "structurally-valid-vocabulary-database-comparison.json";
const CACHE_FILE = "external-vocabulary-bamooz-cache.jsonl";
const REQUESTS_FILE = "external-vocabulary-enrichment-requests.jsonl";
const MANIFEST_FILE = "external-vocabulary-enrichment-manifest.json";
const REQUEST_PART_PREFIX = "external-vocabulary-enrichment-requests-part-";
const MODEL = process.env.EXTERNAL_VOCAB_MODEL ?? "gpt-5.6-sol";
const REASONING = process.env.EXTERNAL_VOCAB_REASONING ?? "medium";
const MAX_ENTRIES = 8;
const MAX_USER_CHARS = 32_000;
const MAX_BATCH_INPUT_CHARS = Math.max(
  250_000,
  Number.parseInt(process.env.EXTERNAL_VOCAB_MAX_BATCH_INPUT_CHARS ?? "4000000", 10) || 4_000_000,
);
const args = new Map(process.argv.slice(2).map((arg) => {
  const [key, value = "true"] = arg.split("=", 2);
  return [key, value];
}));
const limitRequests = Math.max(0, Number.parseInt(args.get("--limit-requests") ?? "0", 10) || 0);

function normalizeTerm(value) {
  return value.normalize("NFKC").replace(/[’‘`]/gu, "'").replace(/\s+/gu, " ").trim().toLocaleLowerCase("en-US");
}

function readJsonLines(filePath) {
  if (!fs.existsSync(filePath)) return [];
  return fs.readFileSync(filePath, "utf8").split("\n").filter(Boolean).map((line) => JSON.parse(line));
}

function promptText() {
  const files = [
    "src/prompts/word-extraction/base/rulseV1.md",
    "src/prompts/word-extraction/base_form/rulseV1.md",
    "src/prompts/word-extraction/meaning_fa/rulseV1.md",
    "src/prompts/word-extraction/other_meanings_fa/rulseV1.md",
    "src/prompts/word-extraction/pos/rulseV1.md",
    "src/prompts/word-extraction/concept_explained_fa/rulseV1.md",
    "src/prompts/word-extraction/sentence_en/rulseV1.md",
    "src/prompts/word-extraction/sentence_meaning_fa/rulseV1.md",
  ];
  const projectRules = files.map((file) => fs.readFileSync(path.join(process.cwd(), file), "utf8")).join("\n\n");
  return `${projectRules}\n\nADDITIONAL ENRICHMENT WORKFLOW RULES\n
- Return exactly one output item for every input record, in the same order, with the same source_row_index.
- Treat every input record as one intended sense. Never merge records or introduce a new English sense.
- All records for a headword are supplied together. Use that context to keep POS and senses distinct.
- Use B-amooz evidence when it clearly matches the exact input sense. Dictionary content is evidence, not unquestionable truth.
- Validate a source example against every sentence_en rule. Reuse it only if it passes; otherwise generate a new original sentence.
- meaning_fa may receive only a minimal grammatical or obvious-error correction. Do not replace it with another sense.
- other_meanings_fa may contain at most three common, natural equivalents of this exact sense and grammatical role.
- lexical_type must describe the lexical unit: word, phrasal_verb, idiom, fixed_expression, collocation, phrase, or other.
- source origins must be bamooz, generated, input, or mixed.
- Set confidence to review and add concise review_flags instead of guessing when evidence is ambiguous.
- If dictionary.fetch_status is not ok or dictionary has no senses, add dictionary_evidence_missing to review_flags and set confidence to review.
- Output JSON only, conforming exactly to the supplied schema.`;
}

const outputSchema = {
  type: "object",
  additionalProperties: false,
  required: ["items"],
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "source_row_index", "base_form", "meaning_fa", "other_meanings_fa", "pos", "lexical_type",
          "concept_explained_fa", "sentence_en", "sentence_en_meaning_fa", "dictionary_sense_number",
          "confidence", "review_flags", "field_origins",
        ],
        properties: {
          source_row_index: { type: "integer" },
          base_form: { type: "string" },
          meaning_fa: { type: "string" },
          other_meanings_fa: { type: "array", maxItems: 3, items: { type: "string" } },
          pos: { type: "string" },
          lexical_type: { type: "string", enum: ["word", "phrasal_verb", "idiom", "fixed_expression", "collocation", "phrase", "other"] },
          concept_explained_fa: { type: "string" },
          sentence_en: { type: "string" },
          sentence_en_meaning_fa: { type: "string" },
          dictionary_sense_number: { anyOf: [{ type: "integer" }, { type: "null" }] },
          confidence: { type: "string", enum: ["high", "medium", "review"] },
          review_flags: { type: "array", items: { type: "string" } },
          field_origins: {
            type: "object",
            additionalProperties: false,
            required: ["meaning_fa", "other_meanings_fa", "pos", "concept_explained_fa", "sentence_en", "sentence_en_meaning_fa"],
            properties: Object.fromEntries(
              ["meaning_fa", "other_meanings_fa", "pos", "concept_explained_fa", "sentence_en", "sentence_en_meaning_fa"]
                .map((field) => [field, { type: "string", enum: ["bamooz", "generated", "input", "mixed"] }]),
            ),
          },
        },
      },
    },
  },
};

function compactDictionary(record) {
  if (!record) return null;
  return {
    url: record.url,
    fetch_status: record.fetch_status,
    parse_status: record.parse_status,
    senses: (record.senses ?? []).map((sense) => ({
      sense_number: sense.sense_number,
      pos: sense.pos,
      meaning_fa: sense.meaning_fa,
      other_meanings_fa: (sense.other_meanings_fa ?? []).slice(0, 8),
      examples: (sense.examples ?? []).slice(0, 3),
    })),
  };
}

function main() {
  const catalogRaw = fs.readFileSync(CATALOG_FILE);
  const catalog = JSON.parse(catalogRaw);
  const cacheRows = readJsonLines(CACHE_FILE);
  const cache = new Map(cacheRows.map((record) => [record.normalized_term, record]));
  const byTerm = new Map();
  catalog.entries.forEach((row, sourceRowIndex) => {
    const [term, meaningFa, sourceRefs, databasePairExists, databaseLiteralPairExists, databaseMatchStatus, databaseEnglishWordId, databaseWordSenseIds] = row;
    const key = normalizeTerm(term);
    const group = byTerm.get(key) ?? { normalized_term: key, term, records: [] };
    group.records.push({
      source_row_index: sourceRowIndex,
      base_form_input: term,
      meaning_fa_input: meaningFa,
      source_refs: sourceRefs,
      database: {
        pair_exists: databasePairExists,
        literal_pair_exists: databaseLiteralPairExists,
        match_status: databaseMatchStatus,
        english_word_id: databaseEnglishWordId,
        word_sense_ids: databaseWordSenseIds,
      },
    });
    byTerm.set(key, group);
  });

  const units = [...byTerm.values()]
    .filter((group) => cache.has(group.normalized_term))
    .map((group) => ({ ...group, dictionary: compactDictionary(cache.get(group.normalized_term)) }));
  const requestGroups = [];
  let current = [];
  let currentEntries = 0;
  let currentChars = 0;
  for (const unit of units) {
    const unitChars = JSON.stringify(unit).length;
    const wouldOverflow = current.length && (currentEntries + unit.records.length > MAX_ENTRIES || currentChars + unitChars > MAX_USER_CHARS);
    if (wouldOverflow) {
      requestGroups.push(current);
      current = [];
      currentEntries = 0;
      currentChars = 0;
    }
    current.push(unit);
    currentEntries += unit.records.length;
    currentChars += unitChars;
  }
  if (current.length) requestGroups.push(current);
  const selectedGroups = limitRequests ? requestGroups.slice(0, limitRequests) : requestGroups;
  const systemPrompt = promptText();
  const requests = selectedGroups.map((groups, index) => ({
    custom_id: `external-vocab-${String(index + 1).padStart(6, "0")}`,
    method: "POST",
    url: "/v1/chat/completions",
    body: {
      model: MODEL,
      reasoning_effort: REASONING,
      max_completion_tokens: 12_000,
      response_format: {
        type: "json_schema",
        json_schema: { name: "external_vocabulary_enrichment", strict: true, schema: outputSchema },
      },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: JSON.stringify({ headword_groups: groups }) },
      ],
    },
  }));
  fs.writeFileSync(REQUESTS_FILE, `${requests.map((request) => JSON.stringify(request)).join("\n")}\n`);
  for (const file of fs.readdirSync(process.cwd())) {
    if (file.startsWith(REQUEST_PART_PREFIX) && file.endsWith(".jsonl")) fs.unlinkSync(file);
  }
  const requestParts = [];
  let partLines = [];
  let partChars = 0;
  const flushPart = () => {
    if (!partLines.length) return;
    const partNumber = requestParts.length + 1;
    const file = `${REQUEST_PART_PREFIX}${String(partNumber).padStart(3, "0")}.jsonl`;
    fs.writeFileSync(file, `${partLines.join("\n")}\n`);
    requestParts.push({
      part_number: partNumber,
      file,
      request_count: partLines.length,
      input_chars: partChars,
      estimated_input_tokens: Math.ceil(partChars / 3.5),
    });
    partLines = [];
    partChars = 0;
  };
  for (const request of requests) {
    const line = JSON.stringify(request);
    if (partLines.length && partChars + line.length + 1 > MAX_BATCH_INPUT_CHARS) flushPart();
    partLines.push(line);
    partChars += line.length + 1;
  }
  flushPart();
  const manifest = {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    model: MODEL,
    reasoning_effort: REASONING,
    catalog_file: CATALOG_FILE,
    catalog_sha256: crypto.createHash("sha256").update(catalogRaw).digest("hex"),
    cache_file: CACHE_FILE,
    cached_terms: cache.size,
    eligible_terms: units.length,
    total_catalog_terms: byTerm.size,
    total_catalog_entries: catalog.entries.length,
    request_count: requests.length,
    included_entries: selectedGroups.flat(2).reduce((sum, group) => sum + group.records.length, 0),
    max_entries_per_request: MAX_ENTRIES,
    max_user_chars_per_request: MAX_USER_CHARS,
    max_batch_input_chars: MAX_BATCH_INPUT_CHARS,
    request_parts: requestParts,
    requests: selectedGroups.map((groups, index) => ({
      custom_id: `external-vocab-${String(index + 1).padStart(6, "0")}`,
      source_row_indices: groups.flatMap((group) => group.records.map((record) => record.source_row_index)),
    })),
  };
  fs.writeFileSync(MANIFEST_FILE, `${JSON.stringify(manifest)}\n`);
  process.stdout.write(`${JSON.stringify({ requests_file: REQUESTS_FILE, manifest_file: MANIFEST_FILE, ...manifest }, null, 2)}\n`);
}

main();
