import "server-only";

import type { PictureWord } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { normalizeIpaForDb } from "@/lib/ipa/normalize";
import {
  FA_KEYWORDS_CONSONANTS_NORMALIZED,
  FA_KEYWORDS_VOWELS_NORMALIZED,
} from "@/lib/ipa/ipaSets";
import type { FaEn } from "./types";

function firstNonSpaceChar(value: string): string | null {
  for (const ch of Array.from(value)) {
    if (ch.trim()) return ch;
  }
  return null;
}

function charCounts(value: string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const ch of Array.from(value)) {
    if (!ch.trim()) continue;
    counts.set(ch, (counts.get(ch) ?? 0) + 1);
  }
  return counts;
}

export function containsAllChars(value: string, required: string): boolean {
  const requiredCounts = charCounts(required);
  if (requiredCounts.size === 0) return true;
  const valueCounts = charCounts(value);
  for (const [ch, needed] of requiredCounts) {
    if ((valueCounts.get(ch) ?? 0) < needed) return false;
  }
  return true;
}

export async function findPictureWordsWithSameFirstIpaChar(
  phonetic: string
): Promise<PictureWord[]> {
  const normalized = normalizeIpaForDb(phonetic ?? "", 2000);
  const firstChar = firstNonSpaceChar(normalized);
  if (!firstChar) return [];

  return prisma.pictureWord.findMany({
    where: { ipa_fa_normalized: { startsWith: firstChar } },
    orderBy: [{ fa: "asc" }, { en: "asc" }],
  });
}

export function filterByUsage<T extends { usage: PictureWord["usage"] }>(
  rows: T[],
  preferredUsage: PictureWord["usage"] | null
): T[] {
  return preferredUsage === null
    ? rows
    : rows.filter((row) => row.usage === preferredUsage);
}

export async function findPictureWordsByIpaPrefix(
  ipaPrefix: string
): Promise<PictureWord[]> {
  const pattern = (ipaPrefix ?? "").trim();
  if (!pattern) return [];

  const likePattern = pattern.endsWith("%") ? pattern : `${pattern}%`;

  return prisma.$queryRaw<PictureWord[]>`
    SELECT *
    FROM PictureWord
    WHERE ipa_fa_normalized LIKE ${likePattern}
    ORDER BY fa ASC, en ASC
  `;
}

export function addReplaceMentsForEach(
  patterns: string[],
  toChange?: string
): void {
  const source = (toChange ?? patterns[0] ?? "").trim();
  if (!source) return;

  const existing = new Set(patterns);
  const nextValues = [
    source.replace("j", "ɪ"),
    source.replace("ɪ", "j"),
    source.replace("ɪ", "e"),
    source.replace("e", "ɪ"),
    source.replace("ʤ", "ʒ"),
    source.replace("ʒ", "ʤ"),
    source.replace("ʤ", "ʧ"),
    source.replace("ʧ", "ʤ"),
    source.replace("o", "ʊ"),
    source.replace("ʊ", "o"),
    source.replace("æ", "ʌ"),
    source.replace("ʌ", "æ"),
  ];

  for (const next of nextValues) {
    if (existing.has(next)) continue;
    existing.add(next);
    patterns.push(next);
  }
}

export function startsWithSAndNextIsConsonant(ipa: string): boolean {
  const chars = Array.from((ipa ?? "").trim());
  if (chars.length < 2) return false;
  if (chars[0] !== "s") return false;
  return FA_KEYWORDS_CONSONANTS_NORMALIZED.has(chars[1] ?? "");
}

export function charsMissingFromBestIpa(
  phoneticNormalized: string,
  best: FaEn | undefined
): string[] {
  const phonetic = (phoneticNormalized ?? "").trim();
  const ipa = (best?.ipa_fa_normalized ?? "").trim();
  if (!phonetic) return [];
  if (!ipa) return Array.from(phonetic);

  const missing: string[] = [];
  const ipaSet = new Set(Array.from(ipa).filter((c) => c.trim()));
  for (const ch of Array.from(phonetic)) {
    if (!ch.trim()) continue;
    if (!ipaSet.has(ch)) missing.push(ch);
  }
  return missing;
}

export function sortCharsConsonantsThenVowels(chars: string[]): string[] {
  const consonants: string[] = [];
  const vowels: string[] = [];
  const other: string[] = [];

  for (const ch of chars ?? []) {
    if (FA_KEYWORDS_CONSONANTS_NORMALIZED.has(ch)) consonants.push(ch);
    else if (FA_KEYWORDS_VOWELS_NORMALIZED.has(ch)) vowels.push(ch);
    else other.push(ch);
  }

  // Stable partition: keep relative order inside each group (especially consonants).
  return [...consonants, ...vowels, ...other];
}
