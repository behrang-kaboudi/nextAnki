import "server-only";

import {
  CUSTOM_EXTRACTION_OUTPUT_FIELDS,
  type CustomExtractionFieldKey,
} from "@/lib/word-extraction/customExtractionFields";
import {
  renderPromptFromFile,
  withGlobalAmericanEnglishPolicy,
} from "@/prompts/_core/promptStore";

export const WORD_SENSE_CORE_FIELDS = [
  "base_form",
  "pos",
  "meaning_fa",
  "other_meanings_fa",
  "concept_explained_fa",
  "sentence_en",
  "sentence_en_meaning_fa",
] as const satisfies readonly CustomExtractionFieldKey[];

export const WORD_SENSE_ENRICHMENT_FIELDS = [
  "phonetic_us",
  "meaning_fa_IPA",
  "imageability",
  "learning_depth",
  "productive_target",
] as const satisfies readonly CustomExtractionFieldKey[];

export const WORD_SENSE_FULL_FIELDS = [
  ...WORD_SENSE_CORE_FIELDS,
  ...WORD_SENSE_ENRICHMENT_FIELDS,
] as const satisfies readonly CustomExtractionFieldKey[];

export const WORD_SENSE_FULL_PACKAGE_MAX_ITEMS = 10;

const fieldByKey = new Map(
  CUSTOM_EXTRACTION_OUTPUT_FIELDS.map((field) => [field.key, field]),
);
const supportedFieldSet = new Set<CustomExtractionFieldKey>(fieldByKey.keys());
const canonicalOrder = new Map<CustomExtractionFieldKey, number>(
  WORD_SENSE_FULL_FIELDS.map((field, index) => [field, index] as const),
);

export type WordExtractionPromptPackage = Awaited<
  ReturnType<typeof buildWordExtractionPromptPackage>
>;

export class PromptPackageInputError extends Error {}

function isSupportedField(value: unknown): value is CustomExtractionFieldKey {
  return typeof value === "string" && supportedFieldSet.has(value as CustomExtractionFieldKey);
}

export function parsePromptPackageFields(value: unknown): CustomExtractionFieldKey[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new PromptPackageInputError("fields must be a non-empty array.");
  }

  const unsupported = value.filter((field) => !isSupportedField(field));
  if (unsupported.length) {
    throw new PromptPackageInputError(`Unsupported field(s): ${unsupported.map(String).join(", ")}.`);
  }

  const fields = value as CustomExtractionFieldKey[];
  if (new Set(fields).size !== fields.length) {
    throw new PromptPackageInputError("fields must not contain duplicates.");
  }

  return [...fields].sort((left, right) => {
    const leftOrder = canonicalOrder.get(left) ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = canonicalOrder.get(right) ?? Number.MAX_SAFE_INTEGER;
    return leftOrder - rightOrder || left.localeCompare(right);
  });
}

function outputSchemaFor(fields: readonly CustomExtractionFieldKey[]) {
  const properties: Record<string, unknown> = {};
  for (const field of fields) {
    switch (field) {
      case "other_meanings_fa":
        properties[field] = { type: "array", items: { type: "string" } };
        break;
      case "imageability":
        properties[field] = { type: "integer", minimum: 1, maximum: 100 };
        break;
      case "learning_depth":
        properties[field] = { type: "number", allowed: ["-100", "0..1"] };
        break;
      case "productive_target":
        properties[field] = { type: "integer", minimum: 1, maximum: 101 };
        break;
      default:
        properties[field] = { type: "string", minLength: 1 };
    }
  }
  return {
    type: "object",
    additionalProperties: false,
    required: [...fields],
    ordered_fields: [...fields],
    properties,
  };
}

export async function buildWordExtractionPromptPackage(
  rawFields: unknown,
) {
  const fields = parsePromptPackageFields(rawFields);
  const prompts = await Promise.all(fields.map(async (field) => {
    const spec = fieldByKey.get(field);
    if (!spec) throw new Error(`No prompt is registered for field: ${field}.`);
    const path = `src/prompts/word-extraction/${spec.promptPath}`;
    const [content, combinedContent] = await Promise.all([
      renderPromptFromFile({ file: `word-extraction/${spec.promptPath}` }),
      renderPromptFromFile({
        file: `word-extraction/${spec.promptPath}`,
        includeGlobalPolicy: false,
      }),
    ]);
    return {
      field,
      label: spec.label,
      path,
      content,
      combinedContent,
    };
  }));

  const packageInstruction = [
    "# WordSense field prompt package",
    "",
    "Generate exactly one JSON object with exactly the requested fields in the stated order.",
    "Apply every field-specific rule to that field's value.",
    "An instruction such as 'output only' inside a field prompt applies to the value, not to the enclosing JSON object.",
    "Do not add explanations, confidence values, comments, Markdown fences, or unrequested keys.",
    "",
    `Requested field order: ${fields.join(", ")}`,
  ].join("\n");
  const combinedPrompt = await withGlobalAmericanEnglishPolicy([
    packageInstruction,
    ...prompts.map((prompt) => [
      `# Field: ${prompt.field}`,
      `Source: ${prompt.path}`,
      "",
      prompt.combinedContent.trim(),
    ].join("\n")),
  ].join("\n\n"));

  return {
    package_version: "word-sense-field-prompts-v1",
    full_package_max_items: WORD_SENSE_FULL_PACKAGE_MAX_ITEMS,
    fields,
    source_files: prompts.map((prompt) => prompt.path),
    prompts: prompts.map((prompt) => ({
      field: prompt.field,
      label: prompt.label,
      path: prompt.path,
      content: prompt.content,
    })),
    output_schema: outputSchemaFor(fields),
    combined_prompt: combinedPrompt,
  };
}
