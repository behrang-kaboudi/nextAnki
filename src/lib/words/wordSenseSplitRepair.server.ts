import "server-only";

import { randomUUID } from "node:crypto";

import { MeaningReviewStatus, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { touchWordSensesLinkedToSentenceId, updateWordSense } from "@/lib/words/wordSenseRepo";
import { wordSentenceIds } from "@/lib/words/sentenceIds";

type ExistingSentenceRef = {
  existingId: number;
  sentence_en?: string;
  sentence_en_meaning_fa?: string;
};

type NewSentenceRef = {
  sentence_en: string;
  sentence_en_meaning_fa: string;
};

type SentenceRef = ExistingSentenceRef | NewSentenceRef;

type ProposedSense = {
  meaningId: number;
  otherMeaningIds: number[];
  pos: string;
  concept_explained_fa: string;
  sentences: SentenceRef[];
  reuseWordSenseId?: number;
};

type RepairRecord = {
  id: number;
  expectedUpdatedAt: string;
  action: "repair";
  retainedOtherMeaningIds: number[];
  removedInvalidAlternateMeaningIds: number[];
  removedInvalidSentenceIds: number[];
  primary: {
    pos: string;
    concept_explained_fa: string;
    sentences: SentenceRef[];
  };
  newSenses: ProposedSense[];
};

type InvalidPrimaryRecord = {
  id: number;
  expectedUpdatedAt: string;
  action: "invalid_primary_skip";
};

export type WordSenseSplitRepairRecord = RepairRecord | InvalidPrimaryRecord;

export type WordSenseSplitRepairRequest = {
  batchId: string;
  records: WordSenseSplitRepairRecord[];
};

function positiveInt(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && Boolean(value.trim());
}

function positiveIds(value: Prisma.JsonValue | null | undefined) {
  return Array.isArray(value)
    ? [...new Set(value.filter((item): item is number => positiveInt(item)))]
    : [];
}

function sameArray<T>(left: readonly T[], right: readonly T[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function parseSentenceRef(value: unknown): SentenceRef | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const item = value as Record<string, unknown>;
  if (positiveInt(item.existingId)) {
    if (
      Object.keys(item).some((key) => !["existingId", "sentence_en", "sentence_en_meaning_fa"].includes(key)) ||
      (item.sentence_en !== undefined && !nonEmptyString(item.sentence_en)) ||
      (item.sentence_en_meaning_fa !== undefined && !nonEmptyString(item.sentence_en_meaning_fa))
    ) return null;
    return {
      existingId: item.existingId,
      ...(nonEmptyString(item.sentence_en) ? { sentence_en: item.sentence_en.trim() } : {}),
      ...(nonEmptyString(item.sentence_en_meaning_fa)
        ? { sentence_en_meaning_fa: item.sentence_en_meaning_fa.trim() }
        : {}),
    };
  }
  if (
    Object.keys(item).length !== 2 ||
    !nonEmptyString(item.sentence_en) ||
    !nonEmptyString(item.sentence_en_meaning_fa)
  ) return null;
  return {
    sentence_en: item.sentence_en.trim(),
    sentence_en_meaning_fa: item.sentence_en_meaning_fa.trim(),
  };
}

function parseSense(value: unknown): ProposedSense | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const item = value as Record<string, unknown>;
  if (
    Object.keys(item).some((key) => ![
      "meaningId", "otherMeaningIds", "pos", "concept_explained_fa", "sentences", "reuseWordSenseId",
    ].includes(key)) ||
    !positiveInt(item.meaningId) ||
    !Array.isArray(item.otherMeaningIds) ||
    item.otherMeaningIds.some((id) => !positiveInt(id)) ||
    new Set(item.otherMeaningIds).size !== item.otherMeaningIds.length ||
    item.otherMeaningIds.includes(item.meaningId) ||
    !nonEmptyString(item.pos) ||
    !nonEmptyString(item.concept_explained_fa) ||
    !Array.isArray(item.sentences) ||
    (!item.sentences.length && !positiveInt(item.reuseWordSenseId)) ||
    (item.reuseWordSenseId !== undefined && !positiveInt(item.reuseWordSenseId))
  ) return null;
  const sentences = item.sentences.map(parseSentenceRef);
  if (sentences.some((sentence) => sentence === null)) return null;
  return {
    meaningId: item.meaningId,
    otherMeaningIds: item.otherMeaningIds as number[],
    pos: item.pos.trim(),
    concept_explained_fa: item.concept_explained_fa.trim(),
    sentences: sentences as SentenceRef[],
    ...(positiveInt(item.reuseWordSenseId) ? { reuseWordSenseId: item.reuseWordSenseId } : {}),
  };
}

function parseRecord(value: unknown): WordSenseSplitRepairRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const item = value as Record<string, unknown>;
  if (!positiveInt(item.id) || !nonEmptyString(item.expectedUpdatedAt)) return null;
  const parsedDate = new Date(item.expectedUpdatedAt);
  if (Number.isNaN(parsedDate.valueOf()) || parsedDate.toISOString() !== item.expectedUpdatedAt) return null;
  if (item.action === "invalid_primary_skip") {
    if (Object.keys(item).length !== 3) return null;
    return { id: item.id, expectedUpdatedAt: item.expectedUpdatedAt, action: item.action };
  }
  if (
    item.action !== "repair" ||
    Object.keys(item).some((key) => ![
      "id", "expectedUpdatedAt", "action", "retainedOtherMeaningIds",
      "removedInvalidAlternateMeaningIds", "removedInvalidSentenceIds", "primary", "newSenses",
    ].includes(key)) ||
    !Array.isArray(item.retainedOtherMeaningIds) ||
    item.retainedOtherMeaningIds.some((id) => !positiveInt(id)) ||
    new Set(item.retainedOtherMeaningIds).size !== item.retainedOtherMeaningIds.length ||
    !Array.isArray(item.removedInvalidAlternateMeaningIds) ||
    item.removedInvalidAlternateMeaningIds.some((id) => !positiveInt(id)) ||
    new Set(item.removedInvalidAlternateMeaningIds).size !== item.removedInvalidAlternateMeaningIds.length ||
    (item.removedInvalidSentenceIds !== undefined && !Array.isArray(item.removedInvalidSentenceIds)) ||
    (Array.isArray(item.removedInvalidSentenceIds) && item.removedInvalidSentenceIds.some((id) => !positiveInt(id))) ||
    (Array.isArray(item.removedInvalidSentenceIds) && new Set(item.removedInvalidSentenceIds).size !== item.removedInvalidSentenceIds.length) ||
    !item.primary || typeof item.primary !== "object" || Array.isArray(item.primary) ||
    !Array.isArray(item.newSenses)
  ) return null;
  const primary = item.primary as Record<string, unknown>;
  if (
    Object.keys(primary).some((key) => !["pos", "concept_explained_fa", "sentences"].includes(key)) ||
    !nonEmptyString(primary.pos) ||
    !nonEmptyString(primary.concept_explained_fa) ||
    !Array.isArray(primary.sentences) ||
    !primary.sentences.length
  ) return null;
  const primarySentences = primary.sentences.map(parseSentenceRef);
  const newSenses = item.newSenses.map(parseSense);
  if (primarySentences.some((sentence) => sentence === null) || newSenses.some((sense) => sense === null)) return null;
  const newMeaningIds = (newSenses as ProposedSense[]).flatMap((sense) => [sense.meaningId, ...sense.otherMeaningIds]);
  if (new Set(newMeaningIds).size !== newMeaningIds.length) return null;
  return {
    id: item.id,
    expectedUpdatedAt: item.expectedUpdatedAt,
    action: "repair",
    retainedOtherMeaningIds: item.retainedOtherMeaningIds as number[],
    removedInvalidAlternateMeaningIds: item.removedInvalidAlternateMeaningIds as number[],
    removedInvalidSentenceIds: (item.removedInvalidSentenceIds as number[] | undefined) ?? [],
    primary: {
      pos: primary.pos.trim(),
      concept_explained_fa: primary.concept_explained_fa.trim(),
      sentences: primarySentences as SentenceRef[],
    },
    newSenses: newSenses as ProposedSense[],
  };
}

