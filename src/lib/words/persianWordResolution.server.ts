import "server-only";

import { normalizePersianFull } from "@/lib/persian/normalize";
import { prisma } from "@/lib/prisma";
import type {
  PersianWordAmbiguity,
  PersianWordResolutionContext,
  PersianWordResolutionField,
  PersianWordResolutionSelection,
} from "@/lib/words/persianWordResolution";

type ResolutionOccurrence = {
  key: string;
  text: string;
  field: PersianWordResolutionField;
  context: PersianWordResolutionContext;
  preferredIds?: number[];
};

type PersianWordResolutionReadClient = Pick<typeof prisma, "persianWord">;

export function parsePersianWordResolutionSelections(value: unknown) {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Error("persian_word_resolutions must be an array.");

  const seen = new Set<string>();
  return value.map((entry, index): PersianWordResolutionSelection => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new Error(`persian_word_resolutions[${index}] must be an object.`);
    }
    const record = entry as Record<string, unknown>;
    const key = typeof record.key === "string" ? record.key : "";
    const persianWordId = record.persianWordId;
    if (!key || typeof persianWordId !== "number" || !Number.isSafeInteger(persianWordId) || persianWordId <= 0) {
      throw new Error(`persian_word_resolutions[${index}] is invalid.`);
    }
    if (seen.has(key)) throw new Error(`Duplicate PersianWord resolution key: ${key}`);
    seen.add(key);
    return { key, persianWordId };
  });
}

export async function resolvePersianWordOccurrences(
  occurrences: ResolutionOccurrence[],
  selections: PersianWordResolutionSelection[],
  client: PersianWordResolutionReadClient = prisma,
) {
  const normalizedByKey = new Map(occurrences.map((occurrence) => [occurrence.key, normalizePersianFull(occurrence.text)]));
  const normalizedTexts = [...new Set(normalizedByKey.values())].filter(Boolean);
  const candidates = normalizedTexts.length
    ? await client.persianWord.findMany({
        where: { normalized_text: { in: normalizedTexts } },
        orderBy: { id: "asc" },
        select: { id: true, canonical_text: true, normalized_text: true, meaning_fa_IPA: true },
      })
    : [];
  const candidatesByText = new Map<string, typeof candidates>();
  for (const candidate of candidates) {
    const group = candidatesByText.get(candidate.normalized_text) ?? [];
    group.push(candidate);
    candidatesByText.set(candidate.normalized_text, group);
  }

  const selectedByKey = new Map(selections.map((selection) => [selection.key, selection.persianWordId]));
  const occurrenceKeys = new Set(occurrences.map((occurrence) => occurrence.key));
  const unknownSelection = selections.find((selection) => !occurrenceKeys.has(selection.key));
  if (unknownSelection) throw new Error(`Unknown PersianWord resolution key: ${unknownSelection.key}`);

  const resolvedIds = new Map<string, number | null>();
  const ambiguities: PersianWordAmbiguity[] = [];

  for (const occurrence of occurrences) {
    const matches = candidatesByText.get(normalizedByKey.get(occurrence.key) ?? "") ?? [];
    const preferred = matches.filter((candidate) => occurrence.preferredIds?.includes(candidate.id));
    if (preferred.length === 1) {
      resolvedIds.set(occurrence.key, preferred[0].id);
      continue;
    }
    if (matches.length <= 1) {
      resolvedIds.set(occurrence.key, matches[0]?.id ?? null);
      continue;
    }

    const selectedId = selectedByKey.get(occurrence.key);
    if (selectedId !== undefined) {
      if (!matches.some((candidate) => candidate.id === selectedId)) {
        throw new Error(`Selected PersianWord ${selectedId} does not match ${occurrence.text}.`);
      }
      resolvedIds.set(occurrence.key, selectedId);
      continue;
    }

    ambiguities.push({
      key: occurrence.key,
      text: occurrence.text,
      field: occurrence.field,
      context: occurrence.context,
      candidates: matches.map(({ id, canonical_text, meaning_fa_IPA }) => ({ id, canonical_text, meaning_fa_IPA })),
    });
  }

  return { resolvedIds, ambiguities };
}
