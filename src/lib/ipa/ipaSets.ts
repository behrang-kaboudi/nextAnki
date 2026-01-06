export const TIE_BARS = new Set(["͡", "͜"]);
export const STRESS = new Set(["ˈ", "ˌ"]);
export const LENGTH = new Set(["ː", "ˑ"]);

export const BOUNDARY = new Set([
  " ",
  ".",
  "|",
  "/",
  "[",
  "]",
  "(",
  ")",
  "{",
  "}",
  "‖",
  "-",
]);

export const SPACING_MODIFIERS = new Set([
  "ʰ",
  "ʷ",
  "ʲ",
  "ˠ",
  "ˤ",
  "ⁿ",
  "ˡ",
  "˞",
  "ʼ",
  "ˀ",
]);

export const IPA_CHAR_NORMALIZATION: Record<string, string> = {
  ʤ: "dʒ",
  ʧ: "tʃ",
  ɡ: "g",
  ɚ: "ər",
  ɝ: "ɜr",
};

export const KNOWN_AFFRICATES = new Set([
  "tʃ",
  "dʒ",
]);

export const KNOWN_DIPHTHONGS = new Set([
  "eə",
  "ʊə",
  "ɪə",
  "aɪ",
  "aʊ",
  "eɪ",
  "ɔɪ",
  "oʊ",
]);

export const KNOWN_TRIPHTHONGS = new Set(["aɪə", "aʊə", "eɪə", "ɔɪə", "oʊə"]);

export const KNOWN_VOWEL_SEQUENCES_SORTED = Array.from(
  new Set([...KNOWN_TRIPHTHONGS, ...KNOWN_DIPHTHONGS])
).sort((a, b) => Array.from(b).length - Array.from(a).length);

export const VOWELS = new Set([
  "i",
  "y",
  "ɨ",
  "ʉ",
  "ɯ",
  "u",
  "ɪ",
  "ʏ",
  "ʊ",
  "e",
  "ø",
  "ɘ",
  "ɵ",
  "ɤ",
  "o",
  "ə",
  "ɛ",
  "œ",
  "ɜ",
  "ɞ",
  "ʌ",
  "ɔ",
  "æ",
  "a",
  "ɐ",
  "ɑ",
  "ɒ",
  "ɚ",
  "ɝ",
]);

export const isCombiningMark = (ch: string) => /\p{M}/u.test(ch);
export const stressKindOf = (ch: string) =>
  ch === "ˈ" ? "primary" : ch === "ˌ" ? "secondary" : null;
export const boundaryKindOf = (ch: string) => {
  if (ch === " ") return "SPACE";
  if (ch === ".") return "SYLLABLE";
  if (ch === "|") return "PROSODIC";
  if (ch === "-") return "HYPHEN";
  if (ch === "/") return "SLASH";
  if (ch === "‖") return "MAJOR_BREAK";
  if ("[](){}".includes(ch)) return "BRACKET";
  return "BOUNDARY";
};

export function normalizeIPA(input: string) {
  let out = input.normalize("NFC");

  for (const [from, to] of Object.entries(IPA_CHAR_NORMALIZATION)) {
    out = out.replaceAll(from, to);
  }

  out = Array.from(out)
    .filter((ch) => !SPACING_MODIFIERS.has(ch))
    .join("");

  return out;
}