export function parseWordSenseSplitRepairRequest(value: unknown): WordSenseSplitRepairRequest | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const item = value as Record<string, unknown>;
  if (
    Object.keys(item).length !== 2 ||
    !nonEmptyString(item.batchId) ||
    !/^repair-batch-\d{4}$/u.test(item.batchId) ||
    !Array.isArray(item.records) ||
    !item.records.length
  ) return null;
  const records = item.records.map(parseRecord);
  if (records.some((record) => record === null)) return null;
  const parsed = records as WordSenseSplitRepairRecord[];
  if (new Set(parsed.map((record) => record.id)).size !== parsed.length) return null;
  return { batchId: item.batchId, records: parsed };
}

async function resolveSentenceRefs(
  refs: SentenceRef[],
  sourceSentenceIds: Set<number>,
  tx: Prisma.TransactionClient,
) {
  const ids: number[] = [];
  let changed = false;
  for (const ref of refs) {
    if ("existingId" in ref) {
      if (!sourceSentenceIds.has(ref.existingId)) {
        throw new Error(`Sentence ${ref.existingId} is not linked to the source WordSense.`);
      }
      if (ref.sentence_en || ref.sentence_en_meaning_fa) {
        const sentence = await tx.sentence.findUnique({
          where: { id: ref.existingId },
          select: { sentence_en: true, sentence_en_meaning_fa: true },
        });
        if (!sentence) throw new Error(`Sentence ${ref.existingId} no longer exists.`);
        const nextEnglish = ref.sentence_en ?? sentence.sentence_en;
        const nextPersian = ref.sentence_en_meaning_fa ?? sentence.sentence_en_meaning_fa;
        if (
          sentence.sentence_en !== nextEnglish ||
          (sentence.sentence_en_meaning_fa?.trim() || null) !== (nextPersian?.trim() || null)
        ) {
          const conflictingSentence = ref.sentence_en
            ? await tx.sentence.findFirst({
                where: { sentence_en: ref.sentence_en, id: { not: ref.existingId } },
                select: { id: true },
              })
            : null;
          if (conflictingSentence) {
            throw new Error(`Sentence text already exists as Sentence ${conflictingSentence.id}.`);
          }
          await tx.sentence.update({
            where: { id: ref.existingId },
            data: { sentence_en: nextEnglish, sentence_en_meaning_fa: nextPersian },
          });
          await touchWordSensesLinkedToSentenceId(ref.existingId, { resetMeaningReviewStatus: true }, tx);
          changed = true;
        }
      }
      ids.push(ref.existingId);
      continue;
    }
    const existing = await tx.sentence.findUnique({
      where: { sentence_en: ref.sentence_en },
      select: { id: true, sentence_en_meaning_fa: true },
    });
    if (existing) {
      const currentTranslation = existing.sentence_en_meaning_fa?.trim() || null;
      if (currentTranslation && currentTranslation !== ref.sentence_en_meaning_fa) {
        throw new Error(`Sentence ${existing.id} already exists with a different Persian translation.`);
      }
      if (!currentTranslation) {
        await tx.sentence.update({
          where: { id: existing.id },
          data: { sentence_en_meaning_fa: ref.sentence_en_meaning_fa },
        });
        await touchWordSensesLinkedToSentenceId(existing.id, { resetMeaningReviewStatus: true }, tx);
        changed = true;
      }
      ids.push(existing.id);
      continue;
    }
    ids.push((await tx.sentence.create({
      data: {
        sentence_en: ref.sentence_en,
        sentence_en_meaning_fa: ref.sentence_en_meaning_fa,
      },
      select: { id: true },
    })).id);
    changed = true;
  }
  return { ids: [...new Set(ids)], changed };
}

