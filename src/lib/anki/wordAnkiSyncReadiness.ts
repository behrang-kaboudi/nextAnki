export const REQUIRED_WORD_ANKI_FIELD_NAMES = [
  "anki_link_id",
  "base_form",
  "phonetic_us",
  "phonetic_us_normalized",
  "pos",
  "meaning_fa",
  "concept_explained_fa",
  "sentence_en",
  "sentence_en_meaning_fa",
  "base_form_audio",
  "meaning_fa_audio",
  "concept_explained_fa_audio",
  "sentence_en_audio",
  "sentence_en_meaning_fa_audio",
  "learning_depth",
  "imageability",
  "productive_target",
] as const;

export type WordAnkiReadinessIssue = {
  field: string;
  reason: "missing" | "invalid";
};

type WordAnkiReadinessInput = {
  fields: Partial<Record<string, string>>;
  sourceTexts: {
    audio_source_text: string | null | undefined;
    concept_explained_fa_audio_source_text: string | null | undefined;
    sentence_en_audio_source_text: string | null | undefined;
    sentence_en_meaning_fa_audio_source_text: string | null | undefined;
  };
  scores: {
    learning_depth: number | null | undefined;
    imageability: number | null | undefined;
    productive_target: number | null | undefined;
  };
};

function hasText(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

export function getWordAnkiReadinessIssues(
  input: WordAnkiReadinessInput,
): WordAnkiReadinessIssue[] {
  const issues: WordAnkiReadinessIssue[] = [];
  const addIssue = (field: string, reason: WordAnkiReadinessIssue["reason"]) => {
    if (!issues.some((issue) => issue.field === field)) {
      issues.push({ field, reason });
    }
  };

  for (const field of REQUIRED_WORD_ANKI_FIELD_NAMES) {
    if (!hasText(input.fields[field])) addIssue(field, "missing");
  }

  for (const [field, value] of Object.entries(input.sourceTexts)) {
    if (!hasText(value)) addIssue(field, "missing");
  }

  const { learning_depth, imageability, productive_target } = input.scores;
  if (
    typeof learning_depth !== "number" ||
    !Number.isFinite(learning_depth) ||
    learning_depth < 0 ||
    learning_depth > 1
  ) {
    addIssue("learning_depth", "invalid");
  }
  if (
    typeof imageability !== "number" ||
    !Number.isInteger(imageability) ||
    imageability < 0 ||
    imageability > 100
  ) {
    addIssue("imageability", "invalid");
  }
  if (
    typeof productive_target !== "number" ||
    !Number.isInteger(productive_target) ||
    productive_target < 0 ||
    productive_target > 101
  ) {
    addIssue("productive_target", "invalid");
  }

  return issues;
}
