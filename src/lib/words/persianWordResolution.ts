export type PersianWordResolutionField = "meaning_fa" | "other_meanings_fa";

export type PersianWordResolutionCandidate = {
  id: number;
  canonical_text: string;
  meaning_fa_IPA: string | null;
};

export type PersianWordResolutionContext = {
  base_form: string;
  pos?: string | null;
  concept_explained_fa?: string | null;
  sentence_en?: string | null;
  sentence_en_meaning_fa?: string | null;
};

export type PersianWordAmbiguity = {
  key: string;
  text: string;
  field: PersianWordResolutionField;
  context: PersianWordResolutionContext;
  candidates: PersianWordResolutionCandidate[];
};

export type PersianWordResolutionSelection = {
  key: string;
  persianWordId: number;
};

export type PersianWordResolutionRequiredResponse = {
  ok: false;
  code: "PERSIAN_WORD_RESOLUTION_REQUIRED";
  error: string;
  ambiguities: PersianWordAmbiguity[];
};
