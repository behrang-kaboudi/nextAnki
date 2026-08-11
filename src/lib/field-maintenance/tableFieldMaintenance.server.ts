import "server-only";

import { randomUUID } from "node:crypto";
import { statSync } from "node:fs";
import { access, mkdir, rename } from "node:fs/promises";
import path from "node:path";

import { Prisma } from "@prisma/client";

import { getEnglishWordAudioAbsolutePath } from "@/lib/audio/englishWordAudioPaths.server";
import { getPersianWordAudioAbsolutePath } from "@/lib/audio/persianWordAudioPaths.server";
import { getSentenceAudioAbsolutePath } from "@/lib/audio/sentenceAudioPaths.server";
import { getJobProgressSnapshot } from "@/lib/progress/jobProgressCatalog";
import { prisma } from "@/lib/prisma";
import { touchWordsByEnglishIds, touchWordsByIds, updateManyWords } from "@/lib/words/wordRepo";
import { wordSentenceIds } from "@/lib/words/sentenceIds";

export const TABLE_MAINTENANCE_MODELS = ["EnglishWord", "PersianWord", "Sentence"] as const;
export type TableMaintenanceModel = (typeof TABLE_MAINTENANCE_MODELS)[number];

type FieldKind = "action" | "managed" | "protected";
type FieldPolicy = {
  key: string;
  label: string;
  kind: FieldKind;
  description: string;
  consequences: string[];
  managedBy: string | null;
  managedByLabel: string | null;
};

type ActionPolicy = FieldPolicy & {
  kind: "action";
  snapshotFields: string[];
  clearData: Record<string, unknown>;
  audioFilenameField?: string;
  audioPath?: (filename: string) => string;
  resetLinkedReviews?: boolean;
};

const action = (
  policy: Omit<ActionPolicy, "kind" | "managedBy" | "managedByLabel">,
): ActionPolicy => ({ ...policy, kind: "action", managedBy: null, managedByLabel: null });
const managed = (key: string, label: string, managedBy: string, managedByLabel: string, description: string, consequences: string[] = []): FieldPolicy => ({
  key, label, kind: "managed", description, consequences, managedBy, managedByLabel,
});
const protectedField = (key: string, label: string, description: string): FieldPolicy => ({
  key, label, kind: "protected", description, consequences: ["This field has no safe table-wide clear operation."], managedBy: null, managedByLabel: null,
});

