export type FaEn = {
  fa?: string;
  en?: string;
  ipa_fa_normalized?: string;
};

// Kept name for compatibility with existing callers.
export type SetFor2Result = {
  person?: FaEn;
  job?: FaEn;
  adj?: FaEn;
  persianImage?: FaEn | null;
};
