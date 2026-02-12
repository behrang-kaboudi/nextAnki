export const imageabilityBaseThreshold = 64;
export type IpaCandidate = {
  fa: string;
  en: string;
  target_ipa: string;
  target_lang: "fa" | "en";
  usage: string;
  source: "pictureWord" | "word";
  imageability?: number;
  phinglish?: string;
  anki_link_id?: string;
};

export type WordPictures = {
  person?: IpaCandidate;
  job?: IpaCandidate;
  adj?: IpaCandidate;
  persianImage?: IpaCandidate | null;
};
