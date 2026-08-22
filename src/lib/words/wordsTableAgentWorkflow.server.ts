import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, open, readFile, readdir, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import { prisma } from "@/lib/prisma";
import { combinePromptParts } from "@/lib/ai/promptPolicy";
import { getPendingWordSenseConceptMergeStats, loadWordSenseConceptMergeGroups, parseMergeOutput, prepareWordSenseConceptMerge } from "@/lib/words/wordSenseConceptMerge.server";
import { getPendingWordSenseInflectionMergeStats, loadWordSenseInflectionMergeGroups, parseInflectionMergeOutput, prepareWordSenseInflectionMerge } from "@/lib/words/wordSenseInflectionMerge.server";
import { getPendingWordSenseMeaningComparisonStats, loadWordSenseMeaningComparisonGroups, parseMeaningComparisonOutput, prepareWordSenseMeaningComparison } from "@/lib/words/wordSenseMeaningComparison.server";
import { isMeaningReviewEligible, loadMeaningReviewPromptRecords, summarizeMeaningReviewEligibility } from "@/lib/words/meaningReviewWorkflow.server";
import { meaningReviewRequestKey, type MeaningReviewCorrection } from "@/lib/words/meaningReviewFinalization";
import { getCustomExtractionPendingSummary } from "@/lib/word-extraction/customExtraction.server";
import { getPendingWordAudioTaskCounts } from "@/lib/audio/wordAudioPending.server";
import { renderPromptFromFile, withGlobalAmericanEnglishPolicy } from "@/prompts/_core/promptStore";

export const WORDS_TABLE_AGENT_STAGE_IDS = [
  "review_persian_meanings",
  "merge_word_concepts",
  "merge_inflected_forms",
  "compare_word_meanings",
] as const;

export type WordsTableAgentStageId = (typeof WORDS_TABLE_AGENT_STAGE_IDS)[number];
export const WORDS_TABLE_HUMAN_REVIEW_POLICIES = ["merge_only", "all_stages"] as const;
export type WordsTableHumanReviewPolicy = (typeof WORDS_TABLE_HUMAN_REVIEW_POLICIES)[number];
type ArtifactStatus = "awaiting_agent_response" | "awaiting_automatic_apply" | "awaiting_human_review" | "applied" | "stale";

type AutomaticApplication = {
  endpoint: string;
  method: "POST";
  body: Record<string, unknown>;
};

type ArtifactManifest = {
  version: 1;
  runId: string;
  stageId: WordsTableAgentStageId;
  status: ArtifactStatus;
  createdAt: string;
  updatedAt: string;
  itemCount: number;
  promptFile: "prompt.md";
  inputFile: "input.json";
  responseFile: "response.json" | null;
  qaFile: "qa.json" | null;
  humanReviewPolicy?: WordsTableHumanReviewPolicy;
  applicationFile?: "application.json" | null;
};

const WORKFLOW_ROOT = path.join(process.cwd(), "prompt-responses", "words-table-workflow");
const PREPARE_LOCK = path.join(WORKFLOW_ROOT, ".prepare.lock");
const PROMPTS: Record<WordsTableAgentStageId, Array<{ path: string; render: boolean }>> = {
  review_persian_meanings: [
    { path: "word-extraction/pos/rulseV1.md", render: true },
    { path: "word-extraction/concept_explained_fa/rulseV1.md", render: true },
    { path: "word-extraction/sentence_en/rulseV1.md", render: true },
    { path: "word-extraction/sentence_meaning_fa/rulseV1.md", render: true },
    { path: "word-extraction/meaning_fa_review/rulseV1.md", render: true },
  ],
  merge_word_concepts: [{ path: "word-extraction/merge_word_concepts/rulseV1.md", render: true }],
  merge_inflected_forms: [{ path: "word-extraction/merge_inflected_forms/rulseV1.md", render: false }],
  compare_word_meanings: [{ path: "word-extraction/compare_word_meanings/rulseV1.md", render: false }],
};

