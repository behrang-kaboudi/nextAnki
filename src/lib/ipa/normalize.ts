import "server-only";

import { ipaToTokenObjects } from "./ipaTokenizer";

function convertIpa2to1ForOneSound(ipa: string) {
  switch (ipa) {
    case "dʒ":
      return "ʤ";
    case "t͡ʃ":
    case "tʃ":
      return "ʧ";
    case "eə":
      return "e";
    case "oʊ":
    case "ʊə":
      return "o";
    default:
      return ipa;
  }
}

export const normalVolIPAs = new Set(["e", "æ", "ʌ", "ɪ", "ʊ", "o"]);

function normalizeDifferentIpaTo1(ipa: string) {
  switch (ipa) {
    case "ɛ":
    case "ɜ":
    case "ə":
      return "e";
    case "ʌ":
    case "ɑ":
    case "a":
    case "ɒ":
      return "ʌ";
    case "ɪ":
    case "i":
      return "ɪ";
    case "u":
      return "ʊ";
    case "ɔ":
      return "o";
    case "y":
      return "j";
    case "w":
      return "v";
    case "θ":
      return "s";
    case "ð":
      return "z";
    case "g":
      return "ɡ";
    case "ŋ":
      return "n";
    case "ɹ":
    case "ɾ":
      return "r";
    case "ħ":
      return "h";
    case "q":
    case "ɢ":
      return "ɣ";
    default:
      return ipa;
  }
}

export function getIpaSegments(ipaString: string, length: number) {
  /*RTL: ‫*
   *RTL
   * Tokenizes an IPA string and returns up to `length` normalized segment strings.
   *
   * What it does:
   * - Splits the input into IPA `SEGMENT` tokens via `ipaToTokenObjects`.
   * - For each segment, converts some multi-char sounds (e.g. `tʃ` → `ʧ`) via `convertIpa2to1ForOneSound`.
   * - Normalizes individual symbols to a canonical set (e.g. `ə/ɛ/ɜ` → `e`) via `normalizeDifferentIpaTo1`.
   * - Drops any segment that normalizes to something starting with `ʔ`.
   * - Returns at most the first `length` normalized segments.
   *
   * Notes / examples (illustrative):
   * - Input with spaces: `"tʃ eə"` → `["ʧ", "e"]`
   * - Input with special IPA diacritics/ligatures: `"t͡ʃoʊ"` → `["ʧo"]`
   * - Input with non-segment separators (e.g. spaces/punctuation) does not create segments by itself; only `SEGMENT` tokens contribute.
   * - If `length` is smaller than the number of segments, output is truncated: `getIpaSegments("tʃ eə oʊ", 2)` → `["ʧ", "e"]`‬
   */
  const tokens = ipaToTokenObjects(ipaString);
  const segments: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i]!;
    if (tok.type === "SEGMENT") {
      const part = tok.baseSymbols.join("");
      const converted = convertIpa2to1ForOneSound(part);
      let norm = "";
      for (let c = 0; c < converted.length; c++) {
        norm += normalizeDifferentIpaTo1(converted[c] ?? "");
      }
      if (norm.startsWith("ʔ")) continue;
      segments.push(norm);
    }
  }
  return segments.slice(0, length);
}

function getIpaSegmentsWithSpaces(ipaString: string, length: number) {
  const tokens = ipaToTokenObjects(ipaString, {
    keepBoundaries: true,
  });
  const parts: string[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i]!;
    if (tok.type === "BOUNDARY" && tok.kind === "SPACE") {
      parts.push(" ");
      continue;
    }
    if (tok.type === "SEGMENT") {
      const part = tok.baseSymbols.join("");
      const converted = convertIpa2to1ForOneSound(part);
      let norm = "";
      for (let c = 0; c < converted.length; c++) {
        norm += normalizeDifferentIpaTo1(converted[c] ?? "");
      }
      if (norm.startsWith("ʔ")) continue;
      parts.push(norm);
    }
  }

  return parts.slice(0, length);
}

function segmentsWithSpacesToDedupedString(parts: string[]) {
  const s = parts.join("");
  const chars = Array.from(s);
  let out = "";
  let prev = "";
  for (const ch of chars) {
    if (ch === prev) continue;
    out += ch;
    prev = ch;
  }
  return out;
}

export function normalizeIpaForDb(ipa: string, maxTokens = 2000) {
  const tokens = getIpaSegmentsWithSpaces(ipa ?? "", maxTokens);
  return segmentsWithSpacesToDedupedString(tokens);
}