export async function applyWordSenseSplitRepairBatch(body: WordSenseSplitRepairRequest) {
  const result = await prisma.$transaction(async (tx) => {
    const sourceIds = body.records.map((record) => record.id);
    const sources = await tx.wordSense.findMany({
      where: { id: { in: sourceIds } },
      select: {
        id: true,
        anki_link_id: true,
        englishId: true,
        meaningId: true,
        otherMeaningIds: true,
        sentenceIds: true,
        pos: true,
        concept_explained_fa: true,
        updatedAt: true,
      },
    });
    if (sources.length !== sourceIds.length) throw new Error("One or more source WordSenses no longer exist.");
    const sourceById = new Map(sources.map((source) => [source.id, source]));
    const outcomes: Array<Record<string, unknown>> = [];

    for (const decision of body.records) {
      const source = sourceById.get(decision.id)!;
      if (source.updatedAt.toISOString() !== decision.expectedUpdatedAt) {
        throw new Error(`WordSense ${decision.id} changed after batch preparation.`);
      }
      if (decision.action === "invalid_primary_skip") {
        outcomes.push({ id: decision.id, status: "invalid_primary_skipped", changed: false });
        continue;
      }
      if (!source.meaningId) throw new Error(`WordSense ${decision.id} has no primary meaning.`);
      const currentOtherIds = positiveIds(source.otherMeaningIds);
      const classifiedIds = [
        ...decision.retainedOtherMeaningIds,
        ...decision.removedInvalidAlternateMeaningIds,
        ...decision.newSenses.flatMap((sense) => [sense.meaningId, ...sense.otherMeaningIds]),
      ];
      if (
        new Set(classifiedIds).size !== classifiedIds.length ||
        !sameArray([...classifiedIds].sort((a, b) => a - b), [...currentOtherIds].sort((a, b) => a - b))
      ) throw new Error(`WordSense ${decision.id} does not classify every alternate meaning exactly once.`);
      if (classifiedIds.includes(source.meaningId)) {
        throw new Error(`WordSense ${decision.id} classifies its primary meaning as an alternate meaning.`);
      }
      const sourceSentenceIds = wordSentenceIds(source.sentenceIds);
      const sourceSentenceSet = new Set(sourceSentenceIds);
      const assignedExistingIds = [
        ...decision.primary.sentences,
        ...decision.newSenses.flatMap((sense) => sense.sentences),
      ].flatMap((ref) => "existingId" in ref ? [ref.existingId] : []);
      const classifiedExistingIds = [...assignedExistingIds, ...decision.removedInvalidSentenceIds];
      if (
        new Set(classifiedExistingIds).size !== classifiedExistingIds.length ||
        !sameArray([...classifiedExistingIds].sort((a, b) => a - b), [...sourceSentenceIds].sort((a, b) => a - b))
      ) throw new Error(`WordSense ${decision.id} does not assign each existing sentence exactly once.`);

      const primarySentenceResult = await resolveSentenceRefs(decision.primary.sentences, sourceSentenceSet, tx);
      const primarySentenceIds = primarySentenceResult.ids;
      let sentenceContentChanged = primarySentenceResult.changed;
      const currentPos = source.pos?.trim() || "";
      const currentConcept = source.concept_explained_fa?.trim() || "";
      const sourceChanged =
        !sameArray(decision.retainedOtherMeaningIds, currentOtherIds) ||
        !sameArray(primarySentenceIds, sourceSentenceIds) ||
        decision.primary.pos !== currentPos ||
        decision.primary.concept_explained_fa !== currentConcept;
      if (sourceChanged) {
        await updateWordSense({
          where: { id: source.id },
          data: {
            otherMeaningIds: decision.retainedOtherMeaningIds,
            sentenceIds: primarySentenceIds,
            pos: decision.primary.pos,
            concept_explained_fa: decision.primary.concept_explained_fa,
            meaningReviewStatus: MeaningReviewStatus.PENDING,
          },
          select: { id: true },
        }, tx);
      }

      const createdWordSenseIds: number[] = [];
      const reusedWordSenseIds: number[] = [];
      for (const sense of decision.newSenses) {
        const sentenceResult = await resolveSentenceRefs(sense.sentences, sourceSentenceSet, tx);
        const sentenceIds = sentenceResult.ids;
        sentenceContentChanged ||= sentenceResult.changed;
        const siblingCandidates = await tx.wordSense.findMany({
          where: {
            englishId: source.englishId,
            id: { not: source.id },
          },
          select: {
            id: true,
            meaningId: true,
            otherMeaningIds: true,
            sentenceIds: true,
            pos: true,
            concept_explained_fa: true,
          },
          orderBy: { id: "asc" },
        });
        const proposedMeaningIds = new Set([sense.meaningId, ...sense.otherMeaningIds]);
        const matchingSiblings = siblingCandidates.filter((candidate) =>
          (candidate.meaningId !== null && proposedMeaningIds.has(candidate.meaningId)) ||
          positiveIds(candidate.otherMeaningIds).some((id) => proposedMeaningIds.has(id))
        );
        const reusableSibling = sense.reuseWordSenseId
          ? siblingCandidates.find((candidate) => candidate.id === sense.reuseWordSenseId)
          : matchingSiblings[0];
        if (matchingSiblings.length > 1 && !sense.reuseWordSenseId) {
          throw new Error(`Meaning group for WordSense ${decision.id} matches multiple sibling senses; explicit reuse is required.`);
        }
        if (reusableSibling && sense.reuseWordSenseId !== reusableSibling.id) {
          throw new Error(
            `WordSense ${decision.id} meaning ${sense.meaningId} already exists as WordSense ${reusableSibling.id}; explicit reuse is required.`,
          );
        }
        if (!reusableSibling && sense.reuseWordSenseId) {
          throw new Error(`Requested reuse WordSense ${sense.reuseWordSenseId} is not a matching sibling sense.`);
        }
        if (reusableSibling) {
          const mergedOtherMeaningIds = [...new Set([
            ...positiveIds(reusableSibling.otherMeaningIds),
            sense.meaningId,
            ...sense.otherMeaningIds,
          ].filter((id) => id !== reusableSibling.meaningId))];
          const mergedSentenceIds = [...new Set([
            ...wordSentenceIds(reusableSibling.sentenceIds),
            ...sentenceIds,
          ])];
          await updateWordSense({
            where: { id: reusableSibling.id },
            data: {
              otherMeaningIds: mergedOtherMeaningIds,
              sentenceIds: mergedSentenceIds,
              pos: sense.pos,
              concept_explained_fa: sense.concept_explained_fa,
              meaningReviewStatus: MeaningReviewStatus.PENDING,
            },
            select: { id: true },
          }, tx);
          reusedWordSenseIds.push(reusableSibling.id);
          continue;
        }
        const created = await tx.wordSense.create({
          data: {
            anki_link_id: `split_${body.batchId}_${source.id}_${sense.meaningId}_${randomUUID()}`,
            englishId: source.englishId,
            meaningId: sense.meaningId,
            otherMeaningIds: sense.otherMeaningIds,
            sentenceIds,
            pos: sense.pos,
            concept_explained_fa: sense.concept_explained_fa,
            meaningReviewStatus: MeaningReviewStatus.PENDING,
            conceptMergeReviewed: false,
            inflectionMergeReviewed: false,
          },
          select: { id: true },
        });
        createdWordSenseIds.push(created.id);
      }
      outcomes.push({
        id: decision.id,
        status: sourceChanged || sentenceContentChanged || createdWordSenseIds.length || reusedWordSenseIds.length ? "repaired" : "already_current",
        changed: Boolean(sourceChanged || sentenceContentChanged || createdWordSenseIds.length || reusedWordSenseIds.length),
        sourceUpdated: sourceChanged,
        sentenceContentChanged,
        createdWordSenseIds,
        reusedWordSenseIds,
        removedInvalidAlternateMeaningIds: decision.removedInvalidAlternateMeaningIds,
        removedInvalidSentenceIds: decision.removedInvalidSentenceIds,
      });
    }
    return outcomes;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 10_000, timeout: 120_000 });

  return {
    ok: true as const,
    atomic: true as const,
    batchId: body.batchId,
    sourceCount: body.records.length,
    changedCount: result.filter((item) => item.changed).length,
    skippedInvalidPrimaryCount: result.filter((item) => item.status === "invalid_primary_skipped").length,
    results: result,
  };
}
