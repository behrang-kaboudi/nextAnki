import "server-only";

import { prisma } from "@/lib/prisma";

/**
 * `selectKey2` (server-only)
 *
 * Steps:
 * 1) Read all distinct 2-character values from `Word.phonetic_us_normalized`.
 * 2) For each 2-char key, collect a small sample of matching `Word` rows (for display).
 * 3) Fetch all `PictureWord` rows whose `ipa_fa_normalized` starts with any of those keys.
 * 4) Group results by the 2-char key and return them to the UI.
 *
 * Implementation note:
 * - Uses raw SQL via `prisma.$queryRawUnsafe` so it works even if Prisma Client is stale during dev.
 */

function isTwoChars(value: string) {
  return Array.from(value).length === 2;
}

async function get2CharPrefixesFromWords(maxPrefixes: number) {
  const lim = Math.max(1, Math.min(5000, Math.trunc(maxPrefixes)));
  const rows = (await prisma.$queryRawUnsafe(
    `
      SELECT DISTINCT phonetic_us_normalized AS prefix2
      FROM Word
      WHERE phonetic_us_normalized IS NOT NULL
        AND CHAR_LENGTH(phonetic_us_normalized) = 2
      LIMIT ?
    `,
    lim
  )) as Array<{ prefix2: string }>;

  return rows.map((r) => String(r.prefix2 ?? "").trim()).filter((x) => isTwoChars(x));
}

export async function findMatchesForAll2CharWords(
  opt?: Partial<{
    maxPrefixes: number;
    maxWordsPerPrefix: number;
    maxMatchesPerPrefix: number;
  }>
) {
  const maxPrefixes = Math.max(
    1,
    Math.min(5000, Math.trunc(opt?.maxPrefixes ?? 2000))
  );
  const maxWordsPerPrefix = Math.max(
    1,
    Math.min(50, Math.trunc(opt?.maxWordsPerPrefix ?? 10))
  );
  const maxMatchesPerPrefix = Math.max(
    1,
    Math.min(200, Math.trunc(opt?.maxMatchesPerPrefix ?? 50))
  );

  const prefixes = await get2CharPrefixesFromWords(maxPrefixes);

  const wordsByPrefix: Record<
    string,
    Array<{
      base_form: string;
      phonetic_us: string | null;
      phonetic_us_normalized: string;
    }>
  > = {};
  const matchesByPrefix: Record<
    string,
    Array<{
      id: number;
      fa: string;
      en: string;
      ipa_fa: string;
      ipa_fa_normalized: string;
      type: string;
    }>
  > = {};

  for (const p of prefixes) {
    wordsByPrefix[p] = [];
    matchesByPrefix[p] = [];
  }

  if (!prefixes.length) return { prefixes: [], wordsByPrefix, matchesByPrefix };

  const wordRows = (await prisma.$queryRawUnsafe(
    `
      SELECT base_form, phonetic_us, phonetic_us_normalized
      FROM Word
      WHERE phonetic_us_normalized IS NOT NULL
        AND CHAR_LENGTH(phonetic_us_normalized) = 2
      ORDER BY id ASC
    `
  )) as Array<{
    base_form: string;
    phonetic_us: string | null;
    phonetic_us_normalized: string;
  }>;

  for (const w of wordRows) {
    const p = String(w.phonetic_us_normalized ?? "").trim();
    const arr = wordsByPrefix[p];
    if (!arr) continue;
    if (arr.length >= maxWordsPerPrefix) continue;
    arr.push({
      base_form: w.base_form,
      phonetic_us: w.phonetic_us,
      phonetic_us_normalized: w.phonetic_us_normalized,
    });
  }

  const likeParts = prefixes.map(() => "ipa_fa_normalized LIKE ?").join(" OR ");
  const likeParams = prefixes.map((p) => `${p}%`);
  const pictureRows = (await prisma.$queryRawUnsafe(
    `
      SELECT id, fa, en, ipa_fa, ipa_fa_normalized, type
      FROM PictureWord
      WHERE (${likeParts})
      ORDER BY id ASC
    `,
    ...likeParams
  )) as Array<{
    id: number;
    fa: string;
    en: string;
    ipa_fa: string;
    ipa_fa_normalized: string;
    type: string;
  }>;

  for (const r of pictureRows) {
    const p = Array.from(String(r.ipa_fa_normalized ?? ""))
      .slice(0, 2)
      .join("");
    const arr = matchesByPrefix[p];
    if (!arr) continue;
    if (arr.length >= maxMatchesPerPrefix) continue;
    arr.push(r);
  }

  return { prefixes, wordsByPrefix, matchesByPrefix };
}
