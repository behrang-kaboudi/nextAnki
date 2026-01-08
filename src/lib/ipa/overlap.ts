import type { PictureWord } from "@prisma/client";

function stripNonIpaLetters(value: string) {
  return value.replace(/[_ـ\s/]+/g, "");
}

function lcsLength(a: string, b: string) {
  const aChars = Array.from(a);
  const bChars = Array.from(b);
  const dp: number[] = new Array(bChars.length + 1).fill(0);

  for (let i = 0; i < aChars.length; i++) {
    let prev = 0;
    for (let j = 0; j < bChars.length; j++) {
      const tmp = dp[j + 1] ?? 0;
      if (aChars[i] === bChars[j]) dp[j + 1] = prev + 1;
      else dp[j + 1] = Math.max(dp[j + 1] ?? 0, dp[j] ?? 0);
      prev = tmp;
    }
  }
  return dp[bChars.length] ?? 0;
}

export function overlapScoreByCommonLetters(
  wordPhoneticUsNormalized: string,
  pictureWordIpaFaNormalized: string
) {
  const left = stripNonIpaLetters(wordPhoneticUsNormalized ?? "");
  const right = stripNonIpaLetters(pictureWordIpaFaNormalized ?? "");
  if (!left || !right) return 0;
  return lcsLength(left, right);
}

export function sortPictureWordsByOverlap(
  wordPhoneticUsNormalized: string,
  matches: PictureWord[]
) {
  return [...matches].sort((a, b) => {
    const aScore = overlapScoreByCommonLetters(
      wordPhoneticUsNormalized,
      a.ipa_fa_normalized
    );
    const bScore = overlapScoreByCommonLetters(
      wordPhoneticUsNormalized,
      b.ipa_fa_normalized
    );

    if (aScore !== bScore) return bScore - aScore;
    const aLen = a.ipa_fa_normalized.length;
    const bLen = b.ipa_fa_normalized.length;
    if (aLen !== bLen) return aLen - bLen;
    return a.id - b.id;
  });
}

