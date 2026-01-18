import "server-only";

import { PictureWord, PictureWordUsage } from "@prisma/client";

import {
  addReplaceMentsForEach,
  filterByUsage,
  findPictureWordsByIpaPrefix,
} from "./shared";
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
  preferredUsage: PictureWordUsage | null = PictureWordUsage.person
): Promise<PictureWord[]> {
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
  preferredUsage: PictureWordUsage | null = PictureWordUsage.person
): Promise<PictureWord[]> {
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
  preferredUsage: PictureWordUsage | null = PictureWordUsage.person
): Promise<PictureWord[]> {
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
  phoneticNormalized: string
): Promise<PictureWord[]> {
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