const CONFIG: Record<TableMaintenanceModel, { label: string; fields: FieldPolicy[] }> = {
  EnglishWord: {
    label: "EnglishWord",
    fields: [
      protectedField("id", "id", "Primary keys identify records and cannot be cleared."),
      protectedField("base_form", "base_form", "Every EnglishWord requires a unique base form, and Word records depend on this relation."),
      action({
        key: "phonetic_us", label: "US phonetic (phonetic_us)",
        description: "Clears the source US phonetic plus its normalized and JSON-hint derivatives.",
        consequences: ["Clears phonetic_us_normalized and json_hint because both are derived from the source pronunciation.", "Touches linked Word rows so Anki sync sees the change."],
        snapshotFields: ["phonetic_us", "phonetic_us_normalized", "json_hint"],
        clearData: { phonetic_us: null, phonetic_us_normalized: null, json_hint: null },
      }),
      managed("phonetic_us_normalized", "phonetic_us_normalized", "phonetic_us", "US phonetic (phonetic_us)", "This normalized value is derived from phonetic_us and is cleared through its source-field policy."),
      action({
        key: "json_hint", label: "JSON pronunciation hint (json_hint)",
        description: "Clears generated JSON pronunciation hints without changing the source phonetic.",
        consequences: ["Touches linked Word rows so Anki sync sees the change."],
        snapshotFields: ["json_hint"], clearData: { json_hint: null },
      }),
      action({
        key: "audio", label: "EnglishWord audio",
        description: "Clears audio filename/source metadata as one owned-audio unit.",
        consequences: ["Moves existing owned audio files to the recovery quarantine.", "Touches linked Word rows so Anki sync sees the change."],
        snapshotFields: ["audio_file_name", "audio_source_text"], clearData: { audio_file_name: null, audio_source_text: null },
        audioFilenameField: "audio_file_name", audioPath: getEnglishWordAudioAbsolutePath,
      }),
      managed("audio_file_name", "audio_file_name", "audio", "EnglishWord audio", "The filename, source text, and physical file form one owned-audio bundle."),
      managed("audio_source_text", "audio_source_text", "audio", "EnglishWord audio", "Source text is required for stale-audio detection, so it is cleared with the filename and physical file."),
      protectedField("createdAt", "createdAt", "Creation timestamps are required audit metadata."),
      protectedField("updatedAt", "updatedAt", "Update timestamps are required sync and audit metadata."),
    ],
  },
  PersianWord: {
    label: "PersianWord",
    fields: [
      protectedField("id", "id", "Primary keys identify records and cannot be cleared."),
      protectedField("canonical_text", "canonical_text", "Every PersianWord requires canonical text; Word meaning links depend on this record."),
      protectedField("normalized_text", "normalized_text", "This required lookup key is derived from canonical_text and cannot be blanked table-wide."),
      action({
        key: "not_normalized_texts", label: "Alternate spellings (not_normalized_texts)",
        description: "Replaces every populated alternate-spelling array with an empty array.",
        consequences: ["Touches Word rows that reference the affected PersianWord records."],
        snapshotFields: ["not_normalized_texts"], clearData: { not_normalized_texts: [] },
      }),
      action({
        key: "meaning_fa_IPA", label: "Persian meaning IPA (meaning_fa_IPA)",
        description: "Clears source Persian IPA and its normalized derivative.",
        consequences: ["Clears meaning_fa_IPA_normalize because it is derived from the source IPA.", "Touches Word rows that reference the affected PersianWord records."],
        snapshotFields: ["meaning_fa_IPA", "meaning_fa_IPA_normalize"], clearData: { meaning_fa_IPA: null, meaning_fa_IPA_normalize: null },
      }),
      managed("meaning_fa_IPA_normalize", "meaning_fa_IPA_normalize", "meaning_fa_IPA", "Persian meaning IPA (meaning_fa_IPA)", "This normalized value is derived from meaning_fa_IPA and is cleared through its source-field policy."),
      action({
        key: "audio", label: "PersianWord audio",
        description: "Clears audio filename/source metadata as one owned-audio unit.",
        consequences: ["Moves existing owned audio files to the recovery quarantine.", "Touches Word rows that reference the affected PersianWord records."],
        snapshotFields: ["audio_file_name", "audio_source_text"], clearData: { audio_file_name: null, audio_source_text: null },
        audioFilenameField: "audio_file_name", audioPath: getPersianWordAudioAbsolutePath,
      }),
      managed("audio_file_name", "audio_file_name", "audio", "PersianWord audio", "The filename, source text, and physical file form one owned-audio bundle."),
      managed("audio_source_text", "audio_source_text", "audio", "PersianWord audio", "Source text is required for stale-audio detection, so it is cleared with the filename and physical file."),
      protectedField("createdAt", "createdAt", "Creation timestamps are required audit metadata."),
      protectedField("updatedAt", "updatedAt", "Update timestamps are required sync and audit metadata."),
    ],
  },
  Sentence: {
    label: "Sentence",
    fields: [
      protectedField("id", "id", "Primary keys identify records and cannot be cleared."),
      protectedField("sentence_en", "sentence_en", "Every Sentence requires unique English text, and Word sentence links depend on it."),
      action({
        key: "sentence_en_meaning_fa", label: "Persian sentence meaning (sentence_en_meaning_fa)",
        description: "Clears only the Persian sentence translations while preserving their existing audio metadata and files for comparison.",
        consequences: ["Keeps Persian meaning audio filename, source text, and physical files unchanged.", "Sets AI meaning review and concept merge review to pending on linked Word rows."],
        snapshotFields: ["sentence_en_meaning_fa"],
        clearData: { sentence_en_meaning_fa: null },
        resetLinkedReviews: true,
      }),
      action({
        key: "sentence_en_audio", label: "English sentence audio",
        description: "Clears English sentence audio filename/source metadata as one owned-audio unit.",
        consequences: ["Moves existing owned audio files to the recovery quarantine.", "Touches linked Word rows so Anki sync sees the change."],
        snapshotFields: ["sentence_en_audio_file_name", "sentence_en_audio_source_text"],
        clearData: { sentence_en_audio_file_name: null, sentence_en_audio_source_text: null },
        audioFilenameField: "sentence_en_audio_file_name", audioPath: getSentenceAudioAbsolutePath,
      }),
      managed("sentence_en_audio_file_name", "sentence_en_audio_file_name", "sentence_en_audio", "English sentence audio", "The filename, source text, and physical file form one owned-audio bundle."),
      managed("sentence_en_audio_source_text", "sentence_en_audio_source_text", "sentence_en_audio", "English sentence audio", "Source text is required for stale-audio detection, so it is cleared with the filename and physical file."),
      action({
        key: "sentence_en_meaning_fa_audio", label: "Persian sentence-meaning audio",
        description: "Clears Persian sentence-meaning audio filename/source metadata as one owned-audio unit.",
        consequences: ["Moves existing owned audio files to the recovery quarantine.", "Touches linked Word rows so Anki sync sees the change."],
        snapshotFields: ["sentence_en_meaning_fa_audio_file_name", "sentence_en_meaning_fa_audio_source_text"],
        clearData: { sentence_en_meaning_fa_audio_file_name: null, sentence_en_meaning_fa_audio_source_text: null },
        audioFilenameField: "sentence_en_meaning_fa_audio_file_name", audioPath: getSentenceAudioAbsolutePath,
      }),
      managed("sentence_en_meaning_fa_audio_file_name", "sentence_en_meaning_fa_audio_file_name", "sentence_en_meaning_fa_audio", "Persian sentence-meaning audio", "The filename, source text, and physical file form one owned-audio bundle."),
      managed("sentence_en_meaning_fa_audio_source_text", "sentence_en_meaning_fa_audio_source_text", "sentence_en_meaning_fa_audio", "Persian sentence-meaning audio", "Source text is required for stale-audio detection, so it is cleared with the filename and physical file."),
      protectedField("createdAt", "createdAt", "Creation timestamps are required audit metadata."),
      protectedField("updatedAt", "updatedAt", "Update timestamps are required sync and audit metadata."),
    ],
  },
};

