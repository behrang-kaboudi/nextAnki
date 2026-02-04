import "server-only";

import { PictureWordUsage } from "@prisma/client";

import { prisma } from "@/lib/prisma";

import { addReplaceMentsForEach, filterByUsage, IpaCandidate } from "./shared";

export async function findPictureWordsByIpaPrefix(
  ipaPrefix: string,
): Promise<IpaCandidate[]> {
  const pattern = (ipaPrefix ?? "").trim();
  if (!pattern) return [];

  const likePattern = pattern.endsWith("%") ? pattern : `${pattern}%`;

  const pictureRows = await prisma.$queryRaw<
    Array<{
      fa: string;
      en: string;
      target_ipa: string;
      usage: PictureWordUsage;
    }>
  >`
    SELECT 
      \`usage\`,
      fa,
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
      target_ipa: string;
      usage: string | null;
    }>
  >`
    SELECT
      meaning_fa AS fa,
      base_form AS en,
      \`meaning_fa_IPA_normalized\` AS target_ipa,
      pos AS \`usage\`,
      imageability
    FROM Word
    WHERE \`meaning_fa_IPA_normalized\` LIKE ${likePattern}
      AND \`meaning_fa_IPA_normalized\` <> ''
      AND imageability > 64
      AND pos = 'noun'
    ORDER BY meaning_fa ASC, base_form ASC
  `;
  const wordRowsEn = await prisma.$queryRaw<
    Array<{
      fa: string;
      en: string;
      target_ipa: string;
      usage: string | null;
    }>
  >`
    SELECT
      meaning_fa AS fa,
      base_form AS en,
      \`phonetic_us_normalized\` AS target_ipa,
      pos AS \`usage\`,
      imageability
    FROM Word
    WHERE \`phonetic_us_normalized\` LIKE ${likePattern}
      AND \`phonetic_us_normalized\` <> ''
      AND imageability > 64
       AND pos = 'noun'
    ORDER BY meaning_fa ASC, base_form ASC
  `;
  if (ipaPrefix === "tæh") {
    console.log(`[forChars.ts:99]`, wordRows);
  }
  const out: IpaCandidate[] = [];
  const seen = new Set<string>();
  function pushUnique(it: IpaCandidate) {
    const key = `${it.source}|${it.fa}|${it.en}|${it.target_ipa}|${it.usage}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(it);
  }

  for (const row of pictureRows) {
    pushUnique({
      fa: row.fa,
      en: row.en,
      target_ipa: row.target_ipa,
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
      target_ipa: target,
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
      target_ipa: target,
      usage: (row.usage ?? "word").trim() || "word",
      source: "word",
      target_lang: "en",
    });
  }

  return out;
}

function get2CharPatterns(phoneticNormalized: string): string[] {
  const a = phoneticNormalized[0] ?? "";
  const b = phoneticNormalized[1] ?? "";

  const patterns = [
    `${phoneticNormalized}`,
    `${a}_${b}`,
    `_${a}${b}`,
    `_${a}_${b}`,
  ];
  for (const base of [...patterns]) addReplaceMentsForEach(patterns, base);
  patterns.push(`${a}__${b}`);
  addReplaceMentsForEach(patterns, `${a}__${b}`);
  patterns.push(`${a}___${b}`);
  addReplaceMentsForEach(patterns, `${a}___${b}`);
  // patterns.push(`${a}`);
  return patterns;
}
function get3CharPatterns(phoneticNormalized: string): string[] {
  const a = phoneticNormalized[0] ?? "";
  const b = phoneticNormalized[1] ?? "";
  const c = phoneticNormalized[2] ?? "";
  const patterns = [
    `${phoneticNormalized}`,

    `${a}${b}${c}`,
    `${a}${b}_${c}`,
    `${a}${b}__${c}`,
    `${a}${b}___${c}`,
    `${a}_${b}${c}`,
    `${a}_${b}_${c}`,
  ];
  for (const base of [...patterns]) addReplaceMentsForEach(patterns, base);
  return patterns;
}
function get4CharPatterns(phoneticNormalized: string): string[] {
  const a = phoneticNormalized[0] ?? "";
  const b = phoneticNormalized[1] ?? "";
  const c = phoneticNormalized[2] ?? "";
  const d = phoneticNormalized[3] ?? "";

  const patterns = [
    `${phoneticNormalized}`,

    `${a}${b}${c}${d}`,
    `${a}${b}${c}_${d}`,
    `${a}${b}${c}__${d}`,
    `${a}${b}${c}___${d}`,

    `${a}${b}_${c}${d}`,
    `${a}${b}__${c}${d}`,
    `${a}${b}___${c}${d}`,

    `${a}_${b}${c}${d}`,
    `${a}_${b}_${c}${d}`,
  ];
  for (const base of [...patterns]) addReplaceMentsForEach(patterns, base);
  return patterns;
}
export async function for2Char(
  phoneticNormalized: string,
  preferredUsage: PictureWordUsage | null = null,
): Promise<IpaCandidate[]> {
  const patterns = get2CharPatterns(phoneticNormalized);
  for (const pattern of patterns) {
    const matches = await findPictureWordsByIpaPrefix(pattern);
    const filtered = filterByUsage(matches, preferredUsage);
    if (filtered.length > 0) return filtered;
  }

  return [];
}

export async function for3Char(
  phoneticNormalized: string,
  preferredUsage: PictureWordUsage | null = null,
): Promise<IpaCandidate[]> {
  const a = phoneticNormalized[0] ?? "";
  const b = phoneticNormalized[1] ?? "";
  const c = phoneticNormalized[2] ?? "";
  const patterns = get3CharPatterns(phoneticNormalized);
  patterns.push(...get2CharPatterns(`${a}${b}`));
  patterns.push(...get2CharPatterns(`${a}${c}`));
  for (const pattern of patterns) {
    const matches = await findPictureWordsByIpaPrefix(pattern);
    const filtered = filterByUsage(matches, preferredUsage);
    if (filtered.length > 0) return filtered;
  }

  return [];
}

export async function for4Char(
  phoneticNormalized: string,
  preferredUsage: PictureWordUsage | null = null,
): Promise<IpaCandidate[]> {
  const a = phoneticNormalized[0] ?? "";
  const b = phoneticNormalized[1] ?? "";
  const c = phoneticNormalized[2] ?? "";
  const d = phoneticNormalized[3] ?? "";
  const patterns = get4CharPatterns(phoneticNormalized);
  patterns.push(...get3CharPatterns(`${a}${b}${c}`));
  patterns.push(...get3CharPatterns(`${a}${b}${d}`));
  patterns.push(...get3CharPatterns(`${a}${c}${d}`));
  patterns.push(...get2CharPatterns(`${a}${b}`));
  patterns.push(...get2CharPatterns(`${a}${c}`));
  patterns.push(...get2CharPatterns(`${a}${d}`));
  for (const pattern of patterns) {
    const matches = await findPictureWordsByIpaPrefix(pattern);
    const filtered = filterByUsage(matches, preferredUsage);
    // if (phoneticNormalized === "ɪeɪʃen") {
    //   console.log("[setFor6.ts:33]", filtered);
    // }
    if (filtered.length > 0) return filtered;
  }

  return [];
}

export async function for1CharAdj(
  phoneticNormalized: string,
): Promise<IpaCandidate[]> {
  const preferredUsage: PictureWordUsage | null = PictureWordUsage.adj;
  const a = phoneticNormalized[0] ?? "";

  const patterns = [`${a}`];

  for (const pattern of patterns) {
    const matches = await findPictureWordsByIpaPrefix(pattern);
    const filtered = filterByUsage(matches, preferredUsage);
    if (filtered.length > 0) return filtered;
  }

  return [];
}
