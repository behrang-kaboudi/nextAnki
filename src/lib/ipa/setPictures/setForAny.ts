import "server-only";

import type { Word } from "@prisma/client";
import type { PictureWord } from "@prisma/client";
import type { SetFor2Result } from "./types";
import { setFor2 } from "./setFor2";
import { setFor3 } from "./setFor3";
import { setFor4 } from "./setFor4";
import { setFor5 } from "./setFor5";
import { setFor6 } from "./setFor6";
import { setForSpace } from "./setForSpace";
import { setForPersian } from "./setForPersian";

export async function pickPictureSymbolsForPhoneticNormalized(
  word: Word,
): Promise<SetFor2Result | null> {
  const normalized = (word.phonetic_us_normalized ?? "").trim();
  let persianImage: PictureWord | null;
  if (word.imageability! < 62) {
    persianImage = await setForPersian(word.meaning_fa_IPA_normalized ?? "");
    if (!persianImage)
      console.log(
        `[setForAny.ts:21]`,
        "Noooooooooooooooooooooooooooooooooooooooooo",
      );
  }

  const withPersianImage = (base: SetFor2Result): SetFor2Result => {
    if (!persianImage) return base;
    return {
      ...base,
      persianImage,
    };
  };

  if (normalized.length < 3) return withPersianImage(await setFor2(normalized));
  if (normalized.length === 3)
    return withPersianImage(await setFor3(normalized));
  if (normalized.includes(" "))
    return withPersianImage(await setForSpace(normalized));

  if (normalized.length === 4)
    return withPersianImage(await setFor4(normalized));
  if (normalized.length === 5)
    return withPersianImage(await setFor5(normalized));
  if (normalized.length > 5) return withPersianImage(await setFor6(normalized));

  return null;
}