function runDirectory(runId: string) {
  if (!/^[a-z0-9_-]+$/i.test(runId)) throw new Error("Invalid workflow run id.");
  return path.join(WORKFLOW_ROOT, runId, "batch-001");
}

async function writeJsonAtomic(filePath: string, value: unknown) {
  await mkdir(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.${randomUUID()}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporaryPath, filePath);
}

async function readManifest(runId: string): Promise<ArtifactManifest> {
  let manifest: ArtifactManifest;
  try {
    manifest = JSON.parse(await readFile(path.join(runDirectory(runId), "manifest.json"), "utf8")) as ArtifactManifest;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") throw new Error("Workflow run not found.");
    throw error;
  }
  if (!WORDS_TABLE_AGENT_STAGE_IDS.includes(manifest.stageId)) {
    throw new Error("This artifact does not belong to the current agent workflow.");
  }
  return manifest;
}

async function listManifests() {
  const entries = await readdir(WORKFLOW_ROOT, { withFileTypes: true }).catch(() => []);
  const manifests = await Promise.all(entries.filter((entry) => entry.isDirectory()).map(async (entry) => {
    try { return await readManifest(entry.name); } catch { return null; }
  }));
  return manifests.filter((item): item is ArtifactManifest => item !== null)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

async function activeArtifact(stageId: WordsTableAgentStageId) {
  return (await listManifests()).find((manifest) =>
    manifest.stageId === stageId &&
    (manifest.status === "awaiting_agent_response" || manifest.status === "awaiting_automatic_apply" || manifest.status === "awaiting_human_review")
  ) ?? null;
}

function requiresHumanReview(stageId: WordsTableAgentStageId, policy: WordsTableHumanReviewPolicy) {
  return policy === "all_stages" || stageId === "merge_word_concepts";
}

export async function getWordsTableWorkflowStatus(humanReviewPolicy?: WordsTableHumanReviewPolicy) {
  const [
    meaningRecords,
    conceptStats,
    inflectionStats,
    comparisonStats,
    learningScores,
    audio,
    missingMeaningIpa,
    pendingMeaningIpaReview,
    missingPhoneticUs,
    missingJsonHint,
    manifests,
  ] = await Promise.all([
    loadMeaningReviewPromptRecords(),
    getPendingWordSenseConceptMergeStats(),
    getPendingWordSenseInflectionMergeStats(),
    getPendingWordSenseMeaningComparisonStats(),
    getCustomExtractionPendingSummary(["imageability", "learning_depth", "productive_target"]),
    getPendingWordAudioTaskCounts(),
    prisma.persianWord.count({ where: { OR: [{ meaning_fa_IPA: null }, { meaning_fa_IPA: "" }] } }),
    prisma.persianWord.count({ where: { meaning_fa_IPA_confirmed: false, AND: [{ meaning_fa_IPA: { not: null } }, { meaning_fa_IPA: { not: "" } }] } }),
    prisma.englishWord.count({ where: { OR: [{ phonetic_us: null }, { phonetic_us: "" }] } }),
    prisma.englishWord.count({ where: { OR: [{ json_hint: null }, { json_hint: "" }] } }),
    listManifests(),
  ]);
  const meaningSummary = summarizeMeaningReviewEligibility(meaningRecords);
  const dependent = [
    { order: 1, id: "review_persian_meanings" as const, label: "REVIEW PERSIAN MEANINGS", remaining: { records: meaningSummary.totalEligible }, agentRemaining: meaningSummary.totalEligible, blockingRemaining: meaningSummary.totalEligible },
    { order: 2, id: "merge_word_concepts" as const, label: "MERGE WORD CONCEPTS", remaining: { records: conceptStats.recordCount, groups: conceptStats.groupCount }, agentRemaining: conceptStats.groupCount, blockingRemaining: conceptStats.groupCount },
    { order: 3, id: "merge_inflected_forms" as const, label: "MERGE INFLECTED FORMS", remaining: { records: inflectionStats.recordCount, groups: inflectionStats.groupCount }, agentRemaining: inflectionStats.groupCount, blockingRemaining: inflectionStats.groupCount },
    { order: 4, id: "compare_word_meanings" as const, label: "COMPARE WORD MEANINGS", remaining: { records: comparisonStats.recordCount, groups: comparisonStats.groupCount }, agentRemaining: comparisonStats.groupCount, blockingRemaining: comparisonStats.groupCount },
  ];
  const firstIncompleteIndex = dependent.findIndex((stage) => stage.blockingRemaining > 0);
  const stages = dependent.map((stage, index) => {
    const artifact = manifests.find((candidate) => candidate.stageId === stage.id &&
      (candidate.status === "awaiting_agent_response" || candidate.status === "awaiting_automatic_apply" || candidate.status === "awaiting_human_review"));
    const effectivePolicy = artifact?.humanReviewPolicy ?? humanReviewPolicy;
    const blocked = firstIncompleteIndex >= 0 && index > firstIncompleteIndex;
    const state = stage.blockingRemaining === 0 ? "complete"
      : blocked ? "blocked_by_previous_stage"
      : artifact?.status ?? "ready";
    return {
      ...stage,
      state,
      canAgentPrepare: state === "ready",
      reviewBehavior: stage.id === "merge_word_concepts" ? "always_human" as const : "policy_dependent" as const,
      requiresHumanReview: effectivePolicy ? requiresHumanReview(stage.id, effectivePolicy) : stage.id === "merge_word_concepts" ? true : null,
      pendingArtifact: artifact ? { runId: artifact.runId, status: artifact.status, itemCount: artifact.itemCount } : null,
    };
  });
  const nextDependentStage = stages.find((stage) => stage.state === "ready")?.id ?? null;
  const dependentRemaining = stages.reduce((total, stage) => total + stage.agentRemaining, 0);
  const dependentActiveState = stages.find((stage) => stage.state !== "complete")?.state ?? "complete";
  const automatedTasks = [
    {
      order: 1,
      id: "complete_learning_scores" as const,
      label: "COMPLETE LEARNING SCORES",
      remaining: learningScores.total,
      details: {
        fields: learningScores.fieldCounts,
        dispatch: { mode: "parallel_prompt_answers_tasks" as const, maxParallelTasks: 4 },
      },
    },
    {
      order: 2,
      id: "generate_meaning_fa_ipa" as const,
      label: "EXTRACT MEANING_FA_IPA",
      remaining: missingMeaningIpa,
      details: { dispatch: { mode: "parallel_prompt_answers_tasks" as const, maxParallelTasks: 4 } },
    },
    {
      order: 3,
      id: "review_persian_ipa" as const,
      label: "REVIEW PERSIAN IPA",
      remaining: pendingMeaningIpaReview,
    },
    {
      order: 4,
      id: "generate_phonetic_us" as const,
      label: "PHONETIC_US",
      remaining: missingPhoneticUs,
      details: { dispatch: { mode: "parallel_prompt_answers_tasks" as const, maxParallelTasks: 4 } },
    },
  ];
  const automatedRemaining = automatedTasks.reduce((total, task) => total + task.remaining, 0);
  const generatedTasks = [
    {
      order: 1,
      id: "generate_audio" as const,
      label: "GENERATE AUDIO",
      remaining: audio.total,
      details: { missingFile: audio.missingFile, changedText: audio.changedText },
    },
    {
      order: 2,
      id: "generate_json_hint" as const,
      label: "GENERATE JSON HINT",
      remaining: missingJsonHint,
    },
  ];
  const generatedRemaining = generatedTasks.reduce((total, task) => total + task.remaining, 0);
  const dependentComplete = dependentRemaining === 0;
  const automatedComplete = automatedRemaining === 0;
  const sections = [
    {
      order: 1,
      id: "dependent_agent_workflow" as const,
      label: "DEPENDENT AGENT WORKFLOW",
      executionMode: "continue_until_human_review_or_section_complete" as const,
      remaining: dependentRemaining,
      state: dependentComplete ? "complete" : dependentActiveState,
      nextTask: nextDependentStage,
      tasks: stages,
    },
    {
      order: 2,
      id: "automated_completion" as const,
      label: "AUTOMATED COMPLETION",
      executionMode: "complete_section_in_one_run" as const,
      remaining: automatedRemaining,
      state: automatedComplete ? "complete" : dependentComplete ? "ready" : "blocked_by_previous_section",
      nextTask: automatedComplete ? null : automatedTasks.find((task) => task.remaining > 0)?.id ?? null,
      tasks: automatedTasks,
    },
    {
      order: 3,
      id: "generated_assets_and_metadata" as const,
      label: "GENERATED ASSETS AND METADATA",
      executionMode: "complete_section_in_one_run" as const,
      remaining: generatedRemaining,
      state: generatedRemaining === 0
        ? "complete"
        : dependentComplete && automatedComplete
          ? "ready"
          : "blocked_by_previous_section",
      nextTask: generatedRemaining === 0 ? null : generatedTasks.find((task) => task.remaining > 0)?.id ?? null,
      tasks: generatedTasks,
    },
  ];
  const automaticApplyStage = stages.find((stage) => stage.state === "awaiting_automatic_apply") ?? null;
  const agentResponseStage = stages.find((stage) => stage.state === "awaiting_agent_response") ?? null;
  const nextSection = sections.find((section) => section.state === "ready") ?? null;
  const resumedDependentWork = automaticApplyStage
    ? {
        sectionId: "dependent_agent_workflow" as const,
        taskId: automaticApplyStage.id,
        executionMode: "continue_until_human_review_or_section_complete" as const,
        action: "apply_saved_response" as const,
        runId: automaticApplyStage.pendingArtifact!.runId,
        requiresHumanReview: false,
      }
    : agentResponseStage
      ? {
          sectionId: "dependent_agent_workflow" as const,
          taskId: agentResponseStage.id,
          executionMode: "continue_until_human_review_or_section_complete" as const,
          action: "resume_agent_response" as const,
          runId: agentResponseStage.pendingArtifact!.runId,
          requiresHumanReview: agentResponseStage.requiresHumanReview,
        }
      : null;
  return {
    stages,
    sections,
    nextAgentStage: nextDependentStage,
    nextAgentSection: resumedDependentWork?.sectionId ?? nextSection?.id ?? null,
    nextAgentWork: resumedDependentWork ?? (nextSection ? {
      sectionId: nextSection.id,
      taskId: nextSection.nextTask,
      executionMode: nextSection.executionMode,
      ...(nextSection.id === "dependent_agent_workflow" && nextSection.nextTask
        ? { requiresHumanReview: humanReviewPolicy ? requiresHumanReview(nextSection.nextTask, humanReviewPolicy) : nextSection.nextTask === "merge_word_concepts" ? true : null }
        : {}),
    } : null),
    humanReviewPolicy: {
      selected: humanReviewPolicy ?? null,
      requiredBeforePrepare: true,
      supported: WORDS_TABLE_HUMAN_REVIEW_POLICIES,
      mergeOnlyHumanStage: "merge_word_concepts" as const,
    },
    agentExecutionLimit: { dependentStagesPerRun: "until_human_review_or_section_complete" as const, completionSectionsPerRun: 1 },
    laterStages: {
      learningScores: { remaining: learningScores.total, fields: learningScores.fieldCounts },
      meaningFaIpa: { missing: missingMeaningIpa, awaitingHumanReview: pendingMeaningIpaReview },
      phoneticUs: { missing: missingPhoneticUs },
      audio,
      jsonHint: { missing: missingJsonHint },
    },
  };
}

async function loadPrompt(stageId: WordsTableAgentStageId) {
  const parts = await Promise.all(PROMPTS[stageId].map(async (spec) => {
    if (spec.render) return renderPromptFromFile({ file: spec.path });
    const raw = await readFile(path.join(process.cwd(), "src", "prompts", spec.path), "utf8");
    return withGlobalAmericanEnglishPolicy(raw);
  }));
  return combinePromptParts(parts);
}

async function prepareStageData(stageId: WordsTableAgentStageId) {
  if (stageId === "review_persian_meanings") {
    const records = await loadMeaningReviewPromptRecords();
    const items = records.filter(isMeaningReviewEligible);
    return { data: items, itemCount: items.length };
  }
  if (stageId === "merge_word_concepts") {
    const count = (await getPendingWordSenseConceptMergeStats()).groupCount;
    const prepared = await prepareWordSenseConceptMerge(count);
    return { data: prepared.items, itemCount: prepared.items.length };
  }
  if (stageId === "merge_inflected_forms") {
    const count = (await getPendingWordSenseInflectionMergeStats()).groupCount;
    const prepared = await prepareWordSenseInflectionMerge(count);
    return { data: prepared.items, itemCount: prepared.items.length };
  }
  const count = (await getPendingWordSenseMeaningComparisonStats()).groupCount;
  const prepared = await prepareWordSenseMeaningComparison(count);
  return { data: prepared.items, itemCount: prepared.items.length };
}

export async function prepareNextWordsTableAgentStage(humanReviewPolicy: WordsTableHumanReviewPolicy) {
  await mkdir(WORKFLOW_ROOT, { recursive: true });
  let lock;
  try {
    lock = await open(PREPARE_LOCK, "wx");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") {
      throw new Error("Another workflow prepare request is already running.");
    }
    throw error;
  }
  try {
    const status = await getWordsTableWorkflowStatus(humanReviewPolicy);
    const existing = status.stages.find((stage) => stage.pendingArtifact?.status === "awaiting_agent_response");
    if (existing?.pendingArtifact) {
      const dir = runDirectory(existing.pendingArtifact.runId);
      const existingManifest = await readManifest(existing.pendingArtifact.runId);
      const existingPolicy = existingManifest.humanReviewPolicy ?? "all_stages";
      return {
        reused: true,
        runId: existing.pendingArtifact.runId,
        stageId: existing.id,
        humanReviewPolicy: existingPolicy,
        requiresHumanReview: requiresHumanReview(existing.id, existingPolicy),
        prompt: await readFile(path.join(dir, "prompt.md"), "utf8"),
        data: JSON.parse(await readFile(path.join(dir, "input.json"), "utf8")) as unknown,
      };
    }
    const stageId = status.nextAgentStage;
    if (!stageId) throw new Error("No dependent workflow stage is currently ready for the agent.");
    const [prompt, prepared] = await Promise.all([loadPrompt(stageId), prepareStageData(stageId)]);
    if (!prepared.itemCount) throw new Error("The selected stage no longer has remaining agent work.");
    const createdAt = new Date().toISOString();
    const runId = `${createdAt.slice(0, 10)}-${stageId}-${randomUUID()}`;
    const dir = runDirectory(runId);
    const manifest: ArtifactManifest = {
      version: 1, runId, stageId, status: "awaiting_agent_response", createdAt, updatedAt: createdAt,
      itemCount: prepared.itemCount, promptFile: "prompt.md", inputFile: "input.json", responseFile: null, qaFile: null,
      humanReviewPolicy, applicationFile: null,
    };
    await mkdir(dir, { recursive: true });
    await Promise.all([
      writeFile(path.join(dir, "prompt.md"), prompt.endsWith("\n") ? prompt : `${prompt}\n`, "utf8"),
      writeJsonAtomic(path.join(dir, "input.json"), prepared.data),
    ]);
    await writeJsonAtomic(path.join(dir, "manifest.json"), manifest);
    return { reused: false, runId, stageId, humanReviewPolicy, requiresHumanReview: requiresHumanReview(stageId, humanReviewPolicy), prompt, data: prepared.data, itemCount: prepared.itemCount };
  } finally {
    await lock.close();
    await unlink(PREPARE_LOCK).catch(() => undefined);
  }
}

