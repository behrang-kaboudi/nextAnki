import "server-only";

import { Prisma } from "@prisma/client";

import { renderPromptFromFile } from "@/prompts/_core/promptStore";
import { prisma } from "@/lib/prisma";
import { hydrateWordSensesWithPersianMeanings } from "@/lib/words/persianMeanings.server";
import { hydrateWordsWithPrimarySentence } from "@/lib/words/primarySentences.server";

export const WORD_SENSE_STORY_PROMPT_VERSION = "word-hint-story-v1";
export const WORD_SENSE_STORY_PROMPT_PATH = "forFuture/word-hint-story/system-v1.md";

type HintSymbol = {
  slot: string;
  token: string;
  target_lang: "en" | "fa";
  target_ipa: string;
  fa: string;
  en: string;
};

export type WordSenseStoryInput = {
  word_sense_id: number;
  word_sense_updated_at: string;
  english_word_id: number;
  english_word_updated_at: string;
  english_word: string;
  phonetic_us: string | null;
  part_of_speech: string | null;
  meaning_fa: string;
  other_meanings_fa: string[];
  concept_explained_fa: string | null;
  sentence_id: number | null;
  sentence_updated_at: string | null;
  sentence_en: string | null;
  sentence_fa: string | null;
  json_hint: Record<string, unknown>;
  expected_selected_symbols: HintSymbol[];
};

export type WordSenseStoryResponseItem = {
  word_sense_id: number;
  english_word_id: number;
  english_word: string;
  meaning_fa: string;
  sentence_id: number | null;
  selected_symbols: HintSymbol[];
  story_text: string;
  prompt_version: string;
  qa: {
    score: number;
    passed: boolean;
    checks: Record<string, boolean>;
  };
};

const REQUIRED_QA_CHECKS = [
  "sense_preserved",
  "all_symbols_exact",
  "symbol_order_preserved",
  "symbols_are_active",
  "sentence_anchor_preserved",
  "causal_continuity_preserved",
  "compact_and_natural",
] as const;

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseHint(value: string | null): { json: Record<string, unknown>; symbols: HintSymbol[] } | null {
  if (!value?.trim()) return null;
  try {
    const json = JSON.parse(value) as unknown;
    if (!isObject(json)) return null;
    const symbols = Object.entries(json).flatMap(([slot, raw]): HintSymbol[] => {
      if (slot === "generatedAtMs" || !isObject(raw)) return [];
      const targetLang = raw.target_lang;
      const fa = typeof raw.fa === "string" ? raw.fa.trim() : "";
      const en = typeof raw.en === "string" ? raw.en.trim() : "";
      const targetIpa = typeof raw.target_ipa === "string" ? raw.target_ipa.trim() : "";
      if ((targetLang !== "en" && targetLang !== "fa") || !fa || !en || !targetIpa) return [];
      return [{ slot, token: targetLang === "en" ? en : fa, target_lang: targetLang, target_ipa: targetIpa, fa, en }];
    });
    return symbols.length ? { json, symbols } : null;
  } catch {
    return null;
  }
}

function otherMeanings(value: string | null) {
  return value ? value.split("*").map((item) => item.trim()).filter(Boolean) : [];
}

const storySourceSelect = {
  id: true,
  updatedAt: true,
  englishId: true,
  meaningId: true,
  otherMeaningIds: true,
  sentenceIds: true,
  pos: true,
  concept_explained_fa: true,
  english: {
    select: {
      id: true,
      base_form: true,
      phonetic_us: true,
      json_hint: true,
      updatedAt: true,
    },
  },
} satisfies Prisma.WordSenseSelect;

async function toInputs(rows: Prisma.WordSenseGetPayload<{ select: typeof storySourceSelect }>[]) {
  const withMeanings = await hydrateWordSensesWithPersianMeanings(rows);
  const hydrated = await hydrateWordsWithPrimarySentence(withMeanings);
  return hydrated.flatMap((row): WordSenseStoryInput[] => {
    const hint = parseHint(row.english.json_hint);
    if (!hint || !row.meaning_fa.trim()) return [];
    return [{
      word_sense_id: row.id,
      word_sense_updated_at: row.updatedAt.toISOString(),
      english_word_id: row.englishId,
      english_word_updated_at: row.english.updatedAt.toISOString(),
      english_word: row.english.base_form,
      phonetic_us: row.english.phonetic_us,
      part_of_speech: row.pos,
      meaning_fa: row.meaning_fa,
      other_meanings_fa: otherMeanings(row.other_meanings_fa),
      concept_explained_fa: row.concept_explained_fa,
      sentence_id: row.sentence?.id ?? null,
      sentence_updated_at: row.sentence?.updatedAt.toISOString() ?? null,
      sentence_en: row.sentence?.sentence_en ?? null,
      sentence_fa: row.sentence?.sentence_en_meaning_fa ?? null,
      json_hint: hint.json,
      expected_selected_symbols: hint.symbols,
    }];
  });
}

