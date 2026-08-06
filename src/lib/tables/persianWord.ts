import { Prisma } from "@prisma/client";

import { normalizePersianFull, normalizePersianHalf } from "../persian/normalize.ts";
import { prisma } from "../prisma.ts";

const persianWordSelect = {
  id: true,
  canonical_text: true,
  normalized_text: true,
  not_normalized_texts: true,
} satisfies Prisma.PersianWordSelect;

export type PersianWordItem = Prisma.PersianWordGetPayload<{ select: typeof persianWordSelect }>;

export type FindPersianWordResult = {
  normalizedText: string;
  found: boolean;
  item: PersianWordItem | null;
};

export type AddPersianWordResult = {
  action: "created" | "variant_added" | "unchanged";
  item: PersianWordItem;
  canonicalText: string;
  normalizedText: string;
};

export class PersianWordNormalizationConflictError extends Error {}

function stringVariants(value: Prisma.JsonValue): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

async function findPersianWordByNormalizedText(
  normalizedText: string,
  db: Prisma.TransactionClient | typeof prisma
): Promise<PersianWordItem | null> {
  const matches = await db.persianWord.findMany({
    where: { normalized_text: normalizedText },
    orderBy: { id: "asc" },
    take: 2,
    select: persianWordSelect,
  });

  if (matches.length > 1) {
    throw new PersianWordNormalizationConflictError(
      `More than one PersianWord has normalized_text "${normalizedText}".`
    );
  }

  return matches[0] ?? null;
}

/**
 * Looks up a PersianWord by its full-normalized text. The supplied value may
 * have spaces, half-spaces, diacritics, or Arabic character variants.
 */
export async function findPersianWord(rawText: string): Promise<FindPersianWordResult> {
  const normalizedText = normalizePersianFull(rawText);
  if (!normalizedText) return { normalizedText, found: false, item: null };

  const item = await findPersianWordByNormalizedText(normalizedText, prisma);
  return { normalizedText, found: item !== null, item };
}

/**
 * Adds raw user text to PersianWord without losing its original spelling.
 * `normalized_text` identifies the word, while alternate raw spellings are
 * retained once in `not_normalized_texts`.
 */
export async function addPersianWord(
  rawText: string,
  options: { meaningFaIpa?: string | null; meaningFaIpaNormalized?: string | null } = {}
): Promise<AddPersianWordResult> {
  return prisma.$transaction((tx) =>
    addPersianWordWithClient(rawText, options, tx),
  );
}

export async function addPersianWordWithClient(
  rawText: string,
  options: { meaningFaIpa?: string | null; meaningFaIpaNormalized?: string | null },
  db: Prisma.TransactionClient,
): Promise<AddPersianWordResult> {
  const canonicalText = normalizePersianHalf(rawText);
  const normalizedText = normalizePersianFull(rawText);
  if (!canonicalText || !normalizedText) throw new Error("The word must contain at least one Persian letter.");

  const existing = await findPersianWordByNormalizedText(normalizedText, db);

  if (!existing) {
    const item = await db.persianWord.create({
        data: {
          canonical_text: canonicalText,
          normalized_text: normalizedText,
          not_normalized_texts: rawText === canonicalText ? [] : [rawText],
          meaning_fa_IPA: options.meaningFaIpa?.trim() || null,
          meaning_fa_IPA_normalize: options.meaningFaIpaNormalized?.trim() || null,
        },
        select: persianWordSelect,
      });
    return { action: "created", item, canonicalText, normalizedText };
  }

  if (rawText === existing.canonical_text || stringVariants(existing.not_normalized_texts).includes(rawText)) {
    return { action: "unchanged", item: existing, canonicalText, normalizedText };
  }

  const item = await db.persianWord.update({
    where: { id: existing.id },
    data: { not_normalized_texts: [...stringVariants(existing.not_normalized_texts), rawText] },
    select: persianWordSelect,
  });
  return { action: "variant_added", item, canonicalText, normalizedText };
}