export function isTableMaintenanceModel(value: unknown): value is TableMaintenanceModel {
  return typeof value === "string" && TABLE_MAINTENANCE_MODELS.includes(value as TableMaintenanceModel);
}

export function listTableMaintenancePolicies(model: TableMaintenanceModel) {
  return CONFIG[model].fields;
}

export function isTableMaintenanceSelection(model: TableMaintenanceModel, value: unknown): value is string {
  return typeof value === "string" && CONFIG[model].fields.some((field) => field.key === value);
}

function getActionPolicy(model: TableMaintenanceModel, field: string) {
  const policy = CONFIG[model].fields.find((item) => item.key === field);
  if (!policy || policy.kind !== "action") throw new Error(`Unsupported ${model} maintenance field: ${field}`);
  return policy as ActionPolicy;
}

type MaintenanceRow = { id: number; [key: string]: unknown };
type LinkedWord = { id: number; meanings_confirmed: boolean; conceptMergeReviewed: boolean };

function isPopulated(value: unknown) {
  if (value == null) return false;
  if (typeof value === "string") return Boolean(value.trim());
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

async function loadAffectedRows(model: TableMaintenanceModel, policy: ActionPolicy): Promise<MaintenanceRow[]> {
  const select = Object.fromEntries(["id", ...policy.snapshotFields].map((field) => [field, true]));
  const rows = model === "EnglishWord"
    ? await prisma.englishWord.findMany({ select: select as Prisma.EnglishWordSelect })
    : model === "PersianWord"
      ? await prisma.persianWord.findMany({ select: select as Prisma.PersianWordSelect })
      : await prisma.sentence.findMany({ select: select as Prisma.SentenceSelect });
  return (rows as MaintenanceRow[]).filter((row) => policy.snapshotFields.some((field) => isPopulated(row[field])));
}

async function linkedWords(model: TableMaintenanceModel, recordIds: readonly number[]): Promise<LinkedWord[]> {
  if (!recordIds.length) return [];
  if (model === "EnglishWord") {
    return prisma.word.findMany({ where: { englishId: { in: [...recordIds] } }, select: { id: true, meanings_confirmed: true, conceptMergeReviewed: true } });
  }
  const records = await prisma.word.findMany({ select: { id: true, meaningId: true, otherMeaningIds: true, sentenceIds: true, meanings_confirmed: true, conceptMergeReviewed: true } });
  const ids = new Set(recordIds);
  return records.filter((word) => model === "PersianWord"
    ? (word.meaningId !== null && ids.has(word.meaningId)) || (Array.isArray(word.otherMeaningIds) && word.otherMeaningIds.some((id) => {
      const numericId = typeof id === "number" ? id : typeof id === "string" ? Number(id) : Number.NaN;
      return Number.isSafeInteger(numericId) && ids.has(numericId);
    }))
    : wordSentenceIds(word.sentenceIds).some((id) => ids.has(id)));
}

function confirmationText(model: TableMaintenanceModel, field: string, count: number) {
  return `CLEAR ${model}.${field} ${count}`;
}

function safeFilename(value: unknown) {
  return typeof value === "string" && value.trim() && path.basename(value) === value ? value : null;
}

function audioStats(rows: MaintenanceRow[], policy: ActionPolicy) {
  if (!policy.audioFilenameField || !policy.audioPath) return { fileCount: 0, bytes: 0 };
  let fileCount = 0;
  let bytes = 0;
  const seen = new Set<string>();
  for (const row of rows) {
    const filename = safeFilename(row[policy.audioFilenameField]);
    if (!filename || seen.has(filename)) continue;
    seen.add(filename);
    try {
      const size = statSync(policy.audioPath(filename)).size;
      if (size > 0) { fileCount += 1; bytes += size; }
    } catch { /* Missing files have no quarantine impact. */ }
  }
  return { fileCount, bytes };
}

export async function previewTableFieldSelection(model: TableMaintenanceModel, field: string) {
  const selected = CONFIG[model].fields.find((item) => item.key === field);
  if (!selected) throw new Error(`Unsupported ${model} maintenance field: ${field}`);
  if (selected.kind !== "action") return { mode: "guide" as const, ...selected };
  const policy = selected as ActionPolicy;
  const rows = await loadAffectedRows(model, policy);
  const related = await linkedWords(model, rows.map((row) => row.id));
  return {
    mode: "action" as const,
    field, label: policy.label, description: policy.description, consequences: policy.consequences,
    affectedRows: rows.length,
    aiMeaningReviewsReset: policy.resetLinkedReviews ? related.filter((word) => word.meanings_confirmed).length : 0,
    conceptMergeReviewsReset: policy.resetLinkedReviews ? related.filter((word) => word.conceptMergeReviewed).length : 0,
    ...audioStats(rows, policy),
    confirmationText: confirmationText(model, field, rows.length),
  };
}

function activeJobNames() {
  return Object.entries(getJobProgressSnapshot()).filter(([, status]) => Boolean(status && typeof status === "object" && "running" in status && status.running)).map(([name]) => name);
}

function assertNoRunningJobs() {
  const names = activeJobNames();
  if (names.length) throw new Error(`Field maintenance is blocked while background jobs are running: ${names.join(", ")}`);
}

const state = globalThis as typeof globalThis & { __tableFieldMaintenanceRunning?: boolean };
async function withLock<T>(work: () => Promise<T>) {
  if (state.__tableFieldMaintenanceRunning) throw new Error("Another table field maintenance operation is already running.");
  state.__tableFieldMaintenanceRunning = true;
  try { return await work(); } finally { state.__tableFieldMaintenanceRunning = false; }
}

function quarantineDir(model: TableMaintenanceModel, operationId: string) {
  return path.join(process.cwd(), "backups", "field-maintenance", model.toLowerCase(), operationId, "audio");
}

async function exists(filePath: string) { return access(filePath).then(() => true, () => false); }
type MovedFile = { original: string; quarantined: string };
async function restoreMoves(moved: MovedFile[]) {
  for (const file of [...moved].reverse()) {
    if (!(await exists(file.quarantined))) continue;
    await mkdir(path.dirname(file.original), { recursive: true });
    await rename(file.quarantined, file.original);
  }
}

async function quarantineAudio(model: TableMaintenanceModel, operationId: string, rows: MaintenanceRow[], policy: ActionPolicy) {
  if (!policy.audioFilenameField || !policy.audioPath) return [];
  const moved: MovedFile[] = [];
  const seen = new Set<string>();
  try {
    for (const row of rows) {
      const filename = safeFilename(row[policy.audioFilenameField]);
      if (!filename || seen.has(filename)) continue;
      seen.add(filename);
      const original = policy.audioPath(filename);
      if (!(await exists(original))) continue;
      const destination = path.join(quarantineDir(model, operationId), filename);
      await mkdir(path.dirname(destination), { recursive: true });
      if (await exists(destination)) throw new Error(`Quarantine already contains ${filename}.`);
      await rename(original, destination);
      moved.push({ original, quarantined: destination });
    }
    return moved;
  } catch (error) { await restoreMoves(moved); throw error; }
}

async function restoreAudio(model: TableMaintenanceModel, operationId: string, rows: MaintenanceRow[], policy: ActionPolicy) {
  if (!policy.audioFilenameField || !policy.audioPath) return [];
  const moved: MovedFile[] = [];
  const seen = new Set<string>();
  try {
    for (const row of rows) {
      const filename = safeFilename(row[policy.audioFilenameField]);
      if (!filename || seen.has(filename)) continue;
      seen.add(filename);
      const original = policy.audioPath(filename);
      const quarantined = path.join(quarantineDir(model, operationId), filename);
      if (!(await exists(quarantined))) continue;
      if (await exists(original)) throw new Error(`Cannot restore ${filename}; an active file already exists.`);
      await mkdir(path.dirname(original), { recursive: true });
      await rename(quarantined, original);
      moved.push({ original: quarantined, quarantined: original });
    }
    return moved;
  } catch (error) { await restoreMoves(moved); throw error; }
}

function jsonSnapshot(row: MaintenanceRow, fields: string[], related: LinkedWord[]): Prisma.InputJsonObject {
  return {
    ...Object.fromEntries(fields.map((field) => [field, row[field] ?? null])),
    ...(related.length ? { __linkedWords: related.map((word) => ({ ...word })) } : {}),
  } as Prisma.InputJsonObject;
}

async function updateTargetRows(tx: Prisma.TransactionClient, model: TableMaintenanceModel, ids: number[], data: Record<string, unknown>) {
  if (model === "EnglishWord") await tx.englishWord.updateMany({ where: { id: { in: ids } }, data: data as Prisma.EnglishWordUpdateManyMutationInput });
  else if (model === "PersianWord") await tx.persianWord.updateMany({ where: { id: { in: ids } }, data: data as Prisma.PersianWordUpdateManyMutationInput });
  else await tx.sentence.updateMany({ where: { id: { in: ids } }, data: data as Prisma.SentenceUpdateManyMutationInput });
}

async function touchRelatedWords(tx: Prisma.TransactionClient, model: TableMaintenanceModel, recordIds: number[], related: LinkedWord[], reset: boolean) {
  if (model === "EnglishWord") return touchWordsByEnglishIds(recordIds, tx);
  return touchWordsByIds(related.map((word) => word.id), reset ? { resetConceptMergeReviewed: true, resetMeaningsConfirmed: true } : undefined, tx);
}

export async function executeTableFieldMaintenance(args: { model: TableMaintenanceModel; field: string; expectedAffectedRows: number; confirmation: string }) {
  return withLock(async () => {
    assertNoRunningJobs();
    const policy = getActionPolicy(args.model, args.field);
    const rows = await loadAffectedRows(args.model, policy);
    if (rows.length !== args.expectedAffectedRows) throw new Error("The affected-row count changed. Refresh the preview before continuing.");
    const expected = confirmationText(args.model, args.field, rows.length);
    if (args.confirmation !== expected) throw new Error(`Confirmation text must exactly match: ${expected}`);
    if (!rows.length) throw new Error("This field has no populated values to clear.");
    const related = await linkedWords(args.model, rows.map((row) => row.id));
    const operationId = randomUUID();
    const moved = await quarantineAudio(args.model, operationId, rows, policy);
    try {
      await prisma.$transaction(async (tx) => {
        await tx.tableFieldMaintenanceOperation.create({ data: { id: operationId, model: args.model, field: policy.key, label: policy.label, affectedRows: rows.length } });
        await tx.tableFieldMaintenanceSnapshot.createMany({ data: rows.map((row, index) => ({ operationId, recordId: row.id, data: jsonSnapshot(row, policy.snapshotFields, policy.resetLinkedReviews && index === 0 ? related : []) })) });
        await updateTargetRows(tx, args.model, rows.map((row) => row.id), policy.clearData);
        await touchRelatedWords(tx, args.model, rows.map((row) => row.id), related, Boolean(policy.resetLinkedReviews));
      }, { maxWait: 10_000, timeout: 120_000 });
    } catch (error) { await restoreMoves(moved); throw error; }
    return { operationId, affectedRows: rows.length, quarantinedFiles: moved.length };
  });
}

function parseSnapshot(recordId: number, value: Prisma.JsonValue) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`Invalid recovery snapshot for record ${recordId}.`);
  const { __linkedWords, ...data } = value as Record<string, unknown>;
  const linked = Array.isArray(__linkedWords) ? __linkedWords.filter((item): item is LinkedWord => Boolean(item && typeof item === "object" && "id" in item)) : [];
  return { id: recordId, data, linked };
}

