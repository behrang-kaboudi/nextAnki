import "server-only";

import { randomUUID } from "node:crypto";
import { statSync } from "node:fs";
import { access, mkdir, rename } from "node:fs/promises";
import path from "node:path";

import { Prisma } from "@prisma/client";

import { getWordConceptAudioAbsolutePath } from "@/lib/audio/wordConceptAudioPaths.server";
import { getJobProgressSnapshot } from "@/lib/progress/jobProgressCatalog";
import { prisma } from "@/lib/prisma";
import { updateManyWords, updateWord } from "@/lib/words/wordRepo";

const WORD_MAINTENANCE_SELECT = {
  id: true,
  meaningId: true,
  otherMeaningIds: true,
  comparedMeaningWordIds: true,
  synonymIds: true,
  sentenceIds: true,
  conceptMergeReviewed: true,
  meanings_confirmed: true,
  pos: true,
  concept_explained_fa: true,
  concept_explained_fa_audio_file_name: true,
  concept_explained_fa_audio_source_text: true,
  learning_depth: true,
  other_meanings_en: true,
  category: true,
  hint_to_select: true,
  imageability: true,
  productive_target: true,
} satisfies Prisma.WordSelect;

type MaintenanceWord = Prisma.WordGetPayload<{ select: typeof WORD_MAINTENANCE_SELECT }>;
type SnapshotField = Exclude<keyof MaintenanceWord, "id">;

export type WordMaintenanceField =
  | "meaningId"
  | "otherMeaningIds"
  | "sentenceIds"
  | "conceptMergeReviewed"
  | "meanings_confirmed"
  | "pos"
  | "concept_explained_fa"
  | "concept_audio"
  | "comparedMeaningWordIds"
  | "synonymIds"
  | "learning_depth"
  | "other_meanings_en"
  | "category"
  | "hint_to_select"
  | "imageability"
  | "productive_target";

type Policy = {
  key: WordMaintenanceField;
  label: string;
  description: string;
  consequences: string[];
  snapshotFields: SnapshotField[];
  clearData: Prisma.WordUncheckedUpdateManyInput;
  isAffected: (row: MaintenanceWord) => boolean;
  quarantinesConceptAudio?: boolean;
};

function hasText(value: string | null) {
  return Boolean(value?.trim());
}

function hasJsonValue(value: Prisma.JsonValue | null) {
  return value !== null && (!Array.isArray(value) || value.length > 0);
}

function hasNumber(value: number | null) {
  return value !== null;
}

const reviewFields: SnapshotField[] = ["meanings_confirmed", "conceptMergeReviewed"];
const comparisonFields: SnapshotField[] = ["comparedMeaningWordIds", "synonymIds"];
const conceptAudioFields: SnapshotField[] = [
  "concept_explained_fa_audio_file_name",
  "concept_explained_fa_audio_source_text",
];

