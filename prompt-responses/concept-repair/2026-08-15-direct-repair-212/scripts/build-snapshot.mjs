import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { PrismaClient } from "@prisma/client";

const projectRoot = process.cwd();
const auditFinal = path.join(
  projectRoot,
  "prompt-responses/concept-audit/2026-08-15-multi-sense-concepts/final",
);
const runRoot = path.join(
  projectRoot,
  "prompt-responses/concept-repair/2026-08-15-direct-repair-212",
);
const inputDir = path.join(runRoot, "inputs");
const batchRoot = path.join(runRoot, "batches");

const otherSenseRows = JSON.parse(
  fs.readFileSync(path.join(auditFinal, "other-sense-references.json"), "utf8"),
);
const fluencyRows = JSON.parse(
  fs.readFileSync(path.join(auditFinal, "serious-fluency-issues.json"), "utf8"),
);

const issueTypesById = new Map();
for (const row of otherSenseRows) {
  issueTypesById.set(row.id, ["other_sense_reference"]);
}
for (const row of fluencyRows) {
  const current = issueTypesById.get(row.id) ?? [];
  issueTypesById.set(row.id, [...current, "serious_fluency"]);
}
const targetIds = [...issueTypesById.keys()].sort((left, right) => left - right);

if (targetIds.length !== 212) {
  throw new Error(`Expected 212 unique target IDs, received ${targetIds.length}.`);
}