async function restoreTarget(tx: Prisma.TransactionClient, model: TableMaintenanceModel, id: number, data: Record<string, unknown>) {
  if (model === "EnglishWord") await tx.englishWord.update({ where: { id }, data: data as Prisma.EnglishWordUpdateInput });
  else if (model === "PersianWord") await tx.persianWord.update({ where: { id }, data: data as Prisma.PersianWordUpdateInput });
  else await tx.sentence.update({ where: { id }, data: data as Prisma.SentenceUpdateInput });
}

export async function undoTableFieldMaintenance(model: TableMaintenanceModel, operationId: string) {
  return withLock(async () => {
    assertNoRunningJobs();
    const latest = await prisma.tableFieldMaintenanceOperation.findFirst({ where: { model, status: "completed" }, orderBy: { createdAt: "desc" }, select: { id: true } });
    if (!latest || latest.id !== operationId) throw new Error("Only the latest completed maintenance operation for this table can be undone.");
    const operation = await prisma.tableFieldMaintenanceOperation.findFirst({ where: { id: operationId, model }, include: { snapshots: { orderBy: { recordId: "asc" } } } });
    if (!operation || operation.status !== "completed") throw new Error("This maintenance operation is not available for undo.");
    const policy = getActionPolicy(model, operation.field);
    const snapshots = operation.snapshots.map((snapshot) => parseSnapshot(snapshot.recordId, snapshot.data));
    const rows = snapshots.map((snapshot) => ({ id: snapshot.id, ...snapshot.data }));
    const moved = await restoreAudio(model, operation.id, rows, policy);
    try {
      await prisma.$transaction(async (tx) => {
        for (const snapshot of snapshots) await restoreTarget(tx, model, snapshot.id, snapshot.data);
        const linked = new Map<number, LinkedWord>();
        for (const snapshot of snapshots) for (const word of snapshot.linked) linked.set(word.id, word);
        for (const word of linked.values()) {
          await updateManyWords({ where: { id: word.id }, data: { meanings_confirmed: word.meanings_confirmed, conceptMergeReviewed: word.conceptMergeReviewed } }, tx);
        }
        await tx.tableFieldMaintenanceOperation.update({ where: { id: operation.id }, data: { status: "undone", undoneAt: new Date() } });
      }, { maxWait: 10_000, timeout: 120_000 });
    } catch (error) { await restoreMoves(moved); throw error; }
    return { operationId: operation.id, restoredRows: snapshots.length, restoredFiles: moved.length };
  });
}

export async function listTableFieldMaintenanceOperations(model: TableMaintenanceModel, limit = 8) {
  const operations = await prisma.tableFieldMaintenanceOperation.findMany({
    where: { model }, orderBy: { createdAt: "desc" }, take: limit,
    select: { id: true, field: true, label: true, affectedRows: true, status: true, createdAt: true, undoneAt: true },
  });
  const latestCompletedId = operations.find((operation) => operation.status === "completed")?.id ?? null;
  return operations.map((operation) => ({ ...operation, createdAt: operation.createdAt.toISOString(), undoneAt: operation.undoneAt?.toISOString() ?? null, canUndo: operation.id === latestCompletedId }));
}