export async function saveWordsTableAgentResponse(args: { runId: string; response: unknown; qa: unknown }) {
  const manifest = await readManifest(args.runId);
  if (manifest.status !== "awaiting_agent_response") throw new Error("This workflow run is not awaiting an agent response.");
  const qa = args.qa as { score?: unknown; status?: unknown; itemResults?: unknown } | null;
  const itemResults = Array.isArray(qa?.itemResults) ? qa.itemResults : [];
  if (!qa || typeof qa !== "object" || typeof qa.score !== "number" || qa.score < 8 || qa.status !== "passed" ||
      itemResults.length !== manifest.itemCount || itemResults.some((item) => {
        if (!item || typeof item !== "object") return true;
        const result = item as Record<string, unknown>;
        return typeof result.score !== "number" || result.score < 8 || result.status !== "passed";
      })) {
    throw new Error(`qa must pass overall and contain ${manifest.itemCount} passing itemResults, each scored at least 8.0.`);
  }
  const response = typeof args.response === "string" ? JSON.parse(args.response) as unknown : args.response;
  await validateStageResponse(manifest.stageId, response, manifest.itemCount);
  const humanReviewPolicy = manifest.humanReviewPolicy ?? "all_stages";
  const humanReviewRequired = requiresHumanReview(manifest.stageId, humanReviewPolicy);
  const application = humanReviewRequired ? null : await buildAutomaticApplication(manifest.stageId, response);
  const updatedAt = new Date().toISOString();
  const dir = runDirectory(args.runId);
  await Promise.all([
    writeJsonAtomic(path.join(dir, "response.json"), response),
    writeJsonAtomic(path.join(dir, "qa.json"), args.qa),
    ...(application ? [writeJsonAtomic(path.join(dir, "application.json"), application)] : []),
  ]);
  const status = humanReviewRequired ? "awaiting_human_review" as const : "awaiting_automatic_apply" as const;
  await writeJsonAtomic(path.join(dir, "manifest.json"), {
    ...manifest,
    humanReviewPolicy,
    status,
    updatedAt,
    responseFile: "response.json",
    qaFile: "qa.json",
    applicationFile: application ? "application.json" : null,
  } satisfies ArtifactManifest);
  return { runId: manifest.runId, stageId: manifest.stageId, humanReviewPolicy, requiresHumanReview: humanReviewRequired, status, application };
}

