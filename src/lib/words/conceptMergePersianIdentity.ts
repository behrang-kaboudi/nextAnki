export type ConceptMergePersianField = "meaning_fa" | "other_meanings_fa";

export function conceptMergePersianResolutionKey(
  wordSenseId: number,
  field: ConceptMergePersianField,
  index = 0,
) {
  return `retained.${wordSenseId}.${field}.${index}`;
}

export function preferredConceptMergePersianWordIds(args: {
  text: string;
  field: ConceptMergePersianField;
  sourcePrimaryId: number | null;
  sourceMeaningIds: readonly number[];
  clusterMeaningIds: readonly number[];
  canonicalTextById: ReadonlyMap<number, string>;
}) {
  const matching = (ids: readonly number[]) => [...new Set(ids)].filter(
    (id) => args.canonicalTextById.get(id)?.trim() === args.text.trim(),
  );
  if (
    args.field === "meaning_fa" &&
    args.sourcePrimaryId &&
    matching([args.sourcePrimaryId]).length === 1
  ) {
    return [args.sourcePrimaryId];
  }
  const sourceMatches = matching(args.sourceMeaningIds);
  if (sourceMatches.length === 1) return sourceMatches;
  return matching(args.clusterMeaningIds);
}
