export type CustomExtractionFieldKey =
  | "base_form"
  | "meaning_fa"
  | "other_meanings_fa"
  | "meaning_fa_IPA"
  | "phonetic_us"
  | "sentence_en"
  | "sentence_en_meaning_fa"
  | "imageability"
  | "learning_depth"
  | "productive_target"
  | "pos"
  | "concept_explained_fa"
  | "other_meanings_en"
  | "category"
  | "hint_to_select";

export type CustomExtractionField = {
  key: CustomExtractionFieldKey;
  label: string;
  source: "Word" | "EnglishWord" | "PersianWord" | "Sentence";
  description: string;
};

export type CustomExtractionOutputField = CustomExtractionField & {
  promptPath: string;
};

export const CUSTOM_EXTRACTION_INPUT_FIELDS: CustomExtractionField[] = [
  { key: "base_form", label: "Base form", source: "EnglishWord", description: "Canonical English word or phrase" },
  { key: "meaning_fa", label: "Persian meaning", source: "PersianWord", description: "Primary Persian meaning" },
  { key: "other_meanings_fa", label: "Other Persian meanings", source: "Word", description: "Alternative Persian meanings linked through otherMeaningIds" },
  { key: "sentence_en", label: "English sentence", source: "Sentence", description: "Primary example sentence" },
  { key: "sentence_en_meaning_fa", label: "Sentence translation", source: "Sentence", description: "Persian translation of the sentence" },
  { key: "phonetic_us", label: "US phonetic", source: "EnglishWord", description: "American IPA pronunciation" },
  { key: "meaning_fa_IPA", label: "Persian IPA", source: "PersianWord", description: "IPA for the Persian meaning" },
  { key: "pos", label: "Part of speech", source: "Word", description: "Grammatical role" },
  { key: "concept_explained_fa", label: "Concept explanation", source: "Word", description: "Persian concept explanation" },
  { key: "imageability", label: "Imageability", source: "Word", description: "Visual quality score" },
  { key: "learning_depth", label: "Learning depth", source: "Word", description: "Learning-depth score" },
  { key: "productive_target", label: "Productive target", source: "Word", description: "Productive-use score" },
  { key: "other_meanings_en", label: "Other English meanings", source: "Word", description: "Additional English meanings" },
  { key: "category", label: "Category", source: "Word", description: "Vocabulary category" },
  { key: "hint_to_select", label: "Selection hint", source: "Word", description: "Hint used to distinguish the sense" },
];

export const CUSTOM_EXTRACTION_OUTPUT_FIELDS: CustomExtractionOutputField[] = [
  { key: "base_form", label: "Base form", source: "EnglishWord", description: "Normalize the English word or phrase", promptPath: "base_form/rulseV1.md" },
  { key: "meaning_fa", label: "Persian meaning", source: "PersianWord", description: "Extract the primary Persian meaning", promptPath: "meaning_fa/rulseV1.md" },
  { key: "sentence_en", label: "English sentence", source: "Sentence", description: "Create or extract the example sentence", promptPath: "sentence_en/rulseV1.md" },
  { key: "sentence_en_meaning_fa", label: "Sentence translation", source: "Sentence", description: "Translate the example sentence", promptPath: "sentence_meaning_fa/rulseV1.md" },
  { key: "phonetic_us", label: "US phonetic", source: "EnglishWord", description: "Generate American IPA", promptPath: "phonetic_us/rulseV1.md" },
  { key: "meaning_fa_IPA", label: "Persian IPA", source: "PersianWord", description: "Generate IPA for the Persian meaning", promptPath: "meaning_fa_IPA/rulseV1.md" },
  { key: "imageability", label: "Imageability", source: "Word", description: "Score how visual the concept is", promptPath: "imageability/rulseV1.md" },
  { key: "learning_depth", label: "Learning depth", source: "Word", description: "Choose the learning depth", promptPath: "learning_depth/rulseV1.md" },
  { key: "productive_target", label: "Productive target", source: "Word", description: "Choose the productive-use target", promptPath: "productive_target/rulseV1.md" },
  { key: "pos", label: "Part of speech", source: "Word", description: "Extract the grammatical role", promptPath: "pos/rulseV1.md" },
  { key: "concept_explained_fa", label: "Concept explanation", source: "Word", description: "Explain the concept in Persian", promptPath: "concept_explained_fa/rulseV1.md" },
];

export const CUSTOM_EXTRACTION_BASE_PROMPT_PATH = "custom-extraction/rulseV1.md";
