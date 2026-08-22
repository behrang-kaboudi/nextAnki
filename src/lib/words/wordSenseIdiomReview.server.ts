import "server-only";

import path from "node:path";
import { rm } from "node:fs/promises";

import type { Prisma } from "@prisma/client";

import { getWordSenseConceptAudioAbsolutePath } from "@/lib/audio/wordSenseConceptAudioPaths.server";
import { prisma } from "@/lib/prisma";
import {
  isMultiwordLexicalEntry,
  parseIdiomReviewDecisions,
} from "@/lib/words/idiomReview";
import { selectPromptBatch } from "@/lib/words/promptBatch";
import { deleteWordSenses, updateManyWordSenses } from "@/lib/words/wordSenseRepo";

const sourceSelect = {
  id: true,
  updatedAt: true,
  anki_link_id: true,
  englishId: true,
  meaningId: true,
  otherMeaningIds: true,
  sentenceIds: true,
  pos: true,
  concept_explained_fa: true,
  concept_explained_fa_audio_file_name: true,
  idiomReviewCompleted: true,
  english: { select: { base_form: true } },
  meaning: { select: { canonical_text: true } },
} satisfies Prisma.WordSenseSelect;

type SourceRecord = Prisma.WordSenseGetPayload<{ select: typeof sourceSelect }>;

export type IdiomReviewSourceFingerprint = {
  id: number;
  updatedAt: string;
};

export type IdiomReviewSourceRow = {
  id: number;
  base_form: string;
  meaning_fa: string;
  other_meanings_fa: string[];
  pos: string;
  concept_explained_fa: string;
  sentences: Array<{
    sentence_id: number;
    sentence_en: string;
    sentence_en_meaning_fa: string;
  }>;
};

function positiveIds(value: Prisma.JsonValue | null): number[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item): item is number =>
    typeof item === "number" && Number.isSafeInteger(item) && item > 0,
  ))];
}

function fingerprint(record: SourceRecord): IdiomReviewSourceFingerprint {
  return { id: record.id, updatedAt: record.updatedAt.toISOString() };
}

async function hydrateRows(records: SourceRecord[]): Promise<IdiomReviewSourceRow[]> {
  const meaningIds = [...new Set(records.flatMap((record) => [
    ...(record.meaningId ? [record.meaningId] : []),
    ...positiveIds(record.otherMeaningIds),
  ]))];
  const sentenceIds = [...new Set(records.flatMap((record) => positiveIds(record.sentenceIds)))];
  const [meanings, sentences] = await Promise.all([
    meaningIds.length
      ? prisma.persianWord.findMany({
          where: { id: { in: meaningIds } },
          select: { id: true, canonical_text: true },
        })
      : [],
    sentenceIds.length
      ? prisma.sentence.findMany({
          where: { id: { in: sentenceIds } },
          select: { id: true, sentence_en: true, sentence_en_meaning_fa: true },
        })
      : [],
  ]);
  const meaningById = new Map(meanings.map((meaning) => [meaning.id, meaning.canonical_text]));
  const sentenceById = new Map(sentences.map((sentence) => [sentence.id, sentence]));
  return records.map((record) => ({
    id: record.id,
    base_form: record.english.base_form,
    meaning_fa: record.meaning?.canonical_text ?? "",
    other_meanings_fa: positiveIds(record.otherMeaningIds)
      .filter((id) => id !== record.meaningId)
      .flatMap((id) => meaningById.get(id) ? [meaningById.get(id)!] : []),
    pos: record.pos ?? "",
    concept_explained_fa: record.concept_explained_fa ?? "",
    sentences: positiveIds(record.sentenceIds).flatMap((id) => {
      const sentence = sentenceById.get(id);
      return sentence ? [{
        sentence_id: sentence.id,
        sentence_en: sentence.sentence_en,
        sentence_en_meaning_fa: sentence.sentence_en_meaning_fa ?? "",
      }] : [];
    }),
  }));
}

async function pendingCandidateRefs() {
  const records = await prisma.wordSense.findMany({
    where: { idiomReviewCompleted: false },
    orderBy: { id: "asc" },
    select: { id: true, english: { select: { base_form: true } } },
  });
  return records.filter((record) => isMultiwordLexicalEntry(record.english.base_form));
}