const POLICIES: Policy[] = [
  {
    key: "meaningId",
    label: "Primary Persian meaning (meaningId)",
    description: "Removes every primary Persian meaning link without deleting shared PersianWord rows.",
    consequences: [
      "Clears otherMeaningIds because alternate meanings require a primary meaning.",
      "Sets AI meaning review and concept merge review to pending.",
      "Clears comparison and synonym results derived from the old meaning groups.",
    ],
    snapshotFields: ["meaningId", "otherMeaningIds", ...reviewFields, ...comparisonFields],
    clearData: {
      meaningId: null,
      otherMeaningIds: Prisma.DbNull,
      meanings_confirmed: false,
      conceptMergeReviewed: false,
      comparedMeaningWordIds: Prisma.DbNull,
      synonymIds: Prisma.DbNull,
    },
    isAffected: (row) => row.meaningId !== null,
  },
  {
    key: "otherMeaningIds",
    label: "Other Persian meanings (otherMeaningIds)",
    description: "Removes every alternate Persian meaning link.",
    consequences: [
      "Sets AI meaning review and concept merge review to pending.",
      "Clears comparison and synonym results derived from the old meaning groups.",
    ],
    snapshotFields: ["otherMeaningIds", ...reviewFields, ...comparisonFields],
    clearData: {
      otherMeaningIds: Prisma.DbNull,
      meanings_confirmed: false,
      conceptMergeReviewed: false,
      comparedMeaningWordIds: Prisma.DbNull,
      synonymIds: Prisma.DbNull,
    },
    isAffected: (row) => hasJsonValue(row.otherMeaningIds),
  },
  {
    key: "sentenceIds",
    label: "Sentence links (sentenceIds)",
    description: "Unlinks every Word from its sentences without deleting shared Sentence rows.",
    consequences: ["Sets AI meaning review and concept merge review to pending."],
    snapshotFields: ["sentenceIds", ...reviewFields],
    clearData: {
      sentenceIds: Prisma.DbNull,
      meanings_confirmed: false,
      conceptMergeReviewed: false,
    },
    isAffected: (row) => hasJsonValue(row.sentenceIds),
  },
  {
    key: "conceptMergeReviewed",
    label: "Concept merge review status",
    description: "Marks every reviewed Word concept as pending again.",
    consequences: ["Does not remove meanings or concept text."],
    snapshotFields: ["conceptMergeReviewed"],
    clearData: { conceptMergeReviewed: false },
    isAffected: (row) => row.conceptMergeReviewed,
  },
  {
    key: "meanings_confirmed",
    label: "AI meaning review status",
    description: "Marks every AI-reviewed meaning as pending again.",
    consequences: ["Does not remove primary or alternate meaning links."],
    snapshotFields: ["meanings_confirmed"],
    clearData: { meanings_confirmed: false },
    isAffected: (row) => row.meanings_confirmed,
  },
  {
    key: "pos",
    label: "Part of speech (pos)",
    description: "Clears all part-of-speech values.",
    consequences: [
      "Sets AI meaning review and concept merge review to pending.",
      "Clears comparison and synonym results that used the old part of speech.",
    ],
    snapshotFields: ["pos", ...reviewFields, ...comparisonFields],
    clearData: {
      pos: null,
      meanings_confirmed: false,
      conceptMergeReviewed: false,
      comparedMeaningWordIds: Prisma.DbNull,
      synonymIds: Prisma.DbNull,
    },
    isAffected: (row) => hasText(row.pos),
  },
  {
    key: "concept_explained_fa",
    label: "Persian concept explanation",
    description: "Clears every concept_explained_fa value.",
    consequences: [
      "Sets AI meaning review and concept merge review to pending.",
      "Clears comparison and synonym results derived from the old concept text.",
      "Clears concept-audio metadata and moves owned audio files to the recovery quarantine.",
    ],
    snapshotFields: [
      "concept_explained_fa",
      ...reviewFields,
      ...comparisonFields,
      ...conceptAudioFields,
    ],
    clearData: {
      concept_explained_fa: null,
      meanings_confirmed: false,
      conceptMergeReviewed: false,
      comparedMeaningWordIds: Prisma.DbNull,
      synonymIds: Prisma.DbNull,
      concept_explained_fa_audio_file_name: null,
      concept_explained_fa_audio_source_text: null,
    },
    isAffected: (row) => hasText(row.concept_explained_fa),
    quarantinesConceptAudio: true,
  },
  {
    key: "concept_audio",
    label: "Concept audio",
    description: "Clears concept-audio filename/source metadata as one owned-audio unit.",
    consequences: ["Moves existing owned audio files to the recovery quarantine."],
    snapshotFields: [...conceptAudioFields],
    clearData: {
      concept_explained_fa_audio_file_name: null,
      concept_explained_fa_audio_source_text: null,
    },
    isAffected: (row) =>
      hasText(row.concept_explained_fa_audio_file_name) ||
      hasText(row.concept_explained_fa_audio_source_text),
    quarantinesConceptAudio: true,
  },
  {
    key: "comparedMeaningWordIds",
    label: "Meaning comparison cache",
    description: "Clears the record of Word pairs that have already been compared.",
    consequences: ["Makes eligible meaning groups available to the comparison workflow again."],
    snapshotFields: ["comparedMeaningWordIds"],
    clearData: { comparedMeaningWordIds: Prisma.DbNull },
    isAffected: (row) => hasJsonValue(row.comparedMeaningWordIds),
  },
  {
    key: "synonymIds",
    label: "Confirmed synonym relationships",
    description: "Clears every confirmed Word synonym relationship.",
    consequences: ["Also clears the comparison cache so removed relationships can be reviewed again."],
    snapshotFields: ["synonymIds", "comparedMeaningWordIds"],
    clearData: { synonymIds: Prisma.DbNull, comparedMeaningWordIds: Prisma.DbNull },
    isAffected: (row) => hasJsonValue(row.synonymIds),
  },
  {
    key: "learning_depth",
    label: "Learning depth",
    description: "Sets every populated learning_depth value to NULL.",
    consequences: ["The extraction workflow will treat the values as missing."],
    snapshotFields: ["learning_depth"],
    clearData: { learning_depth: null },
    isAffected: (row) => hasNumber(row.learning_depth),
  },
  {
    key: "other_meanings_en",
    label: "Other English meanings",
    description: "Sets every populated other_meanings_en value to NULL.",
    consequences: [],
    snapshotFields: ["other_meanings_en"],
    clearData: { other_meanings_en: null },
    isAffected: (row) => hasText(row.other_meanings_en),
  },
  {
    key: "category",
    label: "Category",
    description: "Sets every populated category value to NULL.",
    consequences: [],
    snapshotFields: ["category"],
    clearData: { category: null },
    isAffected: (row) => hasText(row.category),
  },
  {
    key: "hint_to_select",
    label: "Selection hint",
    description: "Sets every populated hint_to_select value to NULL.",
    consequences: [],
    snapshotFields: ["hint_to_select"],
    clearData: { hint_to_select: null },
    isAffected: (row) => hasText(row.hint_to_select),
  },
  {
    key: "imageability",
    label: "Imageability",
    description: "Sets every populated imageability score to NULL.",
    consequences: ["The extraction workflow will treat the values as missing."],
    snapshotFields: ["imageability"],
    clearData: { imageability: null },
    isAffected: (row) => hasNumber(row.imageability),
  },
  {
    key: "productive_target",
    label: "Productive target",
    description: "Sets every populated productive_target score to NULL.",
    consequences: ["The extraction workflow will treat the values as missing."],
    snapshotFields: ["productive_target"],
    clearData: { productive_target: null },
    isAffected: (row) => hasNumber(row.productive_target),
  },
];

