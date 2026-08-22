import { NextResponse } from "next/server";
import { MeaningReviewStatus, type Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { addPersianWordWithClient } from "@/lib/tables/persianWord";
import {
  loadMeaningReviewPromptRecords,
  type MeaningReviewPromptRecord,
} from "@/lib/words/meaningReviewWorkflow.server";
import { wordSentenceIds } from "@/lib/words/sentenceIds";
import {
  meaningReviewAtomicFailure,
  meaningReviewRequestKey,
  summarizeMeaningReviewOutcomes,
  type MeaningReviewOutcome,
} from "@/lib/words/meaningReviewFinalization";
import {
  finalizeMeaningReviewConflictReport,
  findMeaningReviewNormalizationConflicts,
  prepareMeaningReviewConflictReport,
  type MeaningReviewConflictReport,
} from "@/lib/words/meaningReviewConflictReport.server";
import { touchWordSensesLinkedToSentenceId, updateWordSense } from "@/lib/words/wordSenseRepo";

export const runtime = "nodejs";

type SentenceResult = {
  sentence_id: number | null;
  sentence_en?: string;
  sentence_en_meaning_fa?: string;
};

type ReviewResult = {
  id: number;
  mode: "review";
  invalid_primary_meaning?: true;
  meaning_fa?: string;
  other_meanings_fa?: string[];
  pos?: string;
  concept_explained_fa?: string;
  sentences?: SentenceResult[];
  invalid_sentence_ids?: number[];
};

const resultKeys = new Set([
  "id", "mode", "meaning_fa", "other_meanings_fa", "pos",
  "concept_explained_fa", "sentences", "invalid_sentence_ids",
  "invalid_primary_meaning",
]);

function positiveInt(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && Boolean(value.trim());
}

function sameArray<T>(left: readonly T[], right: readonly T[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function parseSentence(value: unknown): SentenceResult | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const item = value as Record<string, unknown>;
  if (
    Object.keys(item).some((key) => !["sentence_id", "sentence_en", "sentence_en_meaning_fa"].includes(key)) ||
    !(item.sentence_id === null || positiveInt(item.sentence_id)) ||
    ("sentence_en" in item && !nonEmptyString(item.sentence_en)) ||
    ("sentence_en_meaning_fa" in item && !nonEmptyString(item.sentence_en_meaning_fa)) ||
    (item.sentence_id === null && !nonEmptyString(item.sentence_en))
  ) return null;
  return {
    sentence_id: item.sentence_id as number | null,
    ...(nonEmptyString(item.sentence_en) ? { sentence_en: item.sentence_en.trim() } : {}),
    ...(nonEmptyString(item.sentence_en_meaning_fa)
      ? { sentence_en_meaning_fa: item.sentence_en_meaning_fa.trim() }
      : {}),
  };
}

function parseResult(value: unknown): ReviewResult | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const item = value as Record<string, unknown>;
  if (
    !positiveInt(item.id) ||
    item.mode !== "review" ||
    Object.keys(item).some((key) => !resultKeys.has(key)) ||
    ("meaning_fa" in item && !nonEmptyString(item.meaning_fa)) ||
    ("other_meanings_fa" in item && (
      !Array.isArray(item.other_meanings_fa) ||
      item.other_meanings_fa.some((meaning) => !nonEmptyString(meaning))
    )) ||
    ("pos" in item && !nonEmptyString(item.pos)) ||
    ("concept_explained_fa" in item && !nonEmptyString(item.concept_explained_fa)) ||
    ("invalid_primary_meaning" in item && item.invalid_primary_meaning !== true) ||
    ("sentences" in item && !Array.isArray(item.sentences)) ||
    ("invalid_sentence_ids" in item && (
      !Array.isArray(item.invalid_sentence_ids) ||
      item.invalid_sentence_ids.some((id) => !positiveInt(id)) ||
      new Set(item.invalid_sentence_ids).size !== item.invalid_sentence_ids.length
    ))
  ) return null;
  const sentences = Array.isArray(item.sentences) ? item.sentences.map(parseSentence) : undefined;
  if (sentences?.some((sentence) => sentence === null)) return null;
  return {
    id: item.id,
    mode: "review",
    ...(item.invalid_primary_meaning === true ? { invalid_primary_meaning: true as const } : {}),
    ...(nonEmptyString(item.meaning_fa) ? { meaning_fa: item.meaning_fa.trim() } : {}),
    ...(Array.isArray(item.other_meanings_fa)
      ? { other_meanings_fa: [...new Set(item.other_meanings_fa.map((meaning) => (meaning as string).trim()))] }
      : {}),
    ...(nonEmptyString(item.pos) ? { pos: item.pos.trim() } : {}),
    ...(nonEmptyString(item.concept_explained_fa)
      ? { concept_explained_fa: item.concept_explained_fa.trim() }
      : {}),
    ...(sentences ? { sentences: sentences as SentenceResult[] } : {}),
    ...(Array.isArray(item.invalid_sentence_ids)
      ? { invalid_sentence_ids: item.invalid_sentence_ids as number[] }
      : {}),
  };
}

function parse(value: unknown): {
  ids: number[];
  results: ReviewResult[];
  requestKey: string;
  clearInvalidPrimary: boolean;
} | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const body = value as Record<string, unknown>;
  const keys = Object.keys(body);
  if (
    (keys.length !== 3 && keys.length !== 4) ||
    keys.some((key) => !["ids", "results", "requestKey", "invalidPrimaryAction"].includes(key)) ||
    ("invalidPrimaryAction" in body && body.invalidPrimaryAction !== "clear_primary") ||
    !Array.isArray(body.ids) || !body.ids.length ||
    body.ids.some((id) => !positiveInt(id)) || new Set(body.ids).size !== body.ids.length ||
    !Array.isArray(body.results) || typeof body.requestKey !== "string" || !body.requestKey
  ) return null;
  const ids = body.ids as number[];
  if (meaningReviewRequestKey(ids, body.results as ReviewResult[]) !== body.requestKey) return null;
  const results = body.results.map(parseResult);
  if (
    results.some((result) => result === null) ||
    new Set(results.map((result) => result!.id)).size !== results.length ||
    results.some((result) => !ids.includes(result!.id))
  ) return null;
  return {
    ids,
    results: results as ReviewResult[],
    requestKey: body.requestKey,
    clearInvalidPrimary: body.invalidPrimaryAction === "clear_primary",
  };
}