async function buildAutomaticApplication(stageId: WordsTableAgentStageId, response: unknown): Promise<AutomaticApplication> {
  if (stageId === "merge_word_concepts") {
    throw new Error("MERGE WORD CONCEPTS always requires human review.");
  }
  if (stageId === "review_persian_meanings") {
    const value = response as { reviewedIds: number[]; results: MeaningReviewCorrection[] };
    return {
      endpoint: "/api/words/meanings-review/update-bulk",
      method: "POST",
      body: {
        ids: value.reviewedIds,
        results: value.results,
        requestKey: meaningReviewRequestKey(value.reviewedIds, value.results),
      },
    };
  }
  if (stageId === "merge_inflected_forms") {
    const output = parseInflectionMergeOutput(response);
    const rebuilt = await loadWordSenseInflectionMergeGroups(output);
    return {
      endpoint: "/api/words/inflection-merge/apply",
      method: "POST",
      body: { sourceGroups: rebuilt.sourceGroups, output },
    };
  }
  const output = parseMeaningComparisonOutput(response);
  const rebuilt = await loadWordSenseMeaningComparisonGroups(output);
  return {
    endpoint: "/api/words/meaning-comparison/apply-batch",
    method: "POST",
    body: {
      sourceGroups: rebuilt.items.map((source) => ({
        groupKey: source.groupKey,
        persianWordId: source.persianWordId,
        pos: source.pos,
        sourceWordIds: source.records.map((record) => record.id),
      })),
      output,
    },
  };
}