const policyByKey = new Map(POLICIES.map((policy) => [policy.key, policy]));

type InformationalSelection = {
  key: string;
  label: string;
  kind: "managed" | "protected";
  description: string;
  consequences: string[];
  managedBy?: WordMaintenanceField;
};

const INFORMATIONAL_SELECTIONS: InformationalSelection[] = [
  {
    key: "concept_explained_fa_audio_file_name",
    label: "concept_explained_fa_audio_file_name",
    kind: "managed",
    description: "This filename is owned by the Concept audio bundle and cannot be cleared independently.",
    consequences: [
      "A filename without its source text would leave incomplete audio provenance.",
      "Use Concept audio to clear both metadata columns and quarantine the physical file together.",
      "Clearing Persian concept explanation also clears the complete Concept audio bundle because the audio is derived from that text.",
    ],
    managedBy: "concept_audio",
  },
  {
    key: "concept_explained_fa_audio_source_text",
    label: "concept_explained_fa_audio_source_text",
    kind: "managed",
    description: "This source text is owned by the Concept audio bundle and cannot be cleared independently.",
    consequences: [
      "The source text records exactly what the current audio was generated or recorded from.",
      "Clearing it alone would break stale-audio detection and make safe regeneration ambiguous.",
      "Use Concept audio to clear the filename, source text, and physical file as one recoverable operation.",
    ],
    managedBy: "concept_audio",
  },
  {
    key: "id",
    label: "id",
    kind: "protected",
    description: "Word.id is the primary key and cannot be cleared.",
    consequences: ["Other records and relationship arrays use this stable identity. Delete or merge a Word through its dedicated workflow instead."],
  },
  {
    key: "englishId",
    label: "englishId",
    kind: "protected",
    description: "englishId is a required foreign key and cannot be cleared.",
    consequences: ["A Word cannot exist without its EnglishWord. Use the Word delete/merge or EnglishWord management workflow instead."],
  },
  {
    key: "anki_link_id",
    label: "anki_link_id",
    kind: "protected",
    description: "anki_link_id is the required unique sync identity and cannot be cleared.",
    consequences: ["Clearing it would break Word-to-Anki synchronization and uniqueness guarantees. Repair it through the dedicated Anki-link workflow."],
  },
  {
    key: "createdAt",
    label: "createdAt",
    kind: "protected",
    description: "createdAt is required audit metadata and cannot be cleared.",
    consequences: ["It records when the Word was created and is not user-maintained content."],
  },
  {
    key: "updatedAt",
    label: "updatedAt",
    kind: "protected",
    description: "updatedAt is a required, system-managed synchronization timestamp and cannot be cleared.",
    consequences: ["Prisma refreshes it automatically whenever Word data changes; manually clearing it would break change tracking."],
  },
];

