import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";

const projectRoot = process.cwd();
const screeningRoot = path.join(projectRoot, "backups/word-sense-split-recovery/2026-08-14");
const root = path.join(screeningRoot, "repair-execution");
const batchesDir = path.join(root, "batches");
const manifestPath = path.join(root, "manifest.json");
const checkpointPath = path.join(root, "checkpoint.json");
const ledgerPath = path.join(root, "progress-ledger.jsonl");
const checklistPath = path.join(root, "repair-checklist.md");
const summaryPath = path.join(root, "summary.json");

for (const name of [".env.local", ".env"]) {
  const file = path.join(projectRoot, name);
  if (fs.existsSync(file)) dotenv.config({ path: file, quiet: true });
}

const prisma = new PrismaClient();

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function readJsonl(file, hasHeader = false) {
  const rows = fs.readFileSync(file, "utf8").trim().split("\n").filter(Boolean).map(JSON.parse);
  return hasHeader ? rows.slice(1) : rows;
}

function jsonl(rows) {
  return rows.map((row) => JSON.stringify(row)).join("\n") + "\n";
}

function atomicWrite(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, content);
  fs.renameSync(temporary, file);
}

function sha256(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function positiveIds(value) {
  return Array.isArray(value)
    ? [...new Set(value.filter((item) => Number.isSafeInteger(item) && item > 0))]
    : [];
}

function sameArray(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function sourceSnapshot(row, sentenceById, meaningById) {
  const sentenceIds = positiveIds(row.sentenceIds);
  const otherMeaningIds = positiveIds(row.otherMeaningIds);
  return {
    id: row.id,
    anki_link_id: row.anki_link_id,
    englishId: row.englishId,
    base_form: row.english.base_form,
    meaningId: row.meaningId,
    meaning_fa: row.meaning?.canonical_text ?? null,
    otherMeaningIds,
    otherMeanings: otherMeaningIds.map((id) => ({ id, meaning_fa: meaningById.get(id) ?? null })),
    sentenceIds,
    sentences: sentenceIds.map((id) => sentenceById.get(id)).filter(Boolean),
    pos: row.pos,
    concept_explained_fa: row.concept_explained_fa,
    meaningReviewStatus: row.meaningReviewStatus,
    conceptMergeReviewed: row.conceptMergeReviewed,
    inflectionMergeReviewed: row.inflectionMergeReviewed,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function loadLiveRows(ids) {
  const sources = await prisma.wordSense.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      anki_link_id: true,
      englishId: true,
      meaningId: true,
      otherMeaningIds: true,
      sentenceIds: true,
      pos: true,
      concept_explained_fa: true,
      meaningReviewStatus: true,
      conceptMergeReviewed: true,
      inflectionMergeReviewed: true,
      createdAt: true,
      updatedAt: true,
      english: { select: { base_form: true } },
      meaning: { select: { canonical_text: true } },
    },
  });
  if (sources.length !== ids.length) {
    const found = new Set(sources.map((row) => row.id));
    throw new Error(`Missing live WordSense ids: ${ids.filter((id) => !found.has(id)).join(", ")}`);
  }
  const englishIds = [...new Set(sources.map((row) => row.englishId))];
  const siblings = await prisma.wordSense.findMany({
    where: { englishId: { in: englishIds }, id: { notIn: ids } },
    select: {
      id: true,
      anki_link_id: true,
      englishId: true,
      meaningId: true,
      otherMeaningIds: true,
      sentenceIds: true,
      pos: true,
      concept_explained_fa: true,
      meaningReviewStatus: true,
      conceptMergeReviewed: true,
      inflectionMergeReviewed: true,
      createdAt: true,
      updatedAt: true,
      english: { select: { base_form: true } },
      meaning: { select: { canonical_text: true } },
    },
    orderBy: { id: "asc" },
  });
  const all = [...sources, ...siblings];
  const sentenceIds = [...new Set(all.flatMap((row) => positiveIds(row.sentenceIds)))];
  const meaningIds = [...new Set(all.flatMap((row) => [
    ...(row.meaningId ? [row.meaningId] : []),
    ...positiveIds(row.otherMeaningIds),
  ]))];
  const [sentences, meanings] = await Promise.all([
    sentenceIds.length ? prisma.sentence.findMany({
      where: { id: { in: sentenceIds } },
      select: { id: true, sentence_en: true, sentence_en_meaning_fa: true, updatedAt: true },
    }) : [],
    meaningIds.length ? prisma.persianWord.findMany({
      where: { id: { in: meaningIds } },
      select: { id: true, canonical_text: true },
    }) : [],
  ]);
  const sentenceById = new Map(sentences.map((sentence) => [sentence.id, {
    id: sentence.id,
    sentence_en: sentence.sentence_en,
    sentence_en_meaning_fa: sentence.sentence_en_meaning_fa,
    updatedAt: sentence.updatedAt.toISOString(),
  }]));
  const meaningById = new Map(meanings.map((meaning) => [meaning.id, meaning.canonical_text]));
  const sourceById = new Map(sources.map((row) => [row.id, sourceSnapshot(row, sentenceById, meaningById)]));
  const siblingsByEnglishId = new Map();
  for (const sibling of siblings) {
    const list = siblingsByEnglishId.get(sibling.englishId) ?? [];
    list.push(sourceSnapshot(sibling, sentenceById, meaningById));
    siblingsByEnglishId.set(sibling.englishId, list);
  }
  return ids.map((id) => ({
    source: sourceById.get(id),
    siblingWordSenses: siblingsByEnglishId.get(sourceById.get(id).englishId) ?? [],
  }));
}

function pathsFor(batchId) {
  const prefix = path.join(batchesDir, batchId);
  return {
    input: `${prefix}-input.jsonl`,
    before: `${prefix}-before-apply.jsonl`,
    decisions: `${prefix}-decisions.json`,
    qa: `${prefix}-qa.json`,
    request: `${prefix}-apply-request.json`,
    response: `${prefix}-apply-response.json`,
    failure: `${prefix}-apply-failure.json`,
    after: `${prefix}-after-apply.jsonl`,
    verification: `${prefix}-verification.json`,
  };
}

function allFlagIds() {
  return readJsonl(path.join(screeningRoot, "flagged-record-ids.jsonl"), true).map((row) => row.id);
}

function invalidPrimarySet() {
  return new Set(readJsonl(path.join(screeningRoot, "invalid-primary-ids.jsonl"), true).map((row) => row.id));
}

function initialById() {
  return new Map(readJsonl(path.join(screeningRoot, "initial-records.jsonl")).map((row) => [row.sourceWordSenseId, row]));
}

function loadCompletedIds() {
  if (!fs.existsSync(ledgerPath) || !fs.readFileSync(ledgerPath, "utf8").trim()) return [];
  return readJsonl(ledgerPath).filter((row) => row.status === "completed" || row.status === "invalid_primary_skipped").map((row) => row.id);
}

function updateVisibleState(flagIds, completedIds, lastCompletedBatch) {
  const completed = new Set(completedIds);
  atomicWrite(checklistPath, [
    "# WordSense split-repair execution checklist",
    "",
    ...flagIds.map((id) => `- [${completed.has(id) ? "x" : " "}] WordSense ${id}`),
    "",
  ].join("\n"));
  const changed = fs.existsSync(ledgerPath) && fs.readFileSync(ledgerPath, "utf8").trim()
    ? readJsonl(ledgerPath).filter((row) => row.status === "completed" && row.changed).length
    : 0;
  const skipped = fs.existsSync(ledgerPath) && fs.readFileSync(ledgerPath, "utf8").trim()
    ? readJsonl(ledgerPath).filter((row) => row.status === "invalid_primary_skipped").length
    : 0;
  atomicWrite(checkpointPath, JSON.stringify({
    schemaVersion: 1,
    total: flagIds.length,
    completed: completedIds.length,
    remaining: flagIds.length - completedIds.length,
    nextIndex: completedIds.length,
    lastCompletedBatch,
    completedIds,
    updatedAt: new Date().toISOString(),
  }, null, 2) + "\n");
  atomicWrite(summaryPath, JSON.stringify({
    schemaVersion: 1,
    status: completedIds.length === flagIds.length ? "complete" : "in_progress",
    sourceCount: flagIds.length,
    completedCount: completedIds.length,
    changedCount: changed,
    invalidPrimarySkippedCount: skipped,
    remainingCount: flagIds.length - completedIds.length,
    lastCompletedBatch,
    databaseBackup: "dbBackupToWork/database_backup.archive",
    updatedAt: new Date().toISOString(),
  }, null, 2) + "\n");
}

async function init() {
  fs.mkdirSync(batchesDir, { recursive: true });
  const flagFile = path.join(screeningRoot, "flagged-record-ids.jsonl");
  const initialFile = path.join(screeningRoot, "initial-records.jsonl");
  const flagIds = allFlagIds();
  if (flagIds.length !== 2079 || new Set(flagIds).size !== flagIds.length) {
    throw new Error(`Expected 2079 unique flagged ids, received ${flagIds.length}.`);
  }
  if (!fs.existsSync(manifestPath)) {
    atomicWrite(manifestPath, JSON.stringify({
      schemaVersion: 1,
      createdAt: new Date().toISOString(),
      sourceScreeningRoot: path.relative(projectRoot, screeningRoot),
      flaggedFile: path.relative(projectRoot, flagFile),
      flaggedFileSha256: sha256(flagFile),
      initialSnapshotFile: path.relative(projectRoot, initialFile),
      initialSnapshotFileSha256: sha256(initialFile),
      sourceCount: flagIds.length,
      batchSchedule: [50, 100, 150, 200],
      minimumItemQaScore: 8,
      databaseWriteMode: "per-batch Serializable transaction",
    }, null, 2) + "\n");
  } else {
    const manifest = readJson(manifestPath);
    if (manifest.flaggedFileSha256 !== sha256(flagFile) || manifest.initialSnapshotFileSha256 !== sha256(initialFile)) {
      throw new Error("Immutable source files changed after repair initialization.");
    }
  }
  if (!fs.existsSync(ledgerPath)) atomicWrite(ledgerPath, "");
  const completedIds = loadCompletedIds();
  const lastCompletedBatch = fs.existsSync(checkpointPath)
    ? readJson(checkpointPath).lastCompletedBatch ?? null
    : null;
  updateVisibleState(flagIds, completedIds, lastCompletedBatch);
  console.log(JSON.stringify({ initialized: true, total: flagIds.length, completed: completedIds.length, remaining: flagIds.length - completedIds.length }, null, 2));
}

async function prepare(size) {
  await init();
  if (!Number.isSafeInteger(size) || size < 1 || size > 350) throw new Error("Batch size must be an integer from 1 to 350.");
  const flagIds = allFlagIds();
  const completedIds = loadCompletedIds();
  const completed = new Set(completedIds);
  const remainingIds = flagIds.filter((id) => !completed.has(id));
  if (!remainingIds.length) {
    console.log(JSON.stringify({ complete: true, remaining: 0 }, null, 2));
    return;
  }
  const existingInputs = fs.readdirSync(batchesDir).filter((name) => /^repair-batch-\d{4}-input\.jsonl$/u.test(name)).sort();
  const pending = existingInputs.find((name) => !fs.existsSync(path.join(batchesDir, name.replace("-input.jsonl", "-apply-response.json"))));
  if (pending) throw new Error(`Pending batch already exists: ${pending.replace("-input.jsonl", "")}`);
  const batchNumber = existingInputs.length + 1;
  const batchId = `repair-batch-${String(batchNumber).padStart(4, "0")}`;
  const ids = remainingIds.slice(0, size);
  const live = await loadLiveRows(ids);
  const initial = initialById();
  const invalid = invalidPrimarySet();
  const stale = [];
  const rows = live.map((item, index) => {
    const snapshot = initial.get(item.source.id);
    if (!snapshot) throw new Error(`Initial snapshot missing WordSense ${item.source.id}.`);
    const semanticSame =
      snapshot.meaningId === item.source.meaningId &&
      sameArray(snapshot.otherMeanings.map((meaning) => meaning.id), item.source.otherMeaningIds) &&
      sameArray(snapshot.sentenceIds, item.source.sentenceIds);
    if (!semanticSame) stale.push({
      id: item.source.id,
      initial: { meaningId: snapshot.meaningId, otherMeaningIds: snapshot.otherMeanings.map((meaning) => meaning.id), sentenceIds: snapshot.sentenceIds },
      live: { meaningId: item.source.meaningId, otherMeaningIds: item.source.otherMeaningIds, sentenceIds: item.source.sentenceIds },
    });
    return {
      batchId,
      batchIndex: index,
      globalFlagIndex: flagIds.indexOf(item.source.id),
      invalidPrimary: invalid.has(item.source.id),
      source: item.source,
      siblingWordSenses: item.siblingWordSenses,
    };
  });
  const files = pathsFor(batchId);
  atomicWrite(files.input, jsonl(rows));
  atomicWrite(files.before, jsonl(rows.map((row) => row.source)));
  if (stale.length) {
    atomicWrite(`${path.join(batchesDir, batchId)}-stale.json`, JSON.stringify({ batchId, stale }, null, 2) + "\n");
    throw new Error(`${stale.length} records changed semantically since screening; batch saved but requires refresh.`);
  }
  console.log(JSON.stringify({ batchId, count: rows.length, firstId: ids[0], lastId: ids.at(-1), invalidPrimaryCount: rows.filter((row) => row.invalidPrimary).length, input: path.relative(projectRoot, files.input) }, null, 2));
}

async function prepareAll(size) {
  await init();
  if (!Number.isSafeInteger(size) || size < 1 || size > 350) {
    throw new Error("Batch size must be an integer from 1 to 350.");
  }
  const flagIds = allFlagIds();
  const completedIds = loadCompletedIds();
  const completed = new Set(completedIds);
  const remainingIds = flagIds.filter((id) => !completed.has(id));
  if (!remainingIds.length) {
    console.log(JSON.stringify({ complete: true, remaining: 0 }, null, 2));
    return;
  }
  const lastCompletedBatch = readJson(checkpointPath).lastCompletedBatch;
  const completedBatchNumber = Number(lastCompletedBatch?.match(/^repair-batch-(\d{4})$/u)?.[1]);
  if (!Number.isSafeInteger(completedBatchNumber)) {
    throw new Error("Cannot derive the next batch number from the checkpoint.");
  }
  const chunks = [];
  for (let offset = 0; offset < remainingIds.length; offset += size) {
    chunks.push(remainingIds.slice(offset, offset + size));
  }
  const targetBatchIds = chunks.map((_, index) =>
    `repair-batch-${String(completedBatchNumber + index + 1).padStart(4, "0")}`,
  );
  for (const batchId of targetBatchIds) {
    const files = pathsFor(batchId);
    for (const protectedFile of [files.decisions, files.qa, files.request, files.response, files.failure, files.after, files.verification]) {
      if (fs.existsSync(protectedFile)) {
        throw new Error(`Refusing to replace existing downstream artifact: ${path.relative(projectRoot, protectedFile)}`);
      }
    }
  }

  const live = await loadLiveRows(remainingIds);
  const liveById = new Map(live.map((item) => [item.source.id, item]));
  const initial = initialById();
  const invalid = invalidPrimarySet();
  const batchPlan = [];
  for (let batchIndex = 0; batchIndex < chunks.length; batchIndex += 1) {
    const batchId = targetBatchIds[batchIndex];
    const ids = chunks[batchIndex];
    const stale = [];
    const rows = ids.map((id, index) => {
      const item = liveById.get(id);
      const snapshot = initial.get(id);
      if (!item || !snapshot) throw new Error(`Snapshot missing WordSense ${id}.`);
      const semanticSame =
        snapshot.meaningId === item.source.meaningId &&
        sameArray(snapshot.otherMeanings.map((meaning) => meaning.id), item.source.otherMeaningIds) &&
        sameArray(snapshot.sentenceIds, item.source.sentenceIds);
      if (!semanticSame) stale.push({
        id,
        initial: {
          meaningId: snapshot.meaningId,
          otherMeaningIds: snapshot.otherMeanings.map((meaning) => meaning.id),
          sentenceIds: snapshot.sentenceIds,
        },
        live: {
          meaningId: item.source.meaningId,
          otherMeaningIds: item.source.otherMeaningIds,
          sentenceIds: item.source.sentenceIds,
        },
      });
      return {
        batchId,
        batchIndex: index,
        globalFlagIndex: flagIds.indexOf(id),
        invalidPrimary: invalid.has(id),
        source: item.source,
        siblingWordSenses: item.siblingWordSenses,
      };
    });
    const files = pathsFor(batchId);
    atomicWrite(files.input, jsonl(rows));
    atomicWrite(files.before, jsonl(rows.map((row) => row.source)));
    if (stale.length) {
      atomicWrite(`${path.join(batchesDir, batchId)}-stale.json`, JSON.stringify({
        batchId,
        acceptedAsLiveRefresh: true,
        stale,
      }, null, 2) + "\n");
    }
    batchPlan.push({
      batchId,
      count: ids.length,
      firstId: ids[0],
      lastId: ids.at(-1),
      invalidPrimaryCount: rows.filter((row) => row.invalidPrimary).length,
      refreshedSinceScreeningCount: stale.length,
      input: path.relative(projectRoot, files.input),
    });
  }
  const planPath = path.join(root, "promptanswers-batch-plan.json");
  atomicWrite(planPath, JSON.stringify({
    schemaVersion: 1,
    createdAt: new Date().toISOString(),
    completedBeforePlan: completedIds.length,
    remainingCount: remainingIds.length,
    requestedBatchSize: size,
    batchCount: batchPlan.length,
    exactCoverage: batchPlan.reduce((sum, batch) => sum + batch.count, 0) === remainingIds.length,
    batches: batchPlan,
  }, null, 2) + "\n");
  console.log(JSON.stringify({
    preparedAll: true,
    remainingCount: remainingIds.length,
    batchCount: batchPlan.length,
    batchSizes: batchPlan.map((batch) => batch.count),
    plan: path.relative(projectRoot, planPath),
    batches: batchPlan,
  }, null, 2));
}

function validateQa(batchId, ids, qa) {
  if (
    qa?.batchId !== batchId || qa?.status !== "pass" || qa?.allItemsReviewed !== true ||
    qa?.inputCount !== ids.length || qa?.outputCount !== ids.length || !Array.isArray(qa.itemScores) ||
    qa.itemScores.length !== ids.length || qa.itemScores.some((item, index) =>
      item?.id !== ids[index] || item?.status !== "pass" || typeof item?.score !== "number" || item.score < 8
    ) || typeof qa.batchScore !== "number" || qa.batchScore < 8
  ) throw new Error(`Batch ${batchId} QA does not pass the complete per-item quality gate.`);
}

async function apply(batchId) {
  await init();
  if (!/^repair-batch-\d{4}$/u.test(batchId)) throw new Error("Invalid batch id.");
  const files = pathsFor(batchId);
  if (!fs.existsSync(files.input) || !fs.existsSync(files.before)) throw new Error(`Batch ${batchId} is not prepared.`);
  if (fs.existsSync(files.response)) throw new Error(`Batch ${batchId} already has a successful apply response.`);
  if (!fs.existsSync(files.decisions) || !fs.existsSync(files.qa)) throw new Error(`Batch ${batchId} decisions or QA file is missing.`);
  const input = readJsonl(files.input);
  const ids = input.map((row) => row.source.id);
  const decisions = readJson(files.decisions);
  if (
    decisions?.batchId !== batchId || !Array.isArray(decisions.records) || decisions.records.length !== ids.length ||
    decisions.records.some((record, index) => record?.id !== ids[index])
  ) throw new Error(`Batch ${batchId} decisions do not exactly match input order and coverage.`);
  validateQa(batchId, ids, readJson(files.qa));
  atomicWrite(files.request, JSON.stringify(decisions, null, 2) + "\n");
  const response = await fetch("http://localhost:3000/api/tests/words/split-repair/apply", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(decisions),
  });
  const payload = await response.json().catch(() => ({ ok: false, error: `Non-JSON response with HTTP ${response.status}` }));
  if (!response.ok || payload.ok !== true || payload.atomic !== true || payload.sourceCount !== ids.length) {
    atomicWrite(files.failure, JSON.stringify({ httpStatus: response.status, payload, failedAt: new Date().toISOString() }, null, 2) + "\n");
    throw new Error(`Batch ${batchId} rolled back or failed: ${payload.error ?? `HTTP ${response.status}`}`);
  }
  atomicWrite(files.response, JSON.stringify(payload, null, 2) + "\n");
  const after = await loadLiveRows(ids);
  atomicWrite(files.after, jsonl(after.map((row) => row.source)));
  const now = new Date().toISOString();
  const events = payload.results.map((item) => JSON.stringify({
    type: "repair_record_completed",
    batchId,
    id: item.id,
    status: item.status === "invalid_primary_skipped" ? "invalid_primary_skipped" : "completed",
    changed: Boolean(item.changed),
    createdWordSenseIds: item.createdWordSenseIds ?? [],
    reusedWordSenseIds: item.reusedWordSenseIds ?? [],
    completedAt: now,
  })).join("\n") + "\n";
  fs.appendFileSync(ledgerPath, events);
  const completedIds = loadCompletedIds();
  const flagIds = allFlagIds();
  if (new Set(completedIds).size !== completedIds.length) throw new Error("Duplicate completed IDs detected after apply.");
  if (!sameArray(completedIds, flagIds.slice(0, completedIds.length))) throw new Error("Completed IDs no longer match immutable flagged order.");
  updateVisibleState(flagIds, completedIds, batchId);
  console.log(JSON.stringify({ batchId, applied: true, sourceCount: ids.length, changedCount: payload.changedCount, invalidPrimarySkippedCount: payload.skippedInvalidPrimaryCount, completed: completedIds.length, remaining: flagIds.length - completedIds.length }, null, 2));
}

