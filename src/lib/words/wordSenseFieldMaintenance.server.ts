import "server-only";

import { randomUUID } from "node:crypto";
import { statSync } from "node:fs";
import { access, mkdir, rename } from "node:fs/promises";
import path from "node:path";

import { MeaningReviewStatus, Prisma } from "@prisma/client";

import { getWordSenseConceptAudioAbsolutePath } from "@/lib/audio/wordSenseConceptAudioPaths.server";
import { getPendingWordSenseConceptAudioIds } from "@/lib/audio/wordAudioPending.server";
import { getJobProgressSnapshot } from "@/lib/progress/jobProgressCatalog";
import { prisma } from "@/lib/prisma";
import { wordSentenceIds } from "@/lib/words/sentenceIds";
import {
  analyzeSentenceLinkImpact,
  isIdempotentMaintenanceReplay,
  mergeRestoredSentenceIds,
  missingRequestedIds,
  normalizeWordSenseMaintenanceScope,
  sameSentenceLinkState,
  type NormalizedWordSenseMaintenanceScope,
} from "@/lib/words/wordSenseMaintenanceScope";
import { updateManyWordSenses, updateWordSense } from "@/lib/words/wordSenseRepo";

const WORD_MAINTENANCE_SELECT = {
  id: true,
  meaningId: true,
  otherMeaningIds: true,
  comparedMeaningWordIds: true,
  synonymIds: true,
  sentenceIds: true,
  conceptMergeReviewed: true,
  meaningReviewStatus: true,
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
} satisfies Prisma.WordSenseSelect;

type MaintenanceWordSense = Prisma.WordSenseGetPayload<{ select: typeof WORD_MAINTENANCE_SELECT }>;
type SnapshotField = Exclude<keyof MaintenanceWordSense, "id">;

export type WordMaintenanceField =
  | "meaningId"
  | "otherMeaningIds"
  | "sentenceIds"
  | "conceptMergeReviewed"
  | "meaningReviewStatus"
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
  clearData: Prisma.WordSenseUncheckedUpdateManyInput;
  isAffected: (row: MaintenanceWordSense) => boolean;
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