async function validateStageResponse(stageId: WordsTableAgentStageId, response: unknown, expectedItemCount: number) {
  if (stageId === "review_persian_meanings") {
    const value = response && typeof response === "object" && !Array.isArray(response)
      ? response as Record<string, unknown>
      : null;
    const reviewedIds = Array.isArray(value?.reviewedIds) ? value.reviewedIds : [];
    const results = Array.isArray(value?.results) ? value.results : [];
    if (reviewedIds.length !== expectedItemCount || new Set(reviewedIds).size !== reviewedIds.length ||
        reviewedIds.some((id) => typeof id !== "number" || !Number.isSafeInteger(id) || id <= 0) ||
        results.some((item) => !item || typeof item !== "object" || !reviewedIds.includes((item as Record<string, unknown>).id))) {
      throw new Error("The meaning-review response must cover every prepared reviewedId with valid result ids.");
    }
    const current = await loadMeaningReviewPromptRecords({ ids: reviewedIds as number[] });
    if (current.length !== reviewedIds.length) throw new Error("One or more meaning-review records no longer exist.");
    return;
  }
  if (stageId === "merge_word_concepts") {
    const rebuilt = await loadWordSenseConceptMergeGroups(parseMergeOutput(response));
    if (rebuilt.items.length !== expectedItemCount) throw new Error("The response does not cover every prepared concept group.");
    return;
  }
  if (stageId === "merge_inflected_forms") {
    const rebuilt = await loadWordSenseInflectionMergeGroups(parseInflectionMergeOutput(response));
    if (rebuilt.items.length !== expectedItemCount) throw new Error("The response does not cover every prepared inflection group.");
    return;
  }
  const rebuilt = await loadWordSenseMeaningComparisonGroups(parseMeaningComparisonOutput(response));
  if (rebuilt.items.length !== expectedItemCount) throw new Error("The response does not cover every prepared meaning-comparison group.");
}