const informationalSelectionByKey = new Map(
  INFORMATIONAL_SELECTIONS.map((selection) => [selection.key, selection]),
);

export type WordMaintenanceSelectionKey =
  | WordMaintenanceField
  | "concept_explained_fa_audio_file_name"
  | "concept_explained_fa_audio_source_text"
  | "id"
  | "englishId"
  | "anki_link_id"
  | "createdAt"
  | "updatedAt";

export function isWordMaintenanceField(value: unknown): value is WordMaintenanceField {
  return typeof value === "string" && policyByKey.has(value as WordMaintenanceField);
}

export function isWordMaintenanceSelectionKey(value: unknown): value is WordMaintenanceSelectionKey {
  return isWordMaintenanceField(value) ||
    (typeof value === "string" && informationalSelectionByKey.has(value));
}

export function listWordMaintenancePolicies() {
  return [
    ...POLICIES.map(({ key, label, description, consequences }) => ({
      key,
      label,
      kind: "action" as const,
      description,
      consequences,
      managedBy: null,
      managedByLabel: null,
    })),
    ...INFORMATIONAL_SELECTIONS.map((selection) => ({
      ...selection,
      managedBy: selection.managedBy ?? null,
      managedByLabel: selection.managedBy
        ? policyByKey.get(selection.managedBy)?.label ?? selection.managedBy
        : null,
    })),
  ];
}

function getPolicy(field: WordMaintenanceField) {
  const policy = policyByKey.get(field);
  if (!policy) throw new Error(`Unsupported Word maintenance field: ${field}`);
  return policy;
}

async function affectedRows(policy: Policy) {
  const rows = await prisma.word.findMany({ select: WORD_MAINTENANCE_SELECT, orderBy: { id: "asc" } });
  return rows.filter(policy.isAffected);
}

function confirmationText(field: WordMaintenanceField, count: number) {
  return `CLEAR Word.${field} ${count}`;
}

function audioStats(rows: MaintenanceWord[], policy: Policy) {
  if (!policy.quarantinesConceptAudio) return { fileCount: 0, bytes: 0 };
  const seen = new Set<string>();
  let fileCount = 0;
  let bytes = 0;
  for (const row of rows) {
    const filename = row.concept_explained_fa_audio_file_name;
    if (!filename || seen.has(filename)) continue;
    seen.add(filename);
    let size = 0;
    try {
      size = statSync(getWordConceptAudioAbsolutePath(filename)).size;
    } catch {
      size = 0;
    }
    if (size <= 0) continue;
    fileCount += 1;
    bytes += size;
  }
  return { fileCount, bytes };
}

export async function previewWordFieldMaintenance(field: WordMaintenanceField) {
  const policy = getPolicy(field);
  const rows = await affectedRows(policy);
  return {
    mode: "action" as const,
    field,
    label: policy.label,
    description: policy.description,
    consequences: policy.consequences,
    affectedRows: rows.length,
    aiMeaningReviewsReset: rows.filter((row) =>
      row.meanings_confirmed && policy.clearData.meanings_confirmed === false,
    ).length,
    conceptMergeReviewsReset: rows.filter((row) =>
      row.conceptMergeReviewed && policy.clearData.conceptMergeReviewed === false,
    ).length,
    ...audioStats(rows, policy),
    confirmationText: confirmationText(field, rows.length),
  };
}

export async function previewWordFieldSelection(field: WordMaintenanceSelectionKey) {
  if (isWordMaintenanceField(field)) return previewWordFieldMaintenance(field);
  const selection = informationalSelectionByKey.get(field);
  if (!selection) throw new Error(`Unsupported Word maintenance selection: ${field}`);
  const managedPolicy = selection.managedBy ? getPolicy(selection.managedBy) : null;
  return {
    mode: "guide" as const,
    field,
    label: selection.label,
    kind: selection.kind,
    description: selection.description,
    consequences: selection.consequences,
    managedBy: managedPolicy?.key ?? null,
    managedByLabel: managedPolicy?.label ?? null,
  };
}