const reviewFields: SnapshotField[] = ["meaningReviewStatus", "conceptMergeReviewed"];
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
      meaningReviewStatus: MeaningReviewStatus.NEEDS_ACTION_MISSING_PRIMARY,
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
      meaningReviewStatus: MeaningReviewStatus.PENDING,
      conceptMergeReviewed: false,
      comparedMeaningWordIds: Prisma.DbNull,
      synonymIds: Prisma.DbNull,
    },
    isAffected: (row) => hasJsonValue(row.otherMeaningIds),
  },
  {
    key: "sentenceIds",
    label: "Sentence links (sentenceIds)",
    description: "Unlinks every WordSense from its sentences without deleting shared Sentence rows.",
    consequences: ["Sets AI meaning review and concept merge review to pending."],
    snapshotFields: ["sentenceIds", ...reviewFields],
    clearData: {
      sentenceIds: Prisma.DbNull,
      meaningReviewStatus: MeaningReviewStatus.PENDING,
      conceptMergeReviewed: false,
    },
    isAffected: (row) => hasJsonValue(row.sentenceIds),
  },
  {
    key: "conceptMergeReviewed",
    label: "Concept merge review status",
    description: "Marks every reviewed WordSense concept as pending again.",
    consequences: ["Does not remove meanings or concept text."],
    snapshotFields: ["conceptMergeReviewed"],
    clearData: { conceptMergeReviewed: false },
    isAffected: (row) => row.conceptMergeReviewed,
  },
  {
    key: "meaningReviewStatus",
    label: "Meaning review status",
    description: "Moves every finalized meaning review back to PENDING.",
    consequences: ["Does not remove primary or alternate meaning links."],
    snapshotFields: ["meaningReviewStatus"],
    clearData: { meaningReviewStatus: MeaningReviewStatus.PENDING },
    isAffected: (row) => row.meaningReviewStatus !== MeaningReviewStatus.PENDING,
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
      meaningReviewStatus: MeaningReviewStatus.PENDING,
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
      meaningReviewStatus: MeaningReviewStatus.PENDING,
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
    description: "Clears the record of WordSense pairs that have already been compared.",
    consequences: ["Makes eligible meaning groups available to the comparison workflow again."],
    snapshotFields: ["comparedMeaningWordIds"],
    clearData: { comparedMeaningWordIds: Prisma.DbNull },
    isAffected: (row) => hasJsonValue(row.comparedMeaningWordIds),
  },
  {
    key: "synonymIds",
    label: "Confirmed synonym relationships",
    description: "Clears every confirmed WordSense synonym relationship.",
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
    description: "WordSense.id is the primary key and cannot be cleared.",
    consequences: ["Other records and relationship arrays use this stable identity. Delete or merge a WordSense through its dedicated workflow instead."],
  },
  {
    key: "englishId",
    label: "englishId",
    kind: "protected",
    description: "englishId is a required foreign key and cannot be cleared.",
    consequences: ["A WordSense cannot exist without its EnglishWord. Use the WordSense delete/merge or EnglishWord management workflow instead."],
  },
  {
    key: "anki_link_id",
    label: "anki_link_id",
    kind: "protected",
    description: "anki_link_id is the required unique sync identity and cannot be cleared.",
    consequences: ["Clearing it would break WordSense-to-Anki synchronization and uniqueness guarantees. Repair it through the dedicated Anki-link workflow."],
  },
  {
    key: "createdAt",
    label: "createdAt",
    kind: "protected",
    description: "createdAt is required audit metadata and cannot be cleared.",
    consequences: ["It records when the WordSense was created and is not user-maintained content."],
  },
  {
    key: "updatedAt",
    label: "updatedAt",
    kind: "protected",
    description: "updatedAt is a required, system-managed synchronization timestamp and cannot be cleared.",
    consequences: ["Prisma refreshes it automatically whenever WordSense data changes; manually clearing it would break change tracking."],
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
  if (!policy) throw new Error(`Unsupported WordSense maintenance field: ${field}`);
  return policy;
}

async function affectedRows(policy: Policy) {
  const rows = await prisma.wordSense.findMany({ select: WORD_MAINTENANCE_SELECT, orderBy: { id: "asc" } });
  return rows.filter(policy.isAffected);
}

function confirmationText(field: WordMaintenanceField, count: number) {
  return `CLEAR WordSense.${field} ${count}`;
}

function audioStats(rows: MaintenanceWordSense[], policy: Policy) {
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
      size = statSync(getWordSenseConceptAudioAbsolutePath(filename)).size;
    } catch {
      size = 0;
    }
    if (size <= 0) continue;
    fileCount += 1;
    bytes += size;
  }
  return { fileCount, bytes };
}

export async function previewWordSenseFieldMaintenance(field: WordMaintenanceField) {
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
      row.meaningReviewStatus === MeaningReviewStatus.CONFIRMED &&
      policy.clearData.meaningReviewStatus === MeaningReviewStatus.PENDING,
    ).length,
    conceptMergeReviewsReset: rows.filter((row) =>
      row.conceptMergeReviewed && policy.clearData.conceptMergeReviewed === false,
    ).length,
    ...audioStats(rows, policy),
    confirmationText: confirmationText(field, rows.length),
  };
}

