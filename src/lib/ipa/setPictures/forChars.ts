import "server-only";

import { PictureWordUsage } from "@prisma/client";

import { prisma } from "@/lib/prisma";

import {
  addReplaceMentsForEach,
  filterByUsage,
  startsWithSAndNextIsConsonant,
} from "./shared";
import type { IpaCandidate, WordPictureInput } from "./types";
import { imageabilityBaseThreshold } from "./types";

export async function findPictureWordsByIpaPrefix(
  ipaPrefix: string,
): Promise<IpaCandidate[]> {
  const pattern = (ipaPrefix ?? "").trim();
  if (!pattern) return [];

  const likePattern = pattern.endsWith("%") ? pattern : `${pattern}%`;

  const pictureRows = await prisma.$queryRaw<
    Array<{
      fa: string;
      phinglish: string;
      en: string;
      target_ipa: string;
      usage: PictureWordUsage;
    }>
  >`
    SELECT 
      \`usage\`,
      fa,
      phinglish,
      en,
      ipa_fa_normalized AS target_ipa
    FROM PictureWord
    WHERE ipa_fa_normalized LIKE ${likePattern}
    ORDER BY fa ASC, en ASC
  `;

  const wordRows = await prisma.$queryRaw<
    Array<{
      fa: string;
      en: string;
      anki_link_id: string;
      target_ipa: string;
      usage: string | null;
    }>
  >`
    SELECT
      pw.canonical_text AS fa,
      ew.base_form AS en,
      w.anki_link_id,
      pw.meaning_fa_IPA_normalize AS target_ipa,
      w.pos AS \`usage\`,
      w.imageability
    FROM word w
    INNER JOIN english_word ew ON ew.id = w.englishId
    INNER JOIN persian_word pw ON pw.id = w.meaningId
    WHERE pw.meaning_fa_IPA_normalize LIKE ${likePattern}
      AND pw.meaning_fa_IPA_normalize <> ''
      AND w.imageability > ${imageabilityBaseThreshold}
      AND (w.pos = 'noun' OR w.pos = 'adjective' OR w.pos = 'verb')
    ORDER BY pw.canonical_text ASC, ew.base_form ASC
  `;
  const wordRowsEn = await prisma.$queryRaw<
    Array<{
      fa: string;
      en: string;
      anki_link_id: string;
      target_ipa: string;
      usage: string | null;
      imageability: number | null;
    }>
  >`
    SELECT
    
      pw.canonical_text AS fa,
      ew.base_form AS en,
      w.anki_link_id,
      ew.phonetic_us_normalized AS target_ipa,
      w.pos AS \`usage\`,
      w.imageability
    FROM word w
    INNER JOIN english_word ew ON ew.id = w.englishId
    INNER JOIN persian_word pw ON pw.id = w.meaningId
    WHERE ew.phonetic_us_normalized LIKE ${likePattern}
      AND ew.phonetic_us_normalized <> ''
      AND w.imageability > ${imageabilityBaseThreshold}
       AND (w.pos = 'noun' OR w.pos = 'adjective' OR w.pos = 'verb')
    ORDER BY pw.canonical_text ASC, ew.base_form ASC
  `;

  const out: IpaCandidate[] = [];
  const seen = new Set<string>();
  function pushUnique(it: IpaCandidate) {
    const key = `${it.source}|${it.target_lang}|${it.fa}|${it.en}|${it.target_ipa}|${it.usage}|${it.anki_link_id ?? ""}|${it.phinglish ?? ""}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(it);
  }

  for (const row of pictureRows) {
    pushUnique({
      fa: row.fa,
      phinglish: row.phinglish,
      en: row.en,
      target_ipa: row.target_ipa,
      target_lang: "fa",
      usage: row.usage,
      source: "pictureWord",
    });
  }

  for (const row of wordRows) {
    const target = (row.target_ipa ?? "").trim();
    if (!target) continue;
    pushUnique({
      fa: row.fa,
      en: row.en,
      anki_link_id: row.anki_link_id,
      target_ipa: target,
      target_lang: "fa",
      usage: (row.usage ?? "word").trim() || "word",
      source: "word",
    });
  }
  for (const row of wordRowsEn) {
    const target = (row.target_ipa ?? "").trim();
    if (!target) continue;
    pushUnique({
      fa: row.fa,
      en: row.en,
      anki_link_id: row.anki_link_id,
      target_ipa: target,
      usage: (row.usage ?? "word").trim() || "word",
      source: "word",
      target_lang: "en",
      imageability: row.imageability || undefined,
    });
  }

  return out;
}

export type PictureCandidateLookup = (
  ipaPrefix: string,
) => Promise<IpaCandidate[]>;

export function get2CharPatterns(phoneticNormalized: string): string[] {
  const a = phoneticNormalized[0] ?? "";
  const b = phoneticNormalized[1] ?? "";

  const patterns = [
    `${phoneticNormalized}`,

    `_${a}${b}`,
    `${a}_${b}`,
    // `_${a}_${b}`,
  ];
  for (const base of [...patterns]) addReplaceMentsForEach(patterns, base);
  patterns.push(`${a}__${b}`);
  addReplaceMentsForEach(patterns, `${a}__${b}`);
  patterns.push(`${a}___${b}`);
  addReplaceMentsForEach(patterns, `${a}___${b}`);
  // patterns.push(`${a}`);
  return patterns;
}
export function get3CharPatterns(phoneticNormalized: string): string[] {
  const a = phoneticNormalized[0] ?? "";
  const b = phoneticNormalized[1] ?? "";
  const c = phoneticNormalized[2] ?? "";
  const patterns = [
    `${a}${b}${c}`,
    `${a}${b}_${c}`,
    // `${a}_${b}${c}`,
    // `_${a}${b}${c}`,

    // `${a}${b}__${c}`,
    // `${a}_${b}_${c}`,
    // `_${a}${b}_${c}`,

    // `${a}${c}${b}`,
    // `${a}${c}_${b}`,

    // `${a}${b}___${c}`,
  ];
  for (const base of [...patterns]) addReplaceMentsForEach(patterns, base);
  return patterns;
}
export function get4CharPatterns(phoneticNormalized: string): string[] {
  const a = phoneticNormalized[0] ?? "";
  const b = phoneticNormalized[1] ?? "";
  const c = phoneticNormalized[2] ?? "";
  const d = phoneticNormalized[3] ?? "";

  const patterns = [
    // `${phoneticNormalized}`,

    `${a}${b}${c}${d}`,
    `${a}${b}${c}_${d}`,
    // `${a}${b}_${c}${d}`,
    // `${a}_${b}${c}${d}`,
    // `_${a}${b}${c}${d}`,
    // `${a}${b}${d}_${c}`,

    // `${a}${b}${c}__${d}`,
    // `${a}${b}__${c}${d}`,
    // `${a}${b}_${c}_${d}`,
    // `${a}_${b}_${c}${d}`,
    // `_${a}${b}${c}_${d}`,

    // `${a}${b}${d}${c}`,

    // `${a}${d}${b}${c}`,
    // `${a}${d}${b}_${c}`,
    // `${a}${c}${b}${d}`,
    // `${a}${c}_${b}${d}`,
    // `${a}${c}_${b}_${d}`,

    // `${a}${b}${c}___${d}`,
    // `${a}${b}_${c}__${d}`,
    // `${a}_${b}_${c}_${d}`,
  ];
  for (const base of [...patterns]) addReplaceMentsForEach(patterns, base);
  return patterns;
}
export function get5CharPatterns(phoneticNormalized: string): string[] {
  const a = phoneticNormalized[0] ?? "";
  const b = phoneticNormalized[1] ?? "";
  const c = phoneticNormalized[2] ?? "";
  const d = phoneticNormalized[3] ?? "";
  const e = phoneticNormalized[4] ?? "";

  const patterns = [
    `${a}${b}${c}${d}${e}`,
    `${a}${b}${c}${d}_${e}`,
    `${a}${b}${c}_${d}${e}`,
    // `${a}${b}_${c}${d}${e}`,
    // `${a}_${b}${c}${d}${e}`,
    // `_${a}${b}${c}${d}${e}`,

    `${a}${b}${c}${d}__${e}`,
    `${a}${b}${c}_${d}_${e}`,
    `${a}${b}${c}__${d}${e}`,
    // `${a}${b}_${c}_${d}${e}`,
    // `${a}${b}__${c}${d}${e}`,
    // `${a}_${b}${c}_${d}${e}`,
    // `${a}_${b}_${c}${d}${e}`,
    // `${a}_${b}_${c}_${d}${e}`,

    // `${a}${b}${c}${d}___${e}`,
    // `${a}${b}${c}_${d}__${e}`,
    // `${a}${b}${c}__${d}_${e}`,
    // `${a}${b}_${c}_${d}_${e}`,
    // `${a}${b}_${c}__${d}${e}`,
    // `${a}_${b}${c}__${d}${e}`,
    // `${a}_${b}_${c}_${d}${e}`,
    // `${a}_${b}__${c}${d}${e}`,
    // `${a}${b}${c}___${d}${e}`,

    // `${a}_${b}_${c}_${d}_${e}`,

    // `_${a}${b}${c}_${d}_${e}`,
    // `_${a}${b}${c}__${d}${e}`,
    // `_${a}${b}_${c}_${d}${e}`,

    // `${a}${b}${c}${e}${d}`,
    // `${a}${b}${c}${e}_${d}`,
    // `${a}${b}${c}_${e}${d}`,
    // `${a}${b}_${c}${e}${d}`,
    // `${a}${b}${e}${c}${d}`,
    // `${a}${b}${e}${c}_${d}`,
    // `${a}${b}${e}_${c}${d}`,
    // `${a}${b}_${e}${c}${d}`,
  ];

  for (const base of [...patterns]) addReplaceMentsForEach(patterns, base);

  // looser fallbacks (pattern-style), similar spirit to setFor4
  // patterns.push(`${a}${b}${c}${d}`);
  // patterns.push(`${a}${b}${c}${e}`);
  // patterns.push(`${a}${b}${d}${e}`);

  return patterns;
}

function getPatternsForPart(phoneticNormalized: string): string[] {
  const a = phoneticNormalized[0] ?? "";
  const b = phoneticNormalized[1] ?? "";
  const c = phoneticNormalized[2] ?? "";
  const d = phoneticNormalized[3] ?? "";
  const e = phoneticNormalized[4] ?? "";
  const patterns: string[] = [];
  const length = phoneticNormalized.length;
  if (length < 3) {
    return get2CharPatterns(phoneticNormalized);
  }
  if (length === 3) {
    patterns.push(...get3CharPatterns(phoneticNormalized));
    patterns.push(...get3CharPatterns(a + b + c)); // 3-char fallback
    patterns.push(...get3CharPatterns(a + c)); // 2-char fallback
  }
  if (length === 4) {
    patterns.push(...get4CharPatterns(phoneticNormalized));
    patterns.push(...get4CharPatterns(a + b + c + d));
    patterns.push(...get3CharPatterns(a + b + c)); // 3-char fallback
    patterns.push(...get3CharPatterns(a + b + d)); // 3-char fallback
    // patterns.push(...get3CharPatterns(a + c + d)); // 3-char fallback
    // patterns.push(...get3CharPatterns(b + c + d)); // 3-char fallback
  }
  if (length === 5) {
    patterns.push(...get5CharPatterns(phoneticNormalized));
    patterns.push(...get5CharPatterns(a + b + c + e + d));
    patterns.push(...get4CharPatterns(a + b + c + d)); // 4-char fallback
    patterns.push(...get4CharPatterns(a + b + c + e)); // 4-char fallback
    // patterns.push(...get4CharPatterns(a + b + d + e)); // 4-char fallback
    // patterns.push(...get4CharPatterns(a + c + d + e)); // 4-char fallback
    // patterns.push(...get4CharPatterns(b + c + d + e)); // 4-char fallback
  }
  return patterns;
}
// اگر برای پترن بالایی پیدا شود سایرین جستجو نمیشوند
async function findCandidatesByPatterns(
  patterns: string[],
  word: WordPictureInput,
  lookup: PictureCandidateLookup = findPictureWordsByIpaPrefix,
): Promise<IpaCandidate[]> {
  const length = word.phonetic_us_normalized?.replace(" ", "").length || 0;
  for (const pattern of patterns) {
    const matches = await lookup(pattern);
    const filtered1 = matches.filter(
      (m) => m.target_ipa != word.phonetic_us_normalized,
    );
    const filtered2 = filtered1.filter((m) => {
      if (m.target_lang === "fa") return true;
      if ((word.imageability ?? 0) < imageabilityBaseThreshold) return true;
      if (m.target_ipa.length < length) return true;
      return false;
      // return true;
    });
    const filtered3 = filtered2.filter((m) => m.target_ipa.length < 8);
    if (filtered3.length > 0) return filtered3;
  }
  return [];
}
export async function findCandidatesByPart(
  phoneticNormalizedForPart: string,
  word: WordPictureInput,
  lookup: PictureCandidateLookup = findPictureWordsByIpaPrefix,
): Promise<IpaCandidate[]> {
  const patterns = getPatternsForPart(phoneticNormalizedForPart);

  const candidates = await findCandidatesByPatterns(patterns, word, lookup);
  const filtered = filterByUsage(candidates);
  return filtered;
}
export async function findCandidatesByPartWithS(
  phoneticNormalized: string,
  word: WordPictureInput,
  lookup: PictureCandidateLookup = findPictureWordsByIpaPrefix,
): Promise<IpaCandidate[]> {
  let matches = await findCandidatesByPart(phoneticNormalized, word, lookup);
  if (
    matches.length === 0 &&
    startsWithSAndNextIsConsonant(phoneticNormalized)
  ) {
    matches = await findCandidatesByPart(`e${phoneticNormalized}`, word, lookup);
  }
  return matches;
}

export async function for1CharAdj(
  phoneticNormalized: string,
  lookup: PictureCandidateLookup = findPictureWordsByIpaPrefix,
): Promise<IpaCandidate[]> {
  const preferredUsage: PictureWordUsage | null = PictureWordUsage.adj;
  const a = phoneticNormalized[0] ?? "";

  const patterns = [`${a}`];
  for (const pattern of patterns) {
    const matches = await lookup(pattern);
    const filtered = filterByUsage(matches, preferredUsage);
    if (filtered.length > 0) return filtered;
  }

  return [];
}
