const ENGLISH_TEXT_SEPARATORS = /[\s\u00A0\u200B-\u200D\u2060\uFEFF]+/gu;
const HYPHEN_LIKE = /[-_\u058A\u05BE\u1400\u1806\u2010-\u2015\u2E17\u2E1A\u2E3A-\u2E3B\u2E40\u301C\u3030\u30A0\uFE31-\uFE32\uFE58\uFE63\uFF0D]+/gu;

/**
 * Canonical storage form for EnglishWord.base_form.
 *
 * It is lowercase ASCII English, with all dash variants converted to one
 * space. Apostrophes inside a word are preserved for contractions and names.
 */
export function normalizeEnglishWordText(value: string): string {
  const ascii = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036F]/gu, "")
    .replace(/[’‘`]/gu, "'")
    .replace(HYPHEN_LIKE, " ")
    .toLocaleLowerCase("en-US")
    .replace(/[^a-z'\s]/gu, " ")
    .replace(ENGLISH_TEXT_SEPARATORS, " ")
    .trim();

  return ascii
    .split(" ")
    .map((part) => part.replace(/^'+|'+$/gu, ""))
    .filter(Boolean)
    .join(" ");
}