function validateResultForRecord(record: MeaningReviewPromptRecord, result: ReviewResult | undefined) {
  if (record.review_status !== MeaningReviewStatus.PENDING) {
    throw new Error(`WordSense ${record.id} is no longer pending AI review.`);
  }
  if (!record.meaning_fa) {
    throw new Error(`WordSense ${record.id} has no primary meaning and is not eligible for this review.`);
  }
  if (result?.invalid_primary_meaning) {
    const keys = Object.keys(result).sort();
    const expected = ["id", "invalid_primary_meaning", "mode"];
    if (keys.length !== expected.length || keys.some((key, index) => key !== expected[index])) {
      throw new Error(`Invalid-primary-meaning result for WordSense ${record.id} may contain only id, mode, and invalid_primary_meaning.`);
    }
    return;
  }
  const missing = new Set(record.missing_fields);
  if (missing.has("other_meanings_fa") && !result?.other_meanings_fa) {
    throw new Error(`WordSense ${record.id} requires other_meanings_fa, including [] when none exist.`);
  }
  if (missing.has("pos") && !result?.pos) throw new Error(`WordSense ${record.id} requires pos.`);
  if (missing.has("concept_explained_fa") && !result?.concept_explained_fa) {
    throw new Error(`WordSense ${record.id} requires concept_explained_fa.`);
  }
  const invalidIds = new Set(result?.invalid_sentence_ids ?? []);
  const sentenceResults = result?.sentences ?? [];
  const newSentences = sentenceResults.filter((sentence) => sentence.sentence_id === null);
  if (newSentences.length > 1) {
    throw new Error(`WordSense ${record.id} may create at most one replacement sentence per review.`);
  }
  if (newSentences.length && !missing.has("sentence_en") && !invalidIds.size) {
    throw new Error(`WordSense ${record.id} may create a new sentence only when no sentence exists or an existing sentence is marked invalid.`);
  }
  if (invalidIds.size && newSentences.length !== 1) {
    throw new Error(`WordSense ${record.id} must provide exactly one replacement sentence when invalid_sentence_ids is not empty.`);
  }
  if (invalidIds.size && !newSentences[0]?.sentence_en_meaning_fa) {
    throw new Error(`Replacement sentence for WordSense ${record.id} requires sentence_en_meaning_fa.`);
  }
  if (missing.has("sentence_en") && !sentenceResults.some((sentence) =>
    sentence.sentence_id === null && sentence.sentence_en && sentence.sentence_en_meaning_fa
  )) throw new Error(`WordSense ${record.id} requires one new sentence with its Persian translation.`);
  if (missing.has("sentence_en_meaning_fa")) {
    for (const sentence of record.sentences) {
      if (
        !sentence.sentence_en_meaning_fa && !invalidIds.has(sentence.id) &&
        !sentenceResults.some((candidate) => candidate.sentence_id === sentence.id && candidate.sentence_en_meaning_fa)
      ) throw new Error(`WordSense ${record.id} requires a translation for Sentence ${sentence.id}.`);
    }
  }
}

