import "server-only";

import { PictureWord, PictureWordUsage } from "@prisma/client";

import {
  addReplaceMentsForEach,
  filterByUsage,
  findPictureWordsByIpaPrefix,
} from "./shared";

export async function for2Char(
  phoneticNormalized: string,
  preferredUsage: PictureWordUsage | null = PictureWordUsage.person
): Promise<PictureWord[]> {
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

  const patterns = [
    `${phoneticNormalized}`,

    `${a}${b}${c}`,
    `${a}${b}_${c}`,
    `${a}${b}__${c}`,
    `${a}${b}___${c}`,
    `${a}_${b}${c}`,
    `${a}_${b}_${c}`,

    `${a}${b}`,
    `${a}${c}`,
    `${a}_${c}`,
    `_${phoneticNormalized}`,
    `_${a}${b}`,
  ];

  for (const base of [...patterns]) addReplaceMentsForEach(patterns, base);

  for (const pattern of patterns) {
    const matches = await findPictureWordsByIpaPrefix(pattern);
    const filtered = filterByUsage(matches, preferredUsage);
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