async function audit() {
  await init();
  const flagIds = allFlagIds();
  const completedIds = loadCompletedIds();
  const batchInputs = fs.readdirSync(batchesDir).filter((name) => /^repair-batch-\d{4}-input\.jsonl$/u.test(name)).sort();
  const batchResponses = fs.readdirSync(batchesDir).filter((name) => /^repair-batch-\d{4}-apply-response\.json$/u.test(name)).sort();
  const report = {
    total: flagIds.length,
    completed: completedIds.length,
    remaining: flagIds.length - completedIds.length,
    completedUnique: new Set(completedIds).size === completedIds.length,
    exactPrefixOrder: sameArray(completedIds, flagIds.slice(0, completedIds.length)),
    preparedBatchCount: batchInputs.length,
    appliedBatchCount: batchResponses.length,
    pendingBatchCount: batchInputs.length - batchResponses.length,
    manifestFlagHashValid: readJson(manifestPath).flaggedFileSha256 === sha256(path.join(screeningRoot, "flagged-record-ids.jsonl")),
    uncheckedChecklistRows: (fs.readFileSync(checklistPath, "utf8").match(/^- \[ \] WordSense /gmu) ?? []).length,
  };
  console.log(JSON.stringify(report, null, 2));
}

async function verify(batchId) {
  if (!/^repair-batch-\d{4}$/u.test(batchId)) throw new Error("Invalid batch id.");
  const files = pathsFor(batchId);
  if (!fs.existsSync(files.response) || !fs.existsSync(files.decisions) || !fs.existsSync(files.before)) {
    throw new Error(`Batch ${batchId} has not been successfully applied.`);
  }
  const decisions = readJson(files.decisions);
  const response = readJson(files.response);
  const before = readJsonl(files.before);
  const beforeById = new Map(before.map((row) => [row.id, row]));
  const outcomeById = new Map(response.results.map((row) => [row.id, row]));
  const sourceIds = decisions.records.map((row) => row.id);
  const targetIds = response.results.flatMap((row) => [
    ...(row.createdWordSenseIds ?? []),
    ...(row.reusedWordSenseIds ?? []),
  ]);
  const rows = await prisma.wordSense.findMany({
    where: { id: { in: [...sourceIds, ...targetIds] } },
    select: {
      id: true,
      englishId: true,
      meaningId: true,
      otherMeaningIds: true,
      sentenceIds: true,
      pos: true,
      concept_explained_fa: true,
      updatedAt: true,
    },
  });
  const rowById = new Map(rows.map((row) => [row.id, row]));
  const newSentenceTexts = decisions.records.flatMap((record) => record.action === "repair"
    ? [record.primary, ...record.newSenses].flatMap((sense) => sense.sentences)
      .filter((ref) => !ref.existingId).map((ref) => ref.sentence_en)
    : []);
  const generatedSentences = newSentenceTexts.length ? await prisma.sentence.findMany({
    where: { sentence_en: { in: newSentenceTexts } },
    select: { id: true, sentence_en: true, sentence_en_meaning_fa: true },
  }) : [];
  const generatedByText = new Map(generatedSentences.map((row) => [row.sentence_en, row]));
  const errors = [];
  const resolveExpectedSentenceIds = (refs) => refs.map((ref) => ref.existingId ?? generatedByText.get(ref.sentence_en)?.id).filter(Boolean);

  for (const decision of decisions.records) {
    const source = rowById.get(decision.id);
    const original = beforeById.get(decision.id);
    const outcome = outcomeById.get(decision.id);
    if (!source || !original || !outcome) {
      errors.push(`Missing verification row for source ${decision.id}.`);
      continue;
    }
    if (source.meaningId !== original.meaningId || source.englishId !== original.englishId) {
      errors.push(`Stable identity changed for source ${decision.id}.`);
    }
    if (decision.action === "invalid_primary_skip") {
      if (source.updatedAt.toISOString() !== original.updatedAt) errors.push(`Invalid-primary source ${decision.id} changed.`);
      continue;
    }
    if (!sameArray(positiveIds(source.otherMeaningIds), decision.retainedOtherMeaningIds)) {
      errors.push(`Source ${decision.id} alternate meanings do not match.`);
    }
    if (!sameArray(positiveIds(source.sentenceIds), resolveExpectedSentenceIds(decision.primary.sentences))) {
      errors.push(`Source ${decision.id} sentence ids do not match.`);
    }
    for (const removedSentenceId of decision.removedInvalidSentenceIds ?? []) {
      if (positiveIds(source.sentenceIds).includes(removedSentenceId)) {
        errors.push(`Source ${decision.id} still contains removed invalid sentence ${removedSentenceId}.`);
      }
    }
    if (source.pos !== decision.primary.pos || source.concept_explained_fa !== decision.primary.concept_explained_fa) {
      errors.push(`Source ${decision.id} POS or concept does not match.`);
    }
    let createdIndex = 0;
    let reusedIndex = 0;
    for (const proposed of decision.newSenses) {
      const targetId = proposed.reuseWordSenseId
        ? outcome.reusedWordSenseIds?.[reusedIndex++]
        : outcome.createdWordSenseIds?.[createdIndex++];
      const target = rowById.get(targetId);
      if (!target) {
        errors.push(`Missing target WordSense for source ${decision.id}, meaning ${proposed.meaningId}.`);
        continue;
      }
      const targetMeaningIds = new Set([target.meaningId, ...positiveIds(target.otherMeaningIds)]);
      if (![proposed.meaningId, ...proposed.otherMeaningIds].every((id) => targetMeaningIds.has(id))) {
        errors.push(`Target ${target.id} does not contain the proposed meaning group.`);
      }
      const expectedSentenceIds = resolveExpectedSentenceIds(proposed.sentences);
      if (!expectedSentenceIds.every((id) => positiveIds(target.sentenceIds).includes(id))) {
        errors.push(`Target ${target.id} is missing proposed sentences.`);
      }
      if ((decision.removedInvalidSentenceIds ?? []).some((id) => positiveIds(target.sentenceIds).includes(id))) {
        errors.push(`Target ${target.id} contains a removed invalid sentence from source ${decision.id}.`);
      }
      if (target.pos !== proposed.pos || target.concept_explained_fa !== proposed.concept_explained_fa) {
        errors.push(`Target ${target.id} POS or concept does not match.`);
      }
    }
  }
  for (const decision of decisions.records) {
    if (decision.action !== "repair") continue;
    for (const ref of [decision.primary, ...decision.newSenses].flatMap((sense) => sense.sentences)) {
      if (ref.existingId) continue;
      const sentence = generatedByText.get(ref.sentence_en);
      if (!sentence || sentence.sentence_en_meaning_fa !== ref.sentence_en_meaning_fa) {
        errors.push(`Generated sentence verification failed: ${ref.sentence_en}`);
      }
    }
  }
  const report = {
    batchId,
    verifiedAt: new Date().toISOString(),
    sourceCount: decisions.records.length,
    targetCount: targetIds.length,
    generatedSentenceCount: generatedSentences.length,
    checks: {
      stableSourceIdentity: !errors.some((error) => error.includes("Stable identity")),
      exactSourceMeaningsAndSentences: !errors.some((error) => error.startsWith("Source ")),
      targetMeaningGroupsPresent: !errors.some((error) => error.includes("proposed meaning group")),
      targetSentencesPresent: !errors.some((error) => error.includes("proposed sentences")),
      generatedSentencesAndTranslationsPresent: !errors.some((error) => error.includes("Generated sentence")),
      removedInvalidSentencesUnlinked: !errors.some((error) => error.includes("removed invalid sentence")),
      invalidPrimaryRowsUnchanged: !errors.some((error) => error.includes("Invalid-primary")),
    },
    errors,
    score: errors.length ? 0 : 9.2,
    status: errors.length ? "fail" : "pass",
  };
  atomicWrite(files.verification, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report, null, 2));
  if (errors.length) process.exitCode = 1;
}

const [command, argument] = process.argv.slice(2);
try {
  if (command === "init") await init();
  else if (command === "prepare") await prepare(Number(argument));
  else if (command === "prepare-all") await prepareAll(Number(argument));
  else if (command === "apply") await apply(argument);
  else if (command === "verify") await verify(argument);
  else if (command === "audit") await audit();
  else throw new Error("Usage: node scripts/word-sense-split-repair-checkpoint.mjs <init|prepare SIZE|prepare-all SIZE|apply BATCH_ID|verify BATCH_ID|audit>");
} finally {
  await prisma.$disconnect();
}