const missingActiveStoryWhere = {
  stories: { none: { isActive: true } },
} satisfies Prisma.WordSenseWhereInput;

export async function getWordSenseStorySummary() {
  const [totalMissing, readyByFields] = await Promise.all([
    prisma.wordSense.count({ where: missingActiveStoryWhere }),
    prisma.wordSense.count({
      where: {
        AND: [
          missingActiveStoryWhere,
          { meaningId: { not: null } },
          { english: { is: { AND: [{ json_hint: { not: null } }, { json_hint: { not: "" } }] } } },
        ],
      },
    }),
  ]);
  return { totalMissing, readyByFields, blockedByFields: totalMissing - readyByFields };
}

export async function prepareWordSenseStoryBatch(limit: number, requestedWordSenseIds?: readonly number[]) {
  const take = Number.isSafeInteger(limit) && limit > 0 ? limit : 20;
  const ids = requestedWordSenseIds?.length ? [...new Set(requestedWordSenseIds)] : null;
  const rows = await prisma.wordSense.findMany({
    where: {
      AND: [
        missingActiveStoryWhere,
        { meaningId: { not: null } },
        { english: { is: { AND: [{ json_hint: { not: null } }, { json_hint: { not: "" } }] } } },
        ...(ids ? [{ id: { in: ids } }] : []),
      ],
    },
    orderBy: { id: "asc" },
    take: ids ? undefined : take,
    select: storySourceSelect,
  });
  const unorderedData = await toInputs(rows);
  const data = ids
    ? ids.flatMap((id) => unorderedData.filter((item) => item.word_sense_id === id))
    : unorderedData;
  const prompt = await renderPromptFromFile({ file: WORD_SENSE_STORY_PROMPT_PATH });
  const batchInstruction = [
    "## Batch response requirement",
    "The input below is a JSON array. Return one JSON array in the same order, with one output object per input record.",
    "Do not wrap the array in Markdown or explanatory prose.",
  ].join("\n");
  return {
    prompt: `${prompt.trim()}\n\n${batchInstruction}`,
    data,
    requestedWordSenseIds: ids,
    unavailableWordSenseIds: ids ? ids.filter((id) => !data.some((item) => item.word_sense_id === id)) : [],
    summary: await getWordSenseStorySummary(),
  };
}

function sameSymbols(actual: HintSymbol[], expected: HintSymbol[]) {
  return JSON.stringify(actual) === JSON.stringify(expected);
}

function parseResponseItem(raw: unknown, request: WordSenseStoryInput): WordSenseStoryResponseItem {
  if (!isObject(raw)) throw new Error("Response item must be an object.");
  if (raw.word_sense_id !== request.word_sense_id) throw new Error("word_sense_id does not match the prepared record.");
  if (raw.english_word_id !== request.english_word_id || raw.english_word !== request.english_word) {
    throw new Error(`English identity changed for WordSense #${request.word_sense_id}.`);
  }
  if (raw.meaning_fa !== request.meaning_fa || raw.sentence_id !== request.sentence_id) {
    throw new Error(`Sense or sentence identity changed for WordSense #${request.word_sense_id}.`);
  }
  if (!Array.isArray(raw.selected_symbols) || !sameSymbols(raw.selected_symbols as HintSymbol[], request.expected_selected_symbols)) {
    throw new Error(`selected_symbols do not exactly match json_hint for WordSense #${request.word_sense_id}.`);
  }
  const storyText = typeof raw.story_text === "string" ? raw.story_text.trim() : "";
  if (!storyText) throw new Error(`story_text is required for WordSense #${request.word_sense_id}.`);
  if (raw.prompt_version !== WORD_SENSE_STORY_PROMPT_VERSION) {
    throw new Error(`prompt_version must be ${WORD_SENSE_STORY_PROMPT_VERSION}.`);
  }
  if (!isObject(raw.qa) || raw.qa.passed !== true || typeof raw.qa.score !== "number" || raw.qa.score < 8) {
    throw new Error(`QA must pass with score >= 8 for WordSense #${request.word_sense_id}.`);
  }
  const checks = isObject(raw.qa.checks) ? raw.qa.checks : {};
  const failedChecks = REQUIRED_QA_CHECKS.filter((check) => checks[check] !== true);
  if (failedChecks.length) throw new Error(`QA checks failed for WordSense #${request.word_sense_id}: ${failedChecks.join(", ")}.`);
  return {
    word_sense_id: request.word_sense_id,
    english_word_id: request.english_word_id,
    english_word: request.english_word,
    meaning_fa: request.meaning_fa,
    sentence_id: request.sentence_id,
    selected_symbols: request.expected_selected_symbols,
    story_text: storyText,
    prompt_version: WORD_SENSE_STORY_PROMPT_VERSION,
    qa: { score: raw.qa.score, passed: true, checks: Object.fromEntries(REQUIRED_QA_CHECKS.map((check) => [check, true])) },
  };
}