export async function POST(request: Request) {
  const body = parse(await request.json().catch(() => null));
  if (!body) {
    return NextResponse.json(
      {
        ok: false,
        atomic: true,
        rolledBack: true,
        error: "The request must contain unique positive ids, structurally valid results, and the matching request key.",
        failed: [{ id: null, reason: "Request validation failed." }],
      },
      { status: 400 },
    );
  }
  const records = await loadMeaningReviewPromptRecords({ ids: body.ids });
  if (records.length !== body.ids.length) {
    const foundIds = new Set(records.map((record) => record.id));
    const missingIds = body.ids.filter((id) => !foundIds.has(id));
    return NextResponse.json({
      ok: false,
      atomic: true,
      rolledBack: true,
      requestKey: body.requestKey,
      failedId: missingIds[0],
      error: `WordSense id(s) no longer exist: ${missingIds.join(", ")}.`,
      failed: missingIds.map((id) => ({ id, reason: "WordSense no longer exists." })),
    }, { status: 400 });
  }
  const recordsById = new Map(records.map((record) => [record.id, record]));
  const resultsById = new Map(body.results.map((result) => [result.id, result]));
  let activeId: number | undefined;
  let conflictReport: { filePath: string; report: MeaningReviewConflictReport } | null = null;
  try {
    for (const id of body.ids) {
      activeId = id;
      validateResultForRecord(recordsById.get(id)!, resultsById.get(id));
    }

    const conflicts = await findMeaningReviewNormalizationConflicts({
      records,
      results: body.results,
    });
    const conflictIds = new Set(conflicts.map((item) => item.wordSenseId));
    if (conflicts.length) {
      conflictReport = await prepareMeaningReviewConflictReport(body.requestKey, conflicts);
    }

    const outcomes: MeaningReviewOutcome[] = [];
    await prisma.$transaction(async (tx) => {
      for (const id of body.ids) {
        activeId = id;
        if (conflictIds.has(id)) {
          await updateWordSense({
            where: { id },
            data: { meaningReviewStatus: MeaningReviewStatus.NEEDS_ACTION_NORMALIZATION_CONFLICT },
            select: { id: true },
          }, tx);
          outcomes.push({
            id,
            status: "attention_required",
            contentChanged: false,
            reviewStatusChanged: true,
            attentionRequired: true,
          });
          continue;
        }
        const record = recordsById.get(id)!;
        const result = resultsById.get(id);
        if (result?.invalid_primary_meaning) {
          await updateWordSense({
            where: { id },
            data: body.clearInvalidPrimary
              ? {
                  meaningId: null,
                  meaningReviewStatus: MeaningReviewStatus.NEEDS_ACTION_MISSING_PRIMARY,
                }
              : { meaningReviewStatus: MeaningReviewStatus.NEEDS_ACTION_INVALID_PRIMARY },
            select: { id: true },
          }, tx);
          outcomes.push({
            id,
            status: "attention_required",
            contentChanged: body.clearInvalidPrimary,
            reviewStatusChanged: true,
            attentionRequired: true,
          });
          continue;
        }
        const word = await tx.wordSense.findUnique({
          where: { id },
          select: {
            id: true,
            meaningId: true,
            otherMeaningIds: true,
            pos: true,
            concept_explained_fa: true,
            sentenceIds: true,
            meaningReviewStatus: true,
          },
        });
        if (!word) throw new Error(`WordSense ${id} no longer exists.`);
        const data: Prisma.WordSenseUncheckedUpdateInput = {};
        let contentChanged = false;

        if (result?.meaning_fa && result.meaning_fa !== record.meaning_fa) {
          const meaningId = (await addPersianWordWithClient(result.meaning_fa, {}, tx)).item.id;
          if (meaningId !== word.meaningId) {
            data.meaningId = meaningId;
            contentChanged = true;
          }
        }
        if (result?.other_meanings_fa) {
          if (!sameArray(result.other_meanings_fa, record.other_meanings_fa ?? [])) {
            const primaryId = typeof data.meaningId === "number" ? data.meaningId : word.meaningId;
            if (!primaryId) throw new Error(`WordSense ${id} cannot save alternative meanings without a primary meaning.`);
            const ids = await Promise.all(result.other_meanings_fa.map(async (meaning) =>
              (await addPersianWordWithClient(meaning, {}, tx)).item.id
            ));
            const nextOtherMeaningIds = [...new Set(ids.filter((meaningId) => meaningId !== primaryId))];
            const currentOtherMeaningIds = Array.isArray(word.otherMeaningIds)
              ? word.otherMeaningIds.filter((value): value is number => typeof value === "number")
              : [];
            if (!sameArray(nextOtherMeaningIds, currentOtherMeaningIds)) {
              data.otherMeaningIds = nextOtherMeaningIds;
              contentChanged = true;
            }
          }
        }
        if (result?.pos && result.pos !== word.pos?.trim()) {
          data.pos = result.pos;
          contentChanged = true;
        }
        if (result?.concept_explained_fa && result.concept_explained_fa !== word.concept_explained_fa?.trim()) {
          data.concept_explained_fa = result.concept_explained_fa;
          contentChanged = true;
        }

        const currentSentenceIds = wordSentenceIds(word.sentenceIds);
        const currentSentences = currentSentenceIds.length
          ? await tx.sentence.findMany({
              where: { id: { in: currentSentenceIds } },
              select: { id: true, sentence_en: true, sentence_en_meaning_fa: true },
            })
          : [];
        const currentSentenceIdSet = new Set(currentSentences.map((sentence) => sentence.id));
        const invalidIds = result?.invalid_sentence_ids ?? [];
        if (invalidIds.some((sentenceId) => !currentSentenceIdSet.has(sentenceId))) {
          throw new Error(`WordSense ${id} contains an unrelated invalid_sentence_id.`);
        }
        const nextSentenceIds = currentSentenceIds.filter(
          (sentenceId) => currentSentenceIdSet.has(sentenceId) && !invalidIds.includes(sentenceId),
        );
        const replacementIndex = invalidIds.length
          ? Math.min(...invalidIds.map((sentenceId) => currentSentenceIds.indexOf(sentenceId)))
          : nextSentenceIds.length;
        const sentenceMeaningById = new Map(
          currentSentences.map((sentence) => [sentence.id, sentence.sentence_en_meaning_fa?.trim() || null]),
        );
        for (const sentence of result?.sentences ?? []) {
          if (sentence.sentence_id !== null) {
            if (!currentSentenceIdSet.has(sentence.sentence_id)) {
              throw new Error(`Sentence ${sentence.sentence_id} is not linked to WordSense ${id}.`);
            }
            if (sentence.sentence_en !== undefined) {
              const current = currentSentences.find((item) => item.id === sentence.sentence_id)!;
              if (sentence.sentence_en !== current.sentence_en) {
                throw new Error(`Existing Sentence ${sentence.sentence_id} text cannot be replaced.`);
              }
            }
            if (
              sentence.sentence_en_meaning_fa &&
              sentenceMeaningById.get(sentence.sentence_id) !== sentence.sentence_en_meaning_fa
            ) {
              await tx.sentence.update({
                where: { id: sentence.sentence_id },
                data: { sentence_en_meaning_fa: sentence.sentence_en_meaning_fa },
              });
              await touchWordSensesLinkedToSentenceId(
                sentence.sentence_id,
                { resetMeaningReviewStatus: true },
                tx,
              );
              sentenceMeaningById.set(sentence.sentence_id, sentence.sentence_en_meaning_fa);
              contentChanged = true;
            }
            continue;
          }

          const existing = await tx.sentence.findUnique({
            where: { sentence_en: sentence.sentence_en! },
            select: { id: true, sentence_en_meaning_fa: true },
          });
          let sentenceId: number;
          if (existing) {
            const currentMeaning = existing.sentence_en_meaning_fa?.trim() || null;
            if (currentMeaning && sentence.sentence_en_meaning_fa && currentMeaning !== sentence.sentence_en_meaning_fa) {
              throw new Error(`Existing Sentence ${existing.id} already has a different Persian translation.`);
            }
            if (!currentMeaning && sentence.sentence_en_meaning_fa) {
              await tx.sentence.update({
                where: { id: existing.id },
                data: { sentence_en_meaning_fa: sentence.sentence_en_meaning_fa },
              });
              await touchWordSensesLinkedToSentenceId(
                existing.id,
                { resetMeaningReviewStatus: true },
                tx,
              );
              contentChanged = true;
            }
            sentenceId = existing.id;
          } else {
            sentenceId = (await tx.sentence.create({
              data: { sentence_en: sentence.sentence_en!, sentence_en_meaning_fa: sentence.sentence_en_meaning_fa ?? null },
              select: { id: true },
            })).id;
            contentChanged = true;
          }
          if (!nextSentenceIds.includes(sentenceId)) {
            nextSentenceIds.splice(Math.min(replacementIndex, nextSentenceIds.length), 0, sentenceId);
          }
          sentenceMeaningById.set(sentenceId, sentence.sentence_en_meaning_fa ?? existing?.sentence_en_meaning_fa ?? null);
        }
        if (!sameArray(nextSentenceIds, currentSentenceIds)) {
          data.sentenceIds = nextSentenceIds;
          contentChanged = true;
        }

        const nextMeaningId = typeof data.meaningId === "number" ? data.meaningId : word.meaningId;
        const nextOtherMeanings = data.otherMeaningIds !== undefined ? data.otherMeaningIds : word.otherMeaningIds;
        const nextPos = typeof data.pos === "string" ? data.pos : word.pos;
        const nextConcept = typeof data.concept_explained_fa === "string" ? data.concept_explained_fa : word.concept_explained_fa;
        const isComplete = Boolean(
          nextMeaningId && Array.isArray(nextOtherMeanings) && nextPos?.trim() && nextConcept?.trim() &&
          nextSentenceIds.length && nextSentenceIds.every((sentenceId) => sentenceMeaningById.get(sentenceId)?.trim()),
        );
        if (!isComplete) {
          throw new Error(`WordSense ${id} would still have incomplete core fields after this review.`);
        }
        const reviewStatusChanged = word.meaningReviewStatus !== MeaningReviewStatus.CONFIRMED;
        if (reviewStatusChanged || contentChanged) data.meaningReviewStatus = MeaningReviewStatus.CONFIRMED;
        if (Object.keys(data).length) {
          await updateWordSense({ where: { id }, data, select: { id: true } }, tx);
        }
        outcomes.push({
          id,
          status: contentChanged
            ? "updated"
            : reviewStatusChanged
              ? "review_confirmed"
              : "already_current",
          contentChanged,
          reviewStatusChanged,
          attentionRequired: false,
        });
      }
    }, { isolationLevel: "Serializable", maxWait: 10_000, timeout: 120_000 });
    const summary = summarizeMeaningReviewOutcomes(outcomes);
    let reportPersistenceWarning: string | undefined;
    if (conflictReport) {
      try {
        await finalizeMeaningReviewConflictReport({
          ...conflictReport,
          status: "completed",
          needsActionWordSenseIds: [...conflictIds],
        });
      } catch (error) {
        reportPersistenceWarning = `The prepared JSON report exists, but its completion status could not be updated: ${error instanceof Error ? error.message : String(error)}`;
      }
    }
    return NextResponse.json({
      ok: true,
      atomic: true,
      requestKey: body.requestKey,
      ...summary,
      results: outcomes,
      conflictReportId: conflictReport?.report.reportId ?? null,
      ...(reportPersistenceWarning ? { reportPersistenceWarning } : {}),
    });
  } catch (error) {
    if (conflictReport) {
      try {
        await finalizeMeaningReviewConflictReport({
          ...conflictReport,
          status: "database_rolled_back",
          databaseError: error instanceof Error ? error.message : String(error),
        });
      } catch {
        // The original prepared JSON file remains available even if status finalization fails.
      }
    }
    return NextResponse.json(
      {
        ok: false,
        requestKey: body.requestKey,
        error: error instanceof Error ? error.message : String(error),
        ...meaningReviewAtomicFailure(
          activeId,
          error instanceof Error ? error.message : String(error),
        ),
      },
      { status: 400 },
    );
  }
}
