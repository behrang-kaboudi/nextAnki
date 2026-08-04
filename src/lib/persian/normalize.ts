/** The 33 Persian letters permitted in `PersianWord.normalized_text`. */
export const PERSIAN_ALPHABET = [
  "ا",
  "آ",
  "ب",
  "پ",
  "ت",
  "ث",
  "ج",
  "چ",
  "ح",
  "خ",
  "د",
  "ذ",
  "ر",
  "ز",
  "ژ",
  "س",
  "ش",
  "ص",
  "ض",
  "ط",
  "ظ",
  "ع",
  "غ",
  "ف",
  "ق",
  "ک",
  "گ",
  "ل",
  "م",
  "ن",
  "و",
  "ه",
  "ی",
] as const;

/** Unicode code points for the 33 Persian letters, in alphabet order. */
export const PERSIAN_ALPHABET_CODE_POINTS = [
  "U+0627",
  "U+0622",
  "U+0628",
  "U+067E",
  "U+062A",
  "U+062B",
  "U+062C",
  "U+0686",
  "U+062D",
  "U+062E",
  "U+062F",
  "U+0630",
  "U+0631",
  "U+0632",
  "U+0698",
  "U+0633",
  "U+0634",
  "U+0635",
  "U+0636",
  "U+0637",
  "U+0638",
  "U+0639",
  "U+063A",
  "U+0641",
  "U+0642",
  "U+06A9",
  "U+06AF",
  "U+0644",
  "U+0645",
  "U+0646",
  "U+0648",
  "U+0647",
  "U+06CC",
] as const;

const PERSIAN_ALPHABET_CHARS = PERSIAN_ALPHABET.join("");

/** Use this when a database or UI validation needs exactly the 33 Persian letters. */
export const PERSIAN_ALPHABET_ONLY_PATTERN = new RegExp(`^[${PERSIAN_ALPHABET_CHARS}]+$`, "u");

const NON_PERSIAN_ALPHABET_PATTERN = new RegExp(`[^${PERSIAN_ALPHABET_CHARS}]`, "gu");
const NON_PERSIAN_ALPHABET_OR_SPACE_PATTERN = new RegExp(`[^${PERSIAN_ALPHABET_CHARS} ]`, "gu");
const DIACRITICS_PATTERN = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/gu;
const TEXT_SEPARATORS_PATTERN = /[\s\u00A0\u200B-\u200D\u2060\uFEFF]+/gu;
const MULTIPLE_SPACES_PATTERN = / {2,}/gu;

const CHARACTER_REPLACEMENTS: Readonly<Record<string, string>> = {
  // Arabic forms of kaf and yeh, plus less-common yeh forms.
  "ك": "ک",
  "ي": "ی",
  "ى": "ی",
  "ۍ": "ی",
  "ې": "ی",
  "ے": "ی",
  "ئ": "ی",
  // Alef, waw, and heh variants outside the 33-letter alphabet.
  "أ": "ا",
  "إ": "ا",
  "ٱ": "ا",
  "ؤ": "و",
  "ة": "ه",
  "ۀ": "ه",
};

const CHARACTER_REPLACEMENTS_PATTERN = new RegExp(
  `[${Object.keys(CHARACTER_REPLACEMENTS).join("")}]`,
  "gu"
);

/**
 * Applies Unicode NFC, maps Arabic letter variants to their Persian base form,
 * and removes tashdid, fathah, dammah, kasrah, tatweel, and related diacritics.
 * It deliberately preserves spaces and punctuation.
 */
export function normalizePersianCharacters(value: string): string {
  return value
    .normalize("NFC")
    .replace(CHARACTER_REPLACEMENTS_PATTERN, (char) => CHARACTER_REPLACEMENTS[char] ?? char)
    .replace(/ـ/gu, "")
    .replace(DIACRITICS_PATTERN, "");
}

/**
 * Normalizes ordinary Persian text for storage: joiner and whitespace variants
 * become one normal space. This preserves the existing `meaning_fa` storage
 * behaviour; use `normalizePersianCharacters` for character canonicalization.
 */
export function normalizePersianForStorage(value: string): string {
  return value.replace(TEXT_SEPARATORS_PATTERN, " ").trim();
}

/**
 * Normalizes Persian text for equality checks by removing all space and joiner
 * variants. This preserves the existing `meaning_fa` comparison behaviour.
 */
export function normalizePersianForComparison(value: string): string {
  return value.replace(TEXT_SEPARATORS_PATTERN, "").trim();
}

/**
 * Full normalization: produces the strict form used by
 * `PersianWord.normalized_text`.
 * it has no whitespace, diacritics, punctuation, digits, or non-Persian text.
 */
export function normalizePersianFull(value: string): string {
  return normalizePersianCharacters(value)
    .replace(TEXT_SEPARATORS_PATTERN, "")
    .replace(NON_PERSIAN_ALPHABET_PATTERN, "");
}

/**
 * Half normalization: permits only the 33 Persian letters and ordinary spaces.
 * Every whitespace or half-space variant becomes one ordinary space, and the
 * result never contains consecutive, leading, or trailing spaces.
 */
export function normalizePersianHalf(value: string): string {
  return normalizePersianCharacters(value)
    .replace(TEXT_SEPARATORS_PATTERN, " ")
    .replace(NON_PERSIAN_ALPHABET_OR_SPACE_PATTERN, "")
    .replace(MULTIPLE_SPACES_PATTERN, " ")
    .trim();
}

/** @deprecated Use `normalizePersianFull`. */
export const normalizeToPersianAlphabet = normalizePersianFull;

/** Returns true only for a non-empty string made of the 33 Persian letters. */
export function isPersianAlphabetOnly(value: string): boolean {
  return PERSIAN_ALPHABET_ONLY_PATTERN.test(value);
}
