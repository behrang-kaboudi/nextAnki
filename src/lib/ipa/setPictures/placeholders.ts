import type { IpaCandidate } from "./types";

export function placeholderJobPictureWord(): IpaCandidate {
  return {
    fa: "noFa",
    en: "noEn",
    target_ipa: "__________",
    target_lang: "fa",
    usage: "job",
    source: "pictureWord",
  };
}