export function validateWordSenseStoryResponse(
  requestsValue: unknown,
  itemsValue: unknown,
) {
  if (!Array.isArray(requestsValue) || !requestsValue.length) throw new Error("requests must be a non-empty prepared array.");
  if (!Array.isArray(itemsValue)) throw new Error("items must be an array.");
  const requests = requestsValue as WordSenseStoryInput[];
  const requestById = new Map(requests.map((request) => [request.word_sense_id, request]));
  if (requestById.size !== requests.length) throw new Error("requests contains duplicate word_sense_id values.");
  const seen = new Set<number>();
  const items = itemsValue.map((raw) => {
    const id = isObject(raw) && typeof raw.word_sense_id === "number" ? raw.word_sense_id : -1;
    const request = requestById.get(id);
    if (!request) throw new Error(`Response WordSense #${id} is not in the prepared batch.`);
    if (seen.has(id)) throw new Error(`Duplicate response for WordSense #${id}.`);
    seen.add(id);
    return parseResponseItem(raw, request);
  });
  return { requests, items, omittedWordSenseIds: requests.filter((request) => !seen.has(request.word_sense_id)).map((request) => request.word_sense_id) };
}

async function assertCurrent(request: WordSenseStoryInput) {
  const row = await prisma.wordSense.findUnique({
    where: { id: request.word_sense_id },
    select: {
      updatedAt: true,
      sentenceIds: true,
      english: { select: { id: true, base_form: true, json_hint: true, updatedAt: true } },
      stories: { where: { isActive: true }, select: { id: true }, take: 1 },
    },
  });
  if (!row) throw new Error(`WordSense #${request.word_sense_id} no longer exists.`);
  if (row.stories.length) throw new Error(`WordSense #${request.word_sense_id} already has an active story.`);
  if (row.updatedAt.toISOString() !== request.word_sense_updated_at || row.english.updatedAt.toISOString() !== request.english_word_updated_at) {
    throw new Error(`WordSense #${request.word_sense_id} changed after Prepare.`);
  }
  const hint = parseHint(row.english.json_hint);
  if (!hint || !sameSymbols(hint.symbols, request.expected_selected_symbols)) {
    throw new Error(`json_hint changed after Prepare for WordSense #${request.word_sense_id}.`);
  }
  if (request.sentence_id !== null) {
    const sentence = await prisma.sentence.findUnique({ where: { id: request.sentence_id }, select: { updatedAt: true } });
    if (!sentence || sentence.updatedAt.toISOString() !== request.sentence_updated_at) {
      throw new Error(`Sentence #${request.sentence_id} changed after Prepare.`);
    }
  }
}

export async function previewWordSenseStories(requestsValue: unknown, itemsValue: unknown) {
  const validated = validateWordSenseStoryResponse(requestsValue, itemsValue);
  for (const item of validated.items) {
    const request = validated.requests.find((candidate) => candidate.word_sense_id === item.word_sense_id)!;
    await assertCurrent(request);
  }
  return validated;
}

export async function applyWordSenseStories(requestsValue: unknown, itemsValue: unknown) {
  const validated = await previewWordSenseStories(requestsValue, itemsValue);
  const requestById = new Map(validated.requests.map((request) => [request.word_sense_id, request]));
  const created = await prisma.$transaction(async (tx) => {
    const results = [];
    for (const item of validated.items) {
      const request = requestById.get(item.word_sense_id)!;
      const latest = await tx.wordSenseStory.findFirst({ where: { wordSenseId: item.word_sense_id }, orderBy: { version: "desc" }, select: { version: true } });
      await tx.wordSenseStory.updateMany({ where: { wordSenseId: item.word_sense_id, isActive: true }, data: { isActive: false } });
      results.push(await tx.wordSenseStory.create({
        data: {
          wordSenseId: item.word_sense_id,
          sentenceId: item.sentence_id,
          version: (latest?.version ?? 0) + 1,
          storyText: item.story_text,
          selectedSymbols: item.selected_symbols as unknown as Prisma.InputJsonValue,
          sourceSnapshot: request as unknown as Prisma.InputJsonValue,
          promptVersion: item.prompt_version,
          isActive: true,
          audio_file_name: null,
          audio_source_text: null,
        },
        select: { id: true, wordSenseId: true, version: true, storyText: true, updatedAt: true },
      }));
    }
    return results;
  });
  return { created, omittedWordSenseIds: validated.omittedWordSenseIds };
}
