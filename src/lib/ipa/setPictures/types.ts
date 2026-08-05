import type { Prisma } from "@prisma/client";

export type WordPictureInput = {
  phonetic_us_normalized: string | null;
  imageability: number | null;
  meaningId?: number | null;
  otherMeaningIds?: Prisma.JsonValue | null;
};

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