export async function getPendingWordsTableAgentResponse(stageId: WordsTableAgentStageId, includeResponse = true) {
  const manifest = await activeArtifact(stageId);
  if (!manifest || manifest.status !== "awaiting_human_review" || !manifest.responseFile) return null;
  return {
    runId: manifest.runId,
    stageId: manifest.stageId,
    itemCount: manifest.itemCount,
    ...(includeResponse ? {
      response: JSON.parse(await readFile(path.join(runDirectory(manifest.runId), manifest.responseFile), "utf8")) as unknown,
    } : {}),
  };
}

export async function getAutomaticWordsTableAgentApplication(runId: string) {
  const manifest = await readManifest(runId);
  if (manifest.status !== "awaiting_automatic_apply" || !manifest.applicationFile) {
    throw new Error("This workflow run is not awaiting automatic application.");
  }
  return {
    runId: manifest.runId,
    stageId: manifest.stageId,
    humanReviewPolicy: manifest.humanReviewPolicy ?? "all_stages",
    application: JSON.parse(await readFile(path.join(runDirectory(runId), manifest.applicationFile), "utf8")) as AutomaticApplication,
  };
}

export async function completeWordsTableAgentRun(runId: string) {
  const manifest = await readManifest(runId);
  if (manifest.status !== "awaiting_human_review" && manifest.status !== "awaiting_automatic_apply") {
    throw new Error("This workflow run is not awaiting completion.");
  }
  const next = { ...manifest, status: "applied" as const, updatedAt: new Date().toISOString() };
  await writeJsonAtomic(path.join(runDirectory(runId), "manifest.json"), next);
  return next;
}
