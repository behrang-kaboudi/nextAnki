export type WordExtractionPromptSpec = {
  id: string;
  label: string;
  /**
   * Field in `Word` table that this prompt is about.
   * `null` means "base prompt / not a field".
   */
  fieldKey: string | null;
  path: string;
};

export const WORD_EXTRACTION_PROMPTS_PHASE3: WordExtractionPromptSpec[] = [
  {
    id: "base",
    label: "BASE",
    fieldKey: null,
    path: "src/prompts/word-extraction/base/inputOutRulseV1 .md",
  },
  {
    id: "phonetic_us",
    label: "PHONETIC_US",
    fieldKey: "phonetic_us",
    path: "src/prompts/word-extraction/phonetic_us/rulseV1.md",
  },
  {
    id: "imageability",
    label: "IMAGEABILITY",
    fieldKey: "imageability",
    path: "src/prompts/word-extraction/imageability/rulseV1.md",
  },
  {
    id: "learning_depth",
    label: "LEARNING_DEPTH",
    fieldKey: "learning_depth",
    path: "src/prompts/word-extraction/learning_depth/rulseV1.md",
  },
  {
    id: "sentence_en_meaning_fa",
    label: "SENTENCE_EN_MEANING_FA",
    fieldKey: "sentence_en_meaning_fa",
    path: "src/prompts/word-extraction/sentence_meaning_fa/rulseV1.md",
  },
  {
    id: "pos",
    label: "POS",
    fieldKey: "pos",
    path: "src/prompts/word-extraction/pos/rulseV1.md",
  },
  {
    id: "other_meanings_fa",
    label: "OTHER_MEANINGS_FA",
    fieldKey: "other_meanings_fa",
    path: "src/prompts/word-extraction/other_meanings_fa/rulseV1.md",
  },
  {
    id: "concept_explained_fa",
    label: "CONCEPT_EXPLAINED_FA",
    fieldKey: "concept_explained_fa",
    path: "src/prompts/word-extraction/concept_explained_fa/rulseV1.md",
  },
];