export async function previewWordFieldSelection(field: WordMaintenanceSelectionKey) {
  if (isWordMaintenanceField(field)) return previewWordSenseFieldMaintenance(field);
  const selection = informationalSelectionByKey.get(field);
  if (!selection) throw new Error(`Unsupported WordSense maintenance selection: ${field}`);
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

const SENTENCE_SNAPSHOT_SELECT = {
  id: true,
  sentence_en: true,
  sentence_en_meaning_fa: true,
  sentence_en_audio_file_name: true,
  sentence_en_audio_source_text: true,
  sentence_en_meaning_fa_audio_file_name: true,
  sentence_en_meaning_fa_audio_source_text: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.SentenceSelect;

type SentenceSnapshot = Prisma.SentenceGetPayload<{ select: typeof SENTENCE_SNAPSHOT_SELECT }>;
type StoredSentencePreview = {
  id: string;
  expiresAt: number;
  scope: NormalizedWordSenseMaintenanceScope;
  deleteOrphanedSentences: boolean;
  wordStates: Array<{ id: number; sentenceIds: number[]; updatedAt: string }>;
  impact: ReturnType<typeof analyzeSentenceLinkImpact>;
  orphanedSentences: SentenceSnapshot[];
  missingSentenceIds: number[];
  confirmationText: string;
};

const previewState = globalThis as typeof globalThis & {
  __wordSenseSentenceMaintenancePreviews?: Map<string, StoredSentencePreview>;
};
const sentencePreviews = previewState.__wordSenseSentenceMaintenancePreviews ?? new Map<string, StoredSentencePreview>();
previewState.__wordSenseSentenceMaintenancePreviews = sentencePreviews;
const SENTENCE_PREVIEW_TTL_MS = 10 * 60 * 1000;

function pruneSentencePreviews(now = Date.now()) {
  for (const [id, preview] of sentencePreviews) {
    if (preview.expiresAt <= now) sentencePreviews.delete(id);
  }
}

async function filteredWordSenseWhere(filter: Extract<NormalizedWordSenseMaintenanceScope, { kind: "filtered_results" }>["filter"]) {
  const matchingPersianIds = filter.q
    ? (await prisma.persianWord.findMany({
        where: {
          OR: [
            { canonical_text: { contains: filter.q } },
            { meaning_fa_IPA: { contains: filter.q } },
            { meaning_fa_IPA_normalize: { contains: filter.q } },
          ],
        },
        select: { id: true },
      })).map((row) => row.id)
    : [];
  const searchWhere: Prisma.WordSenseWhereInput | undefined = filter.q
    ? {
        OR: [
          { english: { is: { base_form: { contains: filter.q } } } },
          { anki_link_id: { contains: filter.q } },
          { meaning: { is: { id: { in: matchingPersianIds } } } },
          ...matchingPersianIds.map((id) => ({ otherMeaningIds: { array_contains: id } })),
        ],
      }
    : undefined;
  const reviewWhere: Prisma.WordSenseWhereInput | undefined = filter.review === "pending"
    ? { meaningReviewStatus: MeaningReviewStatus.PENDING }
    : filter.review === "reviewed"
      ? { meaningReviewStatus: MeaningReviewStatus.CONFIRMED }
      : undefined;
  const audioWhere: Prisma.WordSenseWhereInput | undefined = filter.missingConceptAudio
    ? { id: { in: await getPendingWordSenseConceptAudioIds() } }
    : undefined;
  return searchWhere || reviewWhere || audioWhere
    ? { AND: [searchWhere, reviewWhere, audioWhere].filter(Boolean) as Prisma.WordSenseWhereInput[] }
    : undefined;
}

async function resolveWordSenseScope(scopeValue: unknown) {
  const scope = normalizeWordSenseMaintenanceScope(scopeValue);
  let where: Prisma.WordSenseWhereInput | undefined;
  let requestedIds: number[] | null = null;
  if (scope.kind === "explicit_ids" || scope.kind === "selected_rows" || scope.kind === "id_range") {
    requestedIds = scope.ids;
    where = { id: { in: requestedIds } };
  } else if (scope.kind === "filtered_results") {
    where = await filteredWordSenseWhere(scope.filter);
  }
  const rows = await prisma.wordSense.findMany({
    where,
    orderBy: { id: "asc" },
    select: { id: true, sentenceIds: true, updatedAt: true },
  });
  const missingIds = requestedIds ? missingRequestedIds(requestedIds, rows.map((row) => row.id)) : [];
  if (missingIds.length) {
    throw new Error(`WordSense id(s) not found: ${missingIds.join(", ")}. The Scope was not changed and execution is blocked.`);
  }
  if (!rows.length) throw new Error("The selected Scope contains no WordSense rows.");
  return { scope, rows };
}

function scopedSentenceConfirmation(scope: NormalizedWordSenseMaintenanceScope, affectedRows: number, linkCount: number) {
  const prefix = scope.kind === "all_rows" ? "CLEAR ALL" : "CLEAR SCOPED";
  return `${prefix} WordSense.sentenceIds ${affectedRows} ROWS ${linkCount} LINKS`;
}

export async function previewScopedSentenceLinkMaintenance(args: {
  scope: unknown;
  deleteOrphanedSentences: boolean;
}) {
  pruneSentencePreviews();
  const { scope, rows } = await resolveWordSenseScope(args.scope);
  const allWords = await prisma.wordSense.findMany({ select: { id: true, sentenceIds: true } });
  const scopedWords = rows.map((row) => ({ id: row.id, sentenceIds: wordSentenceIds(row.sentenceIds) }));
  const impact = analyzeSentenceLinkImpact(
    scopedWords,
    allWords.map((row) => ({ id: row.id, sentenceIds: wordSentenceIds(row.sentenceIds) })),
  );
  const existingSentences = impact.linkedSentenceIds.length
    ? await prisma.sentence.findMany({
        where: { id: { in: impact.linkedSentenceIds } },
        orderBy: { id: "asc" },
        select: SENTENCE_SNAPSHOT_SELECT,
      })
    : [];
  const sentenceById = new Map(existingSentences.map((sentence) => [sentence.id, sentence]));
  const missingSentenceIds = impact.linkedSentenceIds.filter((id) => !sentenceById.has(id));
  const orphanedSentences = impact.orphanedSentenceIds.flatMap((id) => {
    const sentence = sentenceById.get(id);
    return sentence ? [sentence] : [];
  });
  const id = randomUUID();
  const expiresAt = Date.now() + SENTENCE_PREVIEW_TTL_MS;
  const confirmation = scopedSentenceConfirmation(scope, impact.affectedWordIds.length, impact.linkCount);
  const stored: StoredSentencePreview = {
    id,
    expiresAt,
    scope,
    deleteOrphanedSentences: args.deleteOrphanedSentences,
    wordStates: rows.map((row) => ({
      id: row.id,
      sentenceIds: wordSentenceIds(row.sentenceIds),
      updatedAt: row.updatedAt.toISOString(),
    })),
    impact,
    orphanedSentences,
    missingSentenceIds,
    confirmationText: confirmation,
  };
  sentencePreviews.set(id, stored);
  return {
    mode: "action" as const,
    operationKind: "sentence_links" as const,
    field: "sentenceIds" as const,
    label: getPolicy("sentenceIds").label,
    description: "Unlinks sentences only from the WordSense rows resolved by this Scope.",
    consequences: getPolicy("sentenceIds").consequences,
    affectedRows: impact.affectedWordIds.length,
    scopedRows: rows.length,
    aiMeaningReviewsReset: 0,
    conceptMergeReviewsReset: 0,
    fileCount: 0,
    bytes: 0,
    previewId: id,
    expiresAt: new Date(expiresAt).toISOString(),
    scope,
    linkCount: impact.linkCount,
    affectedWordSenseIds: impact.affectedWordIds,
    linkedSentenceIds: impact.linkedSentenceIds,
    sharedSentenceIds: impact.sharedSentenceIds,
    orphanedSentenceIds: orphanedSentences.map((sentence) => sentence.id),
    missingSentenceIds,
    deleteOrphanedSentences: args.deleteOrphanedSentences,
    confirmationText: confirmation,
  };
}

function serializeSentence(sentence: SentenceSnapshot) {
  return {
    ...sentence,
    createdAt: sentence.createdAt.toISOString(),
    updatedAt: sentence.updatedAt.toISOString(),
  };
}

type SentenceMaintenanceMetadata = {
  kind: "sentence_links";
  requestId: string;
  previewId: string;
  scope: NormalizedWordSenseMaintenanceScope;
  linkCount: number;
  affectedWordSenseIds: number[];
  sharedSentenceIds: number[];
  orphanedSentenceIds: number[];
  protectedSentenceIds: number[];
  missingSentenceIds: number[];
  deletedSentences: ReturnType<typeof serializeSentence>[];
};

function maintenanceMetadata(data: Prisma.JsonValue): SentenceMaintenanceMetadata | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const value = (data as Record<string, unknown>)._maintenance;
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const metadata = value as Partial<SentenceMaintenanceMetadata>;
  return metadata.kind === "sentence_links" ? metadata as SentenceMaintenanceMetadata : null;
}

export async function executeScopedSentenceLinkMaintenance(args: {
  previewId: string;
  requestId: string;
  confirmation: string;
}) {
  return withMaintenanceLock(async () => {
    assertNoRunningJobs();
    const prior = await prisma.wordFieldMaintenanceOperation.findUnique({
      where: { id: args.requestId },
      include: { snapshots: { orderBy: { wordId: "asc" }, take: 1 } },
    });
    if (prior) {
      const metadata = prior.snapshots[0] ? maintenanceMetadata(prior.snapshots[0].data) : null;
      if (!metadata || !isIdempotentMaintenanceReplay(metadata.previewId, args.previewId)) {
        throw new Error("This request id already belongs to a different maintenance operation.");
      }
      return {
        operationId: prior.id,
        affectedRows: prior.affectedRows,
        unlinkedSentenceLinks: metadata.linkCount,
        deletedSentences: metadata.deletedSentences.length,
        protectedSentences: metadata.protectedSentenceIds.length,
        idempotentReplay: true,
        report: metadata,
      };
    }

    pruneSentencePreviews();
    const preview = sentencePreviews.get(args.previewId);
    if (!preview) throw new Error("The preview expired or is no longer available. Preview changes again.");
    if (args.confirmation !== preview.confirmationText) {
      throw new Error(`Confirmation text must exactly match: ${preview.confirmationText}`);
    }
    if (!preview.impact.affectedWordIds.length) throw new Error("There are no sentence links to clear in this Scope.");

    const result = await prisma.$transaction(async (tx) => {
      const currentRows = await tx.wordSense.findMany({
        where: { id: { in: preview.wordStates.map((row) => row.id) } },
        orderBy: { id: "asc" },
        select: { id: true, sentenceIds: true, updatedAt: true, meaningReviewStatus: true, conceptMergeReviewed: true },
      });
      const currentStates = currentRows.map((row) => ({
        id: row.id,
        sentenceIds: wordSentenceIds(row.sentenceIds),
        updatedAt: row.updatedAt.toISOString(),
      }));
      if (!sameSentenceLinkState(preview.wordStates, currentStates)) {
        throw new Error("The preview is stale because one or more scoped WordSense rows changed. Preview changes again.");
      }

      const affectedIds = new Set(preview.impact.affectedWordIds);
      const affectedRows = currentRows.filter((row) => affectedIds.has(row.id));
      for (const row of affectedRows) {
        await updateWordSense({
          where: { id: row.id },
          data: { sentenceIds: Prisma.DbNull, meaningReviewStatus: MeaningReviewStatus.PENDING, conceptMergeReviewed: false },
          select: { id: true },
        }, tx);
      }

      const protectedSentenceIds: number[] = [];
      const deletedSentences: SentenceSnapshot[] = [];
      if (preview.deleteOrphanedSentences) {
        const remainingWords = await tx.wordSense.findMany({ select: { sentenceIds: true } });
        const remainingLinks = new Set(remainingWords.flatMap((row) => wordSentenceIds(row.sentenceIds)));
        for (const sentence of preview.orphanedSentences) {
          if (remainingLinks.has(sentence.id)) {
            protectedSentenceIds.push(sentence.id);
            continue;
          }
          const currentSentence = await tx.sentence.findUnique({ where: { id: sentence.id }, select: SENTENCE_SNAPSHOT_SELECT });
          if (!currentSentence) continue;
          if (currentSentence.updatedAt.getTime() !== sentence.updatedAt.getTime()) {
            throw new Error(`Sentence ${sentence.id} changed after Preview. No changes were committed.`);
          }
          const deleted = await tx.sentence.deleteMany({ where: { id: sentence.id } });
          if (deleted.count) deletedSentences.push(currentSentence);
        }
      }

      const metadata: SentenceMaintenanceMetadata = {
        kind: "sentence_links",
        requestId: args.requestId,
        previewId: preview.id,
        scope: preview.scope,
        linkCount: preview.impact.linkCount,
        affectedWordSenseIds: preview.impact.affectedWordIds,
        sharedSentenceIds: preview.impact.sharedSentenceIds,
        orphanedSentenceIds: preview.orphanedSentences.map((sentence) => sentence.id),
        protectedSentenceIds,
        missingSentenceIds: preview.missingSentenceIds,
        deletedSentences: deletedSentences.map(serializeSentence),
      };
      await tx.wordFieldMaintenanceOperation.create({
        data: {
          id: args.requestId,
          field: "sentenceIds",
          label: "Sentence links (scoped)",
          affectedRows: affectedRows.length,
          status: "completed",
        },
      });
      await tx.wordFieldMaintenanceSnapshot.createMany({
        data: affectedRows.map((row, index) => ({
          operationId: args.requestId,
          wordId: row.id,
          data: {
            sentenceIds: row.sentenceIds ?? null,
            meaningReviewStatus: row.meaningReviewStatus,
            conceptMergeReviewed: row.conceptMergeReviewed,
            ...(index === 0 ? { _maintenance: metadata } : {}),
          } as Prisma.InputJsonObject,
        })),
      });
      return { metadata, affectedRows: affectedRows.length };
    }, { isolationLevel: "Serializable", maxWait: 10_000, timeout: 120_000 });

    sentencePreviews.delete(args.previewId);
    return {
      operationId: args.requestId,
      affectedRows: result.affectedRows,
      unlinkedSentenceLinks: result.metadata.linkCount,
      deletedSentences: result.metadata.deletedSentences.length,
      protectedSentences: result.metadata.protectedSentenceIds.length,
      idempotentReplay: false,
      report: result.metadata,
    };
  });
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

async function quarantineConceptAudio(operationId: string, rows: MaintenanceWordSense[]) {
  const destinationDir = operationQuarantineDir(operationId);
  const moved: MovedFile[] = [];
  const seen = new Set<string>();
  try {
    for (const row of rows) {
      const filename = safeFilename(row.concept_explained_fa_audio_file_name);
      if (!filename || seen.has(filename)) continue;
      seen.add(filename);
      const original = getWordSenseConceptAudioAbsolutePath(filename);
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

async function moveQuarantinedFilesBack(operationId: string, rows: MaintenanceWordSense[]) {
  const moved: MovedFile[] = [];
  const seen = new Set<string>();
  try {
    for (const row of rows) {
      const filename = safeFilename(row.concept_explained_fa_audio_file_name);
      if (!filename || seen.has(filename)) continue;
      seen.add(filename);
      const original = getWordSenseConceptAudioAbsolutePath(filename);
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

function snapshotData(row: MaintenanceWordSense, fields: SnapshotField[]): Prisma.InputJsonObject {
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

const maintenanceState = globalThis as typeof globalThis & { __wordSenseFieldMaintenanceRunning?: boolean };

async function withMaintenanceLock<T>(work: () => Promise<T>) {
  if (maintenanceState.__wordSenseFieldMaintenanceRunning) {
    throw new Error("Another WordSense field maintenance operation is already running.");
  }
  maintenanceState.__wordSenseFieldMaintenanceRunning = true;
  try {
    return await work();
  } finally {
    maintenanceState.__wordSenseFieldMaintenanceRunning = false;
  }
}

export async function executeWordSenseFieldMaintenance(args: {
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
        await updateManyWordSenses(
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

function snapshotToWord(row: { wordId: number; data: Prisma.JsonValue }): MaintenanceWordSense {
  if (!row.data || typeof row.data !== "object" || Array.isArray(row.data)) {
    throw new Error(`Invalid recovery snapshot for WordSense ${row.wordId}.`);
  }
  const data = row.data as Record<string, unknown>;
  return {
    id: row.wordId,
    ...data,
    meaningReviewStatus: typeof data.meaningReviewStatus === "string"
      ? data.meaningReviewStatus
      : data.meanings_confirmed === true
        ? MeaningReviewStatus.CONFIRMED
        : MeaningReviewStatus.PENDING,
  } as MaintenanceWordSense;
}

function restoreData(data: Prisma.JsonValue): Prisma.WordSenseUncheckedUpdateInput {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Invalid WordSense field maintenance snapshot data.");
  }
  const jsonFields = new Set(["otherMeaningIds", "comparedMeaningWordIds", "synonymIds", "sentenceIds"]);
  const record = data as Record<string, unknown>;
  const restored = Object.fromEntries(Object.entries(record)
    .filter(([key]) => !key.startsWith("_") && key !== "meanings_confirmed")
    .map(([key, value]) => [
      key,
      jsonFields.has(key) && value === null ? Prisma.DbNull : value,
    ])) as Prisma.WordSenseUncheckedUpdateInput;
  if (!("meaningReviewStatus" in restored) && "meanings_confirmed" in record) {
    restored.meaningReviewStatus = record.meanings_confirmed === true
      ? MeaningReviewStatus.CONFIRMED
      : MeaningReviewStatus.PENDING;
  }
  return restored;
}

export async function undoWordSenseFieldMaintenance(operationId: string) {
  return withMaintenanceLock(async () => {
    assertNoRunningJobs();
    const operation = await prisma.wordFieldMaintenanceOperation.findUnique({
      where: { id: operationId },
      include: { snapshots: { orderBy: { wordId: "asc" } } },
    });
    if (!operation) throw new Error("This maintenance operation does not exist.");
    const metadata = operation.snapshots[0] ? maintenanceMetadata(operation.snapshots[0].data) : null;
    if (operation.status === "undone") {
      return {
        operationId: operation.id,
        restoredRows: operation.snapshots.length,
        restoredFiles: 0,
        restoredSentences: metadata?.deletedSentences.length ?? 0,
        idempotentReplay: true,
      };
    }
    const latest = await prisma.wordFieldMaintenanceOperation.findFirst({
      where: { status: "completed" },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    if (!latest || latest.id !== operationId) {
      throw new Error("Only the latest completed maintenance operation can be undone.");
    }
    if (operation.status !== "completed") {
      throw new Error("This maintenance operation is not available for undo.");
    }
    const operationField = operation.field === "meanings_confirmed"
      ? "meaningReviewStatus"
      : operation.field;
    if (!isWordMaintenanceField(operationField)) {
      throw new Error(`Unsupported archived maintenance field: ${operation.field}`);
    }
    const policy = getPolicy(operationField);
    const snapshotWords = operation.snapshots.map(snapshotToWord);
    const moved = policy.quarantinesConceptAudio
      ? await moveQuarantinedFilesBack(operation.id, snapshotWords)
      : [];
    try {
      await prisma.$transaction(async (tx) => {
        if (metadata) {
          for (const sentence of metadata.deletedSentences) {
            const existingById = await tx.sentence.findUnique({ where: { id: sentence.id }, select: { id: true, sentence_en: true } });
            if (existingById) {
              if (existingById.sentence_en !== sentence.sentence_en) {
                throw new Error(`Cannot restore Sentence ${sentence.id}; that id is now used by another sentence.`);
              }
              continue;
            }
            const existingByText = await tx.sentence.findUnique({ where: { sentence_en: sentence.sentence_en }, select: { id: true } });
            if (existingByText) {
              throw new Error(`Cannot restore Sentence ${sentence.id}; its text is now used by Sentence ${existingByText.id}.`);
            }
            await tx.sentence.create({
              data: {
                ...sentence,
                createdAt: new Date(sentence.createdAt),
                updatedAt: new Date(sentence.updatedAt),
              },
            });
          }
        }
        for (const snapshot of operation.snapshots) {
          if (metadata) {
            const current = await tx.wordSense.findUnique({ where: { id: snapshot.wordId }, select: { sentenceIds: true } });
            if (!current) throw new Error(`Cannot restore missing WordSense ${snapshot.wordId}.`);
            const originalData = snapshot.data as Record<string, Prisma.JsonValue>;
            const originalIds = wordSentenceIds(originalData.sentenceIds ?? null);
            const currentIds = wordSentenceIds(current.sentenceIds);
            const mergedIds = mergeRestoredSentenceIds(originalIds, currentIds);
            const data = { ...restoreData(snapshot.data), sentenceIds: mergedIds };
            await updateWordSense({ where: { id: snapshot.wordId }, data, select: { id: true } }, tx);
            continue;
          }
          await updateWordSense(
            { where: { id: snapshot.wordId }, data: restoreData(snapshot.data), select: { id: true } },
            tx,
          );
        }
        await tx.wordFieldMaintenanceOperation.update({
          where: { id: operation.id },
          data: { status: "undone", undoneAt: new Date() },
        });
      }, { isolationLevel: "Serializable", maxWait: 10_000, timeout: 120_000 });
    } catch (error) {
      await restoreMovedFiles(moved);
      throw error;
    }
    return {
      operationId: operation.id,
      restoredRows: operation.snapshots.length,
      restoredFiles: moved.length,
      restoredSentences: metadata?.deletedSentences.length ?? 0,
      idempotentReplay: false,
    };
  });
}

export async function listWordSenseFieldMaintenanceOperations(limit = 8) {
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
      snapshots: { orderBy: { wordId: "asc" as const }, take: 1, select: { data: true } },
    },
  });
  const latestCompletedId = operations.find((operation) => operation.status === "completed")?.id ?? null;
  return operations.map(({ snapshots, ...operation }) => ({
    ...operation,
    createdAt: operation.createdAt.toISOString(),
    undoneAt: operation.undoneAt?.toISOString() ?? null,
    canUndo: operation.id === latestCompletedId,
    report: snapshots[0] ? maintenanceMetadata(snapshots[0].data) : null,
  }));
}

export async function sentenceIdsForWordSenseMaintenanceOperation(operationId: string) {
  const snapshot = await prisma.wordFieldMaintenanceSnapshot.findFirst({
    where: { operationId },
    orderBy: { wordId: "asc" },
    select: { data: true },
  });
  const metadata = snapshot ? maintenanceMetadata(snapshot.data) : null;
  if (!metadata) return [];
  return [...new Set([
    ...metadata.sharedSentenceIds,
    ...metadata.orphanedSentenceIds,
    ...metadata.protectedSentenceIds,
    ...metadata.missingSentenceIds,
    ...metadata.deletedSentences.map((sentence) => sentence.id),
  ])].sort((a, b) => a - b);
}

export function sentenceIdsForActiveWordSenseMaintenancePreview(previewId: string) {
  pruneSentencePreviews();
  return sentencePreviews.get(previewId)?.impact.linkedSentenceIds ?? [];
}