function positiveIds(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter(
    (item) => Number.isSafeInteger(item) && item > 0,
  ))];
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function sha256(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

const prisma = new PrismaClient();

try {
  const snapshot = await prisma.$transaction(async (tx) => {
    const targets = await tx.wordSense.findMany({
      where: { id: { in: targetIds } },
      orderBy: { id: "asc" },
      select: {
        id: true,
        englishId: true,
        meaningId: true,
        otherMeaningIds: true,
        sentenceIds: true,
        pos: true,
        concept_explained_fa: true,
        conceptMergeReviewed: true,
        inflectionMergeReviewed: true,
        meaningReviewStatus: true,
        updatedAt: true,
        english: { select: { base_form: true } },
      },
    });
    if (targets.length !== targetIds.length) {
      const found = new Set(targets.map((row) => row.id));
      throw new Error(`Missing WordSense IDs: ${targetIds.filter((id) => !found.has(id)).join(", ")}`);
    }

    const englishIds = [...new Set(targets.map((row) => row.englishId))];
    const siblings = await tx.wordSense.findMany({
      where: { englishId: { in: englishIds } },
      orderBy: [{ englishId: "asc" }, { id: "asc" }],
      select: {
        id: true,
        englishId: true,
        meaningId: true,
        otherMeaningIds: true,
        pos: true,
      },
    });

    const meaningIds = [...new Set(
      [...targets, ...siblings].flatMap((row) => [
        ...(row.meaningId ? [row.meaningId] : []),
        ...positiveIds(row.otherMeaningIds),
      ]),
    )];
    const sentenceIds = [...new Set(targets.flatMap((row) => positiveIds(row.sentenceIds)))];
    const [meanings, sentences] = await Promise.all([
      meaningIds.length
        ? tx.persianWord.findMany({
            where: { id: { in: meaningIds } },
            select: { id: true, canonical_text: true },
          })
        : [],
      sentenceIds.length
        ? tx.sentence.findMany({
            where: { id: { in: sentenceIds } },
            select: { id: true, sentence_en: true, sentence_en_meaning_fa: true },
          })
        : [],
    ]);
    return { targets, siblings, meanings, sentences };
  }, { maxWait: 10_000, timeout: 120_000 });

  const meaningById = new Map(snapshot.meanings.map((row) => [row.id, row.canonical_text]));
  const sentenceById = new Map(snapshot.sentences.map((row) => [row.id, row]));
  const siblingsByEnglishId = new Map();
  for (const row of snapshot.siblings) {
    const current = siblingsByEnglishId.get(row.englishId) ?? [];
    current.push(row);
    siblingsByEnglishId.set(row.englishId, current);
  }
  const meaningFields = (row) => ({
    meaning_fa: row.meaningId ? meaningById.get(row.meaningId) ?? "" : "",
    other_meanings_fa: positiveIds(row.otherMeaningIds)
      .filter((id) => id !== row.meaningId)
      .flatMap((id) => meaningById.has(id) ? [meaningById.get(id)] : []),
  });

  const promptInput = snapshot.targets.map((row) => ({
    id: row.id,
    word: row.english.base_form,
    pos: row.pos ?? "",
    ...meaningFields(row),
    concept_explained_fa: row.concept_explained_fa ?? "",
    sentences: positiveIds(row.sentenceIds).flatMap((id) => {
      const sentence = sentenceById.get(id);
      return sentence ? [{
        id: sentence.id,
        sentence_en: sentence.sentence_en,
        sentence_en_meaning_fa: sentence.sentence_en_meaning_fa ?? "",
      }] : [];
    }),
    sibling_senses: (siblingsByEnglishId.get(row.englishId) ?? [])
      .filter((sibling) => sibling.id !== row.id)
      .map((sibling) => ({
        id: sibling.id,
        pos: sibling.pos ?? "",
        ...meaningFields(sibling),
      })),
    issue_types: issueTypesById.get(row.id),
  }));

  const applySource = snapshot.targets.map((row) => ({
    id: row.id,
    concept_explained_fa: row.concept_explained_fa ?? "",
    conceptMergeReviewed: row.conceptMergeReviewed,
    inflectionMergeReviewed: row.inflectionMergeReviewed,
    meaningReviewStatus: row.meaningReviewStatus,
    updatedAt: row.updatedAt.toISOString(),
  }));

  fs.mkdirSync(inputDir, { recursive: true });
  fs.mkdirSync(batchRoot, { recursive: true });
  const inputPath = path.join(inputDir, "records.json");
  const applySourcePath = path.join(inputDir, "apply-source.json");
  writeJson(inputPath, promptInput);
  writeJson(applySourcePath, applySource);

  const batches = [];
  for (let offset = 0; offset < promptInput.length; offset += 50) {
    const number = batches.length + 1;
    const batchId = `batch-${String(number).padStart(3, "0")}`;
    const records = promptInput.slice(offset, offset + 50);
    const batchPath = path.join(batchRoot, batchId, "input.json");
    writeJson(batchPath, records);
    batches.push({
      batchId,
      inputCount: records.length,
      firstId: records[0].id,
      lastId: records.at(-1).id,
      inputPath: path.relative(runRoot, batchPath),
      inputSha256: sha256(batchPath),
    });
  }

  const manifest = {
    workflow: "direct-word-sense-concept-repair",
    snapshotDate: "2026-08-15",
    targetCount: promptInput.length,
    sourceCounts: {
      otherSenseReferences: otherSenseRows.length,
      seriousFluencyIssues: fluencyRows.length,
      overlap: otherSenseRows.length + fluencyRows.length - promptInput.length,
    },
    batchSize: 50,
    batchCount: batches.length,
    mutationContract: {
      onlyField: "concept_explained_fa",
      dependentReviewReset: {
        conceptMergeReviewed: false,
        inflectionMergeReviewed: false,
        meaningReviewStatus: "wordSenseRepo semantic-change policy",
      },
      preserveComparedMeaningWordIdsAndSynonymIds: true,
      merge: false,
      delete: false,
    },
    inputs: {
      records: { path: "inputs/records.json", sha256: sha256(inputPath) },
      applySource: { path: "inputs/apply-source.json", sha256: sha256(applySourcePath) },
    },
    batches,
    databaseMutation: false,
  };
  writeJson(path.join(runRoot, "manifest.json"), manifest);
  console.log(JSON.stringify(manifest, null, 2));
} finally {
  await prisma.$disconnect();
}
