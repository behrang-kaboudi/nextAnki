import "server-only";

import type { Word } from "@prisma/client";
import type { SetFor2Result } from "./types";
import { setFor2 } from "./setFor2";
import { setFor3 } from "./setFor3";
import { setFor4 } from "./setFor4";
import { setFor5 } from "./setFor5";
import { setFor6 } from "./setFor6";
import { setForSpace } from "./setForSpace";
import { setForPersian } from "./setForPersian";
import { IpaCandidate } from "./shared";

export async function pickPictureSymbolsForPhoneticNormalized(
  word: Word,
): Promise<SetFor2Result | null> {
  const normalized = (word.phonetic_us_normalized ?? "").trim();
  let persianImage: IpaCandidate | null;
  if (word.imageability! < 62) {
    persianImage = await setForPersian(word);
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

  if (normalized.length < 3) return withPersianImage(await setFor2(word));
  if (normalized.length === 3) return withPersianImage(await setFor3(word));
  if (normalized.includes(" "))
    return withPersianImage(await setForSpace(normalized));

  if (normalized.length === 4) return withPersianImage(await setFor4(word));
  if (normalized.length === 5) return withPersianImage(await setFor5(word));
  if (normalized.length > 5) return withPersianImage(await setFor6(word));

  return null;
}