async function currentRecordsForIds(ids: readonly number[]): Promise<SourceRecord[]> {
  const records = await prisma.wordSense.findMany({
    where: { id: { in: [...ids] } },
    select: sourceSelect,
  });
  const byId = new Map(records.map((record) => [record.id, record]));
  return ids.map((id) => {
    const record = byId.get(id);
    if (!record) throw new Error(`WordSense ${id} no longer exists.`);
    if (record.idiomReviewCompleted || !isMultiwordLexicalEntry(record.english.base_form)) {
      throw new Error(`WordSense ${id} is no longer eligible for multi-word review.`);
    }
    return record;
  });
}

export async function getPendingWordSenseIdiomReviewCount() {
  return (await pendingCandidateRefs()).length;
}

export async function prepareWordSenseIdiomReview(batchSize: number) {
  const eligible = await pendingCandidateRefs();
  const selected = selectPromptBatch(eligible, batchSize);
  const records = await currentRecordsForIds(selected.map((record) => record.id));
  return {
    totalEligible: eligible.length,
    sourceRecords: records.map(fingerprint),
    items: await hydrateRows(records),
  };
}

export async function rebuildWordSenseIdiomReview(value: unknown) {
  const decisions = parseIdiomReviewDecisions(value);
  const records = await currentRecordsForIds(decisions.map((decision) => decision.id));
  return {
    sourceRecords: records.map(fingerprint),
    items: await hydrateRows(records),
    decisions,
  };
}

function safeFilename(value: string | null) {
  return value && path.basename(value) === value ? value : null;
}

export async function applyWordSenseIdiomReview(
  sourceRecords: IdiomReviewSourceFingerprint[],
  rawDecisions: unknown,
) {
  const expectedIds = sourceRecords.map((source) => source.id);
  if (!expectedIds.length || new Set(expectedIds).size !== expectedIds.length) {
    throw new Error("Source records must contain unique positive ids.");
  }
  const decisions = parseIdiomReviewDecisions(rawDecisions, expectedIds);
  const result = await prisma.$transaction(async (tx) => {
    const current = await tx.wordSense.findMany({
      where: { id: { in: expectedIds } },
      select: sourceSelect,
    });
    const currentById = new Map(current.map((record) => [record.id, record]));
    for (const source of sourceRecords) {
      const record = currentById.get(source.id);
      if (!record || record.updatedAt.toISOString() !== source.updatedAt) {
        throw new Error(`WordSense ${source.id} changed after preview. Create the data again.`);
      }
      if (record.idiomReviewCompleted || !isMultiwordLexicalEntry(record.english.base_form)) {
        throw new Error(`WordSense ${source.id} is no longer eligible for multi-word review.`);
      }
    }
    const deleteIds = decisions.filter((decision) => decision.delete).map((decision) => decision.id);
    const keepIds = decisions.filter((decision) => !decision.delete).map((decision) => decision.id);
    const deletedRecords = deleteIds.map((id) => currentById.get(id)!);
    if (keepIds.length) {
      await updateManyWordSenses({
        where: { id: { in: keepIds } },
        data: { idiomReviewCompleted: true },
      }, tx);
    }
    if (deleteIds.length) await deleteWordSenses(deleteIds, tx);
    return {
      reviewed: decisions.length,
      kept: keepIds.length,
      deleted: deleteIds.length,
      deletedIds: deleteIds,
      deletedAnkiLinkIds: deletedRecords.map((record) => record.anki_link_id),
      conceptAudioFiles: deletedRecords.flatMap((record) => {
        const filename = safeFilename(record.concept_explained_fa_audio_file_name);
        return filename ? [filename] : [];
      }),
    };
  }, { maxWait: 10_000, timeout: 120_000 });

  let deletedAudioFiles = 0;
  let failedAudioFiles = 0;
  await Promise.all(result.conceptAudioFiles.map(async (filename) => {
    try {
      await rm(getWordSenseConceptAudioAbsolutePath(filename), { force: true });
      deletedAudioFiles += 1;
    } catch {
      failedAudioFiles += 1;
    }
  }));
  return {
    reviewed: result.reviewed,
    kept: result.kept,
    deleted: result.deleted,
    deletedIds: result.deletedIds,
    deletedAnkiLinkIds: result.deletedAnkiLinkIds,
    deletedAudioFiles,
    failedAudioFiles,
  };
}
