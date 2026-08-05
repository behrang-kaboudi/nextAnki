import "server-only";

import { prisma } from "@/lib/prisma";

import type { PictureCandidateLookup } from "./forChars";
import type { IpaCandidate } from "./types";
import { imageabilityBaseThreshold } from "./types";

function matchesPrefixPattern(value: string, rawPattern: string): boolean {
  const pattern = rawPattern.endsWith("%")
    ? rawPattern.slice(0, -1)
    : rawPattern;
  const valueChars = Array.from(value);
  const patternChars = Array.from(pattern);
  if (valueChars.length < patternChars.length) return false;

  for (let index = 0; index < patternChars.length; index += 1) {
    const expected = patternChars[index];
    if (expected !== "_" && valueChars[index] !== expected) return false;
  }
  return true;
}

function candidateKey(candidate: IpaCandidate): string {
  return `${candidate.source}|${candidate.target_lang}|${candidate.fa}|${candidate.en}|${candidate.target_ipa}|${candidate.usage}|${candidate.anki_link_id ?? ""}|${candidate.phinglish ?? ""}`;
}

export async function createPreloadedPictureCandidateLookup(): Promise<PictureCandidateLookup> {
  const [pictureRows, wordRows] = await Promise.all([
    prisma.pictureWord.findMany({
      orderBy: [{ fa: "asc" }, { en: "asc" }],
      select: {
        fa: true,
        phinglish: true,
        en: true,
        ipa_fa_normalized: true,
        usage: true,
      },
    }),
    prisma.word.findMany({
      where: {
        imageability: { gt: imageabilityBaseThreshold },
        pos: { in: ["noun", "adjective", "verb"] },
        meaning: { isNot: null },
      },
      orderBy: [{ meaning: { canonical_text: "asc" } }, { base_form: "asc" }],
      select: {
        base_form: true,
        anki_link_id: true,
        phonetic_us_normalized: true,
        pos: true,
        imageability: true,
        meaning: {
          select: {
            canonical_text: true,
            meaning_fa_IPA_normalize: true,
          },
        },
      },
    }),
  ]);

  const pictureCandidates: IpaCandidate[] = pictureRows.map((row) => ({
    fa: row.fa,
    phinglish: row.phinglish,
    en: row.en,
    target_ipa: row.ipa_fa_normalized,
    target_lang: "fa",
    usage: row.usage,
    source: "pictureWord",
  }));
  const wordFaCandidates: IpaCandidate[] = [];
  const wordEnCandidates: IpaCandidate[] = [];

  for (const row of wordRows) {
    const meaning = row.meaning;
    const fa = meaning?.canonical_text ?? "";
    const usage = row.pos?.trim() || "word";
    const faIpa = meaning?.meaning_fa_IPA_normalize?.trim() ?? "";
    const enIpa = row.phonetic_us_normalized?.trim() ?? "";

    if (faIpa) {
      wordFaCandidates.push({
        fa,
        en: row.base_form,
        anki_link_id: row.anki_link_id,
        target_ipa: faIpa,
        target_lang: "fa",
        usage,
        source: "word",
      });
    }
    if (enIpa) {
      wordEnCandidates.push({
        fa,
        en: row.base_form,
        anki_link_id: row.anki_link_id,
        target_ipa: enIpa,
        target_lang: "en",
        usage,
        source: "word",
        imageability: row.imageability ?? undefined,
      });
    }
  }

  const cache = new Map<string, Promise<IpaCandidate[]>>();
  return async (ipaPrefix: string) => {
    const pattern = ipaPrefix.trim();
    if (!pattern) return [];

    const cached = cache.get(pattern);
    if (cached) return cached;

    const result = Promise.resolve().then(() => {
      const candidates = [
        ...pictureCandidates.filter((candidate) =>
          matchesPrefixPattern(candidate.target_ipa, pattern),
        ),
        ...wordFaCandidates.filter((candidate) =>
          matchesPrefixPattern(candidate.target_ipa, pattern),
        ),
        ...wordEnCandidates.filter((candidate) =>
          matchesPrefixPattern(candidate.target_ipa, pattern),
        ),
      ];
      const seen = new Set<string>();
      return candidates.filter((candidate) => {
        const key = candidateKey(candidate);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    });
    cache.set(pattern, result);
    return result;
  };
}
