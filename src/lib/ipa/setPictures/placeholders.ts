import type { PictureWord } from "@prisma/client";
import { PictureWordType, PictureWordUsage } from "@prisma/client";

export function placeholderJobPictureWord(): PictureWord {
  const now = new Date(0);
  return {
    id: 0,
    fa: "💼",
    ipa_fa: "",
    ipa_fa_normalized: "",
    phinglish: "",
    en: "job",
    type: PictureWordType.noun,
    usage: PictureWordUsage.Job,
    canBePersonal: false,
    ipaVerified: false,
    createdAt: now,
    updatedAt: now,
  };
}

