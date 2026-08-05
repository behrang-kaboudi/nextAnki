import "server-only";

import type { Word } from "@prisma/client";
import { setFor2 } from "./setFor2";
import { setFor3 } from "./setFor3";
import { setFor4 } from "./setFor4";
import { setFor5 } from "./setFor5";
import { setFor6 } from "./setFor6";
import { setForSpace } from "./setForSpace";
import { setForPersian } from "./setForPersian";
import type { WordPictures, IpaCandidate } from "./types";
import { imageabilityBaseThreshold } from "./types";
import type { PictureCandidateLookup } from "./forChars";

type PickPictureSymbolsOptions = {
  lookup?: PictureCandidateLookup;
  includePersianImage?: boolean;
};
export async function pickPictureSymbolsForWord(
  word: Word,
  options: PickPictureSymbolsOptions = {},
): Promise<WordPictures | null> {
  const normalized = (word.phonetic_us_normalized ?? "").trim();
  let persianImage: IpaCandidate | null = null;
  if (
    options.includePersianImage !== false &&
    (word.imageability ?? 0) < imageabilityBaseThreshold
  ) {
    persianImage = await setForPersian(word);
    // if (!persianImage)
    //   console.log(
    //     `[setForAny.ts:21]`,
    //     "NoooooooooooooooooooooooooooooooooooooooooopersianImagepersianImagepersianImagepersianImagepersianImage",
    //     word.meaning_fa_IPA_normalized,
    //     word.base_form,
    //   );
  }
  // console.log(`[setForAny.ts:30]`, normalized.length, word);
  // if (word.base_form === "chameleon") {
  //   console.log(`[setForAny.ts:30]`, normalized.length);
  // }
  const withPersianImage = (base: WordPictures): WordPictures => {
    if (!persianImage) return base;
    return {
      ...base,
      persianImage,
    };
  };

  if (normalized.length < 3)
    return withPersianImage(await setFor2(word, options.lookup));
  if (normalized.length === 3)
    return withPersianImage(await setFor3(word, options.lookup));
  if (normalized.includes(" "))
    return withPersianImage(await setForSpace(word, options.lookup));

  if (normalized.length === 4)
    return withPersianImage(await setFor4(word, options.lookup));
  if (normalized.length === 5)
    return withPersianImage(await setFor5(word, options.lookup));
  if (normalized.length > 5)
    return withPersianImage(await setFor6(word, options.lookup));

  return null;
}