function operationQuarantineDir(operationId: string) {
  return path.join(process.cwd(), "backups", "field-maintenance", "word", operationId, "concept-audio");
}

function safeFilename(filename: string | null) {
  return filename && path.basename(filename) === filename ? filename : null;
}

async function exists(filePath: string) {
  return access(filePath).then(() => true, () => false);
}

type MovedFile = { original: string; quarantined: string };

async function quarantineConceptAudio(operationId: string, rows: MaintenanceWord[]) {
  const destinationDir = operationQuarantineDir(operationId);
  const moved: MovedFile[] = [];
  const seen = new Set<string>();
  try {
    for (const row of rows) {
      const filename = safeFilename(row.concept_explained_fa_audio_file_name);
      if (!filename || seen.has(filename)) continue;
      seen.add(filename);
      const original = getWordConceptAudioAbsolutePath(filename);
      if (!(await exists(original))) continue;
      await mkdir(destinationDir, { recursive: true });
      const quarantined = path.join(destinationDir, filename);
      if (await exists(quarantined)) throw new Error(`Quarantine already contains ${filename}.`);
      await rename(original, quarantined);
      moved.push({ original, quarantined });
    }
    return moved;
  } catch (error) {
    await restoreMovedFiles(moved);
    throw error;
  }
}

async function restoreMovedFiles(moved: MovedFile[]) {
  for (const file of [...moved].reverse()) {
    if (!(await exists(file.quarantined))) continue;
    await mkdir(path.dirname(file.original), { recursive: true });
    await rename(file.quarantined, file.original);
  }
}

async function moveQuarantinedFilesBack(operationId: string, rows: MaintenanceWord[]) {
  const moved: MovedFile[] = [];
  const seen = new Set<string>();
  try {
    for (const row of rows) {
      const filename = safeFilename(row.concept_explained_fa_audio_file_name);
      if (!filename || seen.has(filename)) continue;
      seen.add(filename);
      const original = getWordConceptAudioAbsolutePath(filename);
      const quarantined = path.join(operationQuarantineDir(operationId), filename);
      if (!(await exists(quarantined))) continue;
      if (await exists(original)) throw new Error(`Cannot restore ${filename}; an active file already exists.`);
      await mkdir(path.dirname(original), { recursive: true });
      await rename(quarantined, original);
      moved.push({ original: quarantined, quarantined: original });
    }
    return moved;
  } catch (error) {
    await restoreMovedFiles(moved);
    throw error;
  }
}

function snapshotData(row: MaintenanceWord, fields: SnapshotField[]): Prisma.InputJsonObject {
  return Object.fromEntries(fields.map((field) => [field, row[field]])) as Prisma.InputJsonObject;
}

function activeJobNames() {
  return Object.entries(getJobProgressSnapshot())
    .filter(([, status]) =>
      Boolean(status && typeof status === "object" && "running" in status && status.running),
    )
    .map(([name]) => name);
}

function assertNoRunningJobs() {
  const names = activeJobNames();
  if (names.length) {
    throw new Error(`Field maintenance is blocked while background jobs are running: ${names.join(", ")}`);
  }
}

const maintenanceState = globalThis as typeof globalThis & { __wordFieldMaintenanceRunning?: boolean };

async function withMaintenanceLock<T>(work: () => Promise<T>) {
  if (maintenanceState.__wordFieldMaintenanceRunning) {
    throw new Error("Another Word field maintenance operation is already running.");
  }
  maintenanceState.__wordFieldMaintenanceRunning = true;
  try {
    return await work();
  } finally {
    maintenanceState.__wordFieldMaintenanceRunning = false;
  }
}

