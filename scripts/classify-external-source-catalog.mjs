import fs from "node:fs";
import path from "node:path";

const CATALOG_FILE = "a1-source-catalog.json";
const METHOD_ID = "structural_source_triage_v1";
const PERSIAN_LETTER = /[\u0600-\u06FF]/u;
const LATIN_LETTER = /[A-Za-z]/u;
const SENTENCE_START = /^(?:i(?:['’](?:m|ll|ve|d))?|you|he|she|it|we|they|this|that|there|my|your|his|her|our|their)\b/iu;
const QUESTION_START = /^(?:what|how|why|where|when|who|which)\b/iu;
const SENTENCE_VERB = /\b(?:am|is|are|was|were|be|been|being|have|has|had|do|does|did|will|would|can|could|should|may|might|must)\b/iu;
const DEFINITION_PHRASE = /(?:به\s+معنای|به\s+مفهوم|اشاره\s+دارد|عبارتی|اصطلاحی|یعنی|کسی\s+که|چیزی\s+که|زمانی\s+که|برای\s+بیان)/u;
const MULTIPLE_MEANING_SEPARATOR = /(?:\s[/|؛;]\s?|،|\sیا\s)/u;

function sourceIdsForRefs(refs, locationByRef) {
  const ids = new Set();
  for (const ref of refs) {
    if (ref.startsWith("ttw-n")) ids.add("ttwordbank");
    else for (const id of locationByRef.get(ref)?.[1] ?? []) ids.add(id);
  }
  return [...ids];
}

function wordCount(value) {
  return value.trim().split(/\s+/u).filter(Boolean).length;
}

function classifyEntry(entry, locationByRef) {
  const [term, meaningFa, refs] = entry;
  const flags = new Set();
  const invalidFlags = new Set();
  const termWords = wordCount(term);
  const sourceIds = sourceIdsForRefs(refs, locationByRef);
  const hasBamoozSource = sourceIds.some((id) => id.startsWith("ba-"));
  const onlyPersonalSource = sourceIds.length === 1 && sourceIds[0] === "ttwordbank";

  if (!PERSIAN_LETTER.test(meaningFa)) invalidFlags.add("meaning_not_persian");
  if (/\s(?:vs\.?|\/)\s|(?:->|→)/iu.test(term)) invalidFlags.add("multiple_terms_or_comparison");
  if (
    termWords >= 3 &&
    (
      (SENTENCE_START.test(term.trim()) && (SENTENCE_VERB.test(term) || /['’](?:m|ll|ve|d)\b/iu.test(term) || /[.!?]$/u.test(term.trim()))) ||
      (QUESTION_START.test(term.trim()) && /[?]|\.{2,}/u.test(term))
    )
  ) {
    invalidFlags.add("sentence_like_term");
  }
  if (/\.{2,}|_{2,}|\?{2,}/u.test(term)) invalidFlags.add("placeholder_or_incomplete_term");

  if (onlyPersonalSource) flags.add("personal_source_only");
  if (!hasBamoozSource) flags.add("no_curated_web_source");
  if (termWords > 4) flags.add("long_phrase");
  if (/^to\s+/iu.test(term)) flags.add("leading_to_needs_base_form");
  if (onlyPersonalSource && termWords === 1 && /(?:ing|ed)$/iu.test(term)) flags.add("possible_inflected_form");
  if (LATIN_LETTER.test(meaningFa)) flags.add("meaning_contains_latin");
  if (meaningFa.length > 70 || DEFINITION_PHRASE.test(meaningFa)) flags.add("definition_instead_of_short_meaning");
  const meaningWithoutContext = meaningFa.replace(/\([^)]*\)|\[[^\]]*\]/gu, " ");
  if (MULTIPLE_MEANING_SEPARATOR.test(meaningWithoutContext)) flags.add("multiple_meanings_in_one_field");
  if (/^\s*\[[^\]]+\]\s*$/u.test(meaningFa)) flags.add("grammatical_label_only");
  if (/^["“”«].+["“”»]$/u.test(meaningFa.trim())) flags.add("quoted_explanation");

  for (const flag of invalidFlags) flags.add(flag);
  const status = invalidFlags.size
    ? "invalid_or_ambiguous"
    : flags.size
      ? "needs_cleanup"
      : "valid";
  return [status, [...flags]];
}

function main() {
  const catalogPath = path.join(process.cwd(), CATALOG_FILE);
  const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
  const locationByRef = new Map(catalog.locations.map((location) => [location[0], location]));
  const entryQuality = catalog.entries.map((entry) => classifyEntry(entry, locationByRef));
  const counts = { valid: 0, needs_cleanup: 0, invalid_or_ambiguous: 0 };
  const flagCounts = {};

  for (const [status, flags] of entryQuality) {
    counts[status] += 1;
    for (const flag of flags) flagCounts[flag] = (flagCounts[flag] ?? 0) + 1;
  }

  catalog.quality = {
    method_id: METHOD_ID,
    classified_at: new Date().toISOString(),
    scope: "Automatic structural and source-evidence triage; not independent dictionary verification.",
    status_definitions: {
      valid: "Dictionary-shaped pair from a curated B-amooz source with no detected structural issue.",
      needs_cleanup: "Potentially useful pair requiring normalization, splitting, shortening, base-form work, or source review.",
      invalid_or_ambiguous: "Sentence-like, comparison-style, incomplete, non-Persian, or otherwise unsafe to treat as one vocabulary sense."
    },
    counts,
    unresolved_source_items: catalog.unresolved_items.length,
    flag_counts: flagCounts
  };
  catalog.entry_quality_fields = ["status", "flags"];
  catalog.entry_quality = entryQuality;
  catalog.stats.quality = counts;

  const json = `${JSON.stringify(catalog)}\n`;
  if (!process.argv.includes("--dry-run")) fs.writeFileSync(catalogPath, json, "utf8");
  process.stdout.write(`${JSON.stringify({ file: CATALOG_FILE, entries: catalog.entries.length, counts, unresolved_source_items: catalog.unresolved_items.length, flag_counts: flagCounts, bytes: Buffer.byteLength(json) }, null, 2)}\n`);
}

main();