export async function executeWordFieldMaintenance(args: {
  field: WordMaintenanceField;
  expectedAffectedRows: number;
  confirmation: string;
}) {
  return withMaintenanceLock(async () => {
    assertNoRunningJobs();
    const policy = getPolicy(args.field);
    const rows = await affectedRows(policy);
    const expectedConfirmation = confirmationText(args.field, rows.length);
    if (rows.length !== args.expectedAffectedRows) {
      throw new Error("The affected-row count changed. Refresh the preview before continuing.");
    }
    if (args.confirmation !== expectedConfirmation) {
      throw new Error(`Confirmation text must exactly match: ${expectedConfirmation}`);
    }
    if (!rows.length) throw new Error("This field has no populated values to clear.");

    const operationId = randomUUID();
    const moved = policy.quarantinesConceptAudio
      ? await quarantineConceptAudio(operationId, rows)
      : [];
    try {
      await prisma.$transaction(async (tx) => {
        await tx.wordFieldMaintenanceOperation.create({
          data: {
            id: operationId,
            field: policy.key,
            label: policy.label,
            affectedRows: rows.length,
            status: "completed",
          },
        });
        await tx.wordFieldMaintenanceSnapshot.createMany({
          data: rows.map((row) => ({
            operationId,
            wordId: row.id,
            data: snapshotData(row, policy.snapshotFields),
          })),
        });
        await updateManyWords(
          { where: { id: { in: rows.map((row) => row.id) } }, data: policy.clearData },
          tx,
        );
      }, { maxWait: 10_000, timeout: 120_000 });
    } catch (error) {
      await restoreMovedFiles(moved);
      throw error;
    }
    return { operationId, affectedRows: rows.length, quarantinedFiles: moved.length };
  });
}

function snapshotToWord(row: { wordId: number; data: Prisma.JsonValue }): MaintenanceWord {
  if (!row.data || typeof row.data !== "object" || Array.isArray(row.data)) {
    throw new Error(`Invalid recovery snapshot for Word ${row.wordId}.`);
  }
  return { id: row.wordId, ...(row.data as Record<string, unknown>) } as MaintenanceWord;
}

function restoreData(data: Prisma.JsonValue): Prisma.WordUncheckedUpdateInput {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Invalid Word field maintenance snapshot data.");
  }
  const jsonFields = new Set(["otherMeaningIds", "comparedMeaningWordIds", "synonymIds", "sentenceIds"]);
  return Object.fromEntries(Object.entries(data).map(([key, value]) => [
    key,
    jsonFields.has(key) && value === null ? Prisma.DbNull : value,
  ])) as Prisma.WordUncheckedUpdateInput;
}

export async function undoWordFieldMaintenance(operationId: string) {
  return withMaintenanceLock(async () => {
    assertNoRunningJobs();
    const latest = await prisma.wordFieldMaintenanceOperation.findFirst({
      where: { status: "completed" },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    if (!latest || latest.id !== operationId) {
      throw new Error("Only the latest completed maintenance operation can be undone.");
    }
    const operation = await prisma.wordFieldMaintenanceOperation.findUnique({
      where: { id: operationId },
      include: { snapshots: { orderBy: { wordId: "asc" } } },
    });
    if (!operation || operation.status !== "completed") {
      throw new Error("This maintenance operation is not available for undo.");
    }
    if (!isWordMaintenanceField(operation.field)) {
      throw new Error(`Unsupported archived maintenance field: ${operation.field}`);
    }
    const policy = getPolicy(operation.field);
    const snapshotWords = operation.snapshots.map(snapshotToWord);
    const moved = policy.quarantinesConceptAudio
      ? await moveQuarantinedFilesBack(operation.id, snapshotWords)
      : [];
    try {
      await prisma.$transaction(async (tx) => {
        for (const snapshot of operation.snapshots) {
          await updateWord(
            { where: { id: snapshot.wordId }, data: restoreData(snapshot.data), select: { id: true } },
            tx,
          );
        }
        await tx.wordFieldMaintenanceOperation.update({
          where: { id: operation.id },
          data: { status: "undone", undoneAt: new Date() },
        });
      }, { maxWait: 10_000, timeout: 120_000 });
    } catch (error) {
      await restoreMovedFiles(moved);
      throw error;
    }
    return { operationId: operation.id, restoredRows: operation.snapshots.length, restoredFiles: moved.length };
  });
}

export async function listWordFieldMaintenanceOperations(limit = 8) {
  const operations = await prisma.wordFieldMaintenanceOperation.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      field: true,
      label: true,
      affectedRows: true,
      status: true,
      createdAt: true,
      undoneAt: true,
    },
  });
  const latestCompletedId = operations.find((operation) => operation.status === "completed")?.id ?? null;
  return operations.map((operation) => ({
    ...operation,
    createdAt: operation.createdAt.toISOString(),
    undoneAt: operation.undoneAt?.toISOString() ?? null,
    canUndo: operation.id === latestCompletedId,
  }));
}
