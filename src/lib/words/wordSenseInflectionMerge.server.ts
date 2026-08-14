import "server-only";

import path from "node:path";
import { rm } from "node:fs/promises";

import type { Prisma } from "@prisma/client";

import { getEnglishWordAudioAbsolutePath } from "@/lib/audio/englishWordAudioPaths.server";
import { getWordSenseConceptAudioAbsolutePath } from "@/lib/audio/wordSenseConceptAudioPaths.server";
import { normalizeEnglishWordText } from "@/lib/english/normalize";
import { prisma } from "@/lib/prisma";
import { deleteWordSense, updateWordSense } from "@/lib/words/wordSenseRepo";

const sourceWordSenseSelect = {
  id: true,
  anki_link_id: true,
  englishId: true,
  meaningId: true,
  otherMeaningIds: true,
  comparedMeaningWordIds: true,
  synonymIds: true,
  sentenceIds: true,
  conceptMergeReviewed: true,
  inflectionMergeReviewed: true,
  meanings_confirmed: true,
  pos: true,
  concept_explained_fa: true,
  concept_explained_fa_audio_file_name: true,
  english: { select: { id: true, base_form: true } },
  meaning: { select: { canonical_text: true } },
} satisfies Prisma.WordSenseSelect;

type SourceWordSense = Prisma.WordSenseGetPayload<{ select: typeof sourceWordSenseSelect }>;

export type InflectionSourceWordSense = {
  wordId: number;
  englishWordId: number;
  baseForm: string;
  pos: string;
  meaningFa: string;
  otherMeaningsFa: string[];
  conceptExplainedFa: string;
  sentences: Array<{
    sentenceId: number;
    sentenceEn: string;
    sentenceEnMeaningFa: string;
  }>;
};

export type InflectionSourceGroup = {
  groupKey: string;
  pos: string;
  englishWords: Array<{
    englishWordId: number;
    baseForm: string;
    words: InflectionSourceWordSense[];
  }>;
};

export type InflectionSourceFingerprint = {
  groupKey: string;
  pos: string;
  englishWordIds: number[];
  wordIds: number[];
};

export type InflectionOutputEntry = {
  canonicalEnglishWordId: number;
  canonicalForm: string;
  keepWordId: number;
  deleteWordIds: number[];
};

export type InflectionOutputGroup = {
  groupKey: string;
  pos: string;
  entries: InflectionOutputEntry[];
};

type ReadClient = Pick<
  Prisma.TransactionClient,
  "englishWord" | "persianWord" | "sentence"
>;

function positiveIds(value: Prisma.JsonValue | null): number[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter(
    (item): item is number =>
      typeof item === "number" && Number.isSafeInteger(item) && item > 0,
  ))];
}

function normalizePos(value: string | null) {
  return value?.trim().toLocaleLowerCase("en-US") || "unknown";
}

function sameIds(left: readonly number[], right: readonly number[]) {
  return left.length === right.length && left.every((id) => right.includes(id));
}

function appendLastToken(form: string, nextLastToken: string) {
  const parts = form.split(" ");
  parts[parts.length - 1] = nextLastToken;
  return parts.join(" ");
}

/** Returns conservative dictionary-form candidates for regular s/es, ing and ed spellings. */
export function regularBaseFormCandidates(value: string): string[] {
  const form = normalizeEnglishWordText(value);
  if (!form) return [];
  const last = form.split(" ").at(-1) ?? "";
  const candidates = new Set<string>();
  const add = (token: string) => {
    if (token.length >= 2 && token !== last) candidates.add(appendLastToken(form, token));
  };

  if (last.endsWith("ies") && last.length > 3) add(`${last.slice(0, -3)}y`);
  if (last.endsWith("es") && last.length > 3) add(last.slice(0, -2));
  if (last.endsWith("s") && !last.endsWith("ss") && last.length > 2) add(last.slice(0, -1));

  if (last.endsWith("ing") && last.length > 5) {
    const stem = last.slice(0, -3);
    add(stem);
    add(`${stem}e`);
    if (/([^aeiou])\1$/u.test(stem)) add(stem.slice(0, -1));
  }

  if (last.endsWith("ied") && last.length > 4) add(`${last.slice(0, -3)}y`);
  if (last.endsWith("ed") && last.length > 4) {
    const stem = last.slice(0, -2);
    add(stem);
    add(last.slice(0, -1));
    if (/([^aeiou])\1$/u.test(stem)) add(stem.slice(0, -1));
  }

  return [...candidates];
}

class DisjointSet {
  private readonly parent = new Map<number, number>();

  add(id: number) {
    if (!this.parent.has(id)) this.parent.set(id, id);
  }

  find(id: number): number {
    const parent = this.parent.get(id) ?? id;
    if (parent === id) return id;
    const root = this.find(parent);
    this.parent.set(id, root);
    return root;
  }

  union(left: number, right: number) {
    this.add(left);
    this.add(right);
    const leftRoot = this.find(left);
    const rightRoot = this.find(right);
    if (leftRoot !== rightRoot) this.parent.set(Math.max(leftRoot, rightRoot), Math.min(leftRoot, rightRoot));
  }
}

async function buildInflectionSourceGroups(client: ReadClient): Promise<InflectionSourceGroup[]> {
  const englishWords = await client.englishWord.findMany({
    orderBy: { id: "asc" },
    select: {
      id: true,
      base_form: true,
      wordSenses: { orderBy: { id: "asc" }, select: sourceWordSenseSelect },
    },
  });
  const byForm = new Map(englishWords.map((word) => [word.base_form, word]));
  const sets = new DisjointSet();
  for (const word of englishWords) {
    sets.add(word.id);
    for (const candidate of regularBaseFormCandidates(word.base_form)) {
      const base = byForm.get(candidate);
      if (base) sets.union(word.id, base.id);
    }
  }

  const components = new Map<number, typeof englishWords>();
  for (const word of englishWords) {
    const root = sets.find(word.id);
    const component = components.get(root) ?? [];
    component.push(word);
    components.set(root, component);
  }

  const candidates: Array<{
    pos: string;
    englishWords: Array<(typeof englishWords)[number] & { wordsForPos: SourceWordSense[] }>;
  }> = [];
  for (const component of components.values()) {
    if (component.length < 2) continue;
    const positions = [...new Set(component.flatMap((word) => word.wordSenses.map((row) => normalizePos(row.pos))))].sort();
    for (const pos of positions) {
      const matching = component.flatMap((word) => {
        const wordsForPos = word.wordSenses.filter((row) => normalizePos(row.pos) === pos);
        return wordsForPos.length ? [{ ...word, wordsForPos }] : [];
      });
      if (matching.length >= 2 && matching.some((word) => word.wordsForPos.some((row) => !row.inflectionMergeReviewed))) {
        candidates.push({ pos, englishWords: matching });
      }
    }
  }

  const meaningIds = [...new Set(candidates.flatMap((group) =>
    group.englishWords.flatMap((word) => word.wordsForPos.flatMap((row) => positiveIds(row.otherMeaningIds))),
  ))];
  const sentenceIds = [...new Set(candidates.flatMap((group) =>
    group.englishWords.flatMap((word) => word.wordsForPos.flatMap((row) => positiveIds(row.sentenceIds))),
  ))];
  const [meanings, sentences] = await Promise.all([
    meaningIds.length
      ? client.persianWord.findMany({ where: { id: { in: meaningIds } }, select: { id: true, canonical_text: true } })
      : [],
    sentenceIds.length
      ? client.sentence.findMany({
          where: { id: { in: sentenceIds } },
          select: { id: true, sentence_en: true, sentence_en_meaning_fa: true },
        })
      : [],
  ]);
  const meaningById = new Map(meanings.map((meaning) => [meaning.id, meaning.canonical_text]));
  const sentenceById = new Map(sentences.map((sentence) => [sentence.id, sentence]));

  return candidates
    .map((candidate) => {
      const englishWordIds = candidate.englishWords.map((word) => word.id).sort((a, b) => a - b);
      return {
        groupKey: `${candidate.pos}:${englishWordIds.join(",")}`,
        pos: candidate.pos,
        englishWords: candidate.englishWords.map((word) => ({
          englishWordId: word.id,
          baseForm: word.base_form,
          words: word.wordsForPos.map((row) => ({
            wordId: row.id,
            englishWordId: row.englishId,
            baseForm: row.english.base_form,
            pos: normalizePos(row.pos),
            meaningFa: row.meaning?.canonical_text ?? "",
            otherMeaningsFa: positiveIds(row.otherMeaningIds)
              .filter((id) => id !== row.meaningId)
              .flatMap((id) => meaningById.get(id) ? [meaningById.get(id)!] : []),
            conceptExplainedFa: row.concept_explained_fa ?? "",
            sentences: positiveIds(row.sentenceIds).flatMap((id) => {
              const sentence = sentenceById.get(id);
              return sentence ? [{
                sentenceId: sentence.id,
                sentenceEn: sentence.sentence_en,
                sentenceEnMeaningFa: sentence.sentence_en_meaning_fa ?? "",
              }] : [];
            }),
          })),
        })),
      } satisfies InflectionSourceGroup;
    })
    .sort((left, right) => left.pos.localeCompare(right.pos) || left.groupKey.localeCompare(right.groupKey));
}

export function sourceFingerprint(group: InflectionSourceGroup): InflectionSourceFingerprint {
  return {
    groupKey: group.groupKey,
    pos: group.pos,
    englishWordIds: group.englishWords.map((word) => word.englishWordId).sort((a, b) => a - b),
    wordIds: group.englishWords.flatMap((word) => word.words.map((row) => row.wordId)).sort((a, b) => a - b),
  };
}

export async function getPendingWordSenseInflectionMergeCount() {
  return (await buildInflectionSourceGroups(prisma)).length;
}

export async function prepareWordSenseInflectionMerge(limit: number) {
  const eligible = await buildInflectionSourceGroups(prisma);
  const selected = limit > 0 ? eligible.slice(0, limit) : eligible;
  return {
    totalEligibleGroups: eligible.length,
    sourceGroups: selected.map(sourceFingerprint),
    items: selected,
  };
}

function isPositiveId(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function exactKeys(record: Record<string, unknown>, keys: readonly string[]) {
  return Object.keys(record).length === keys.length && Object.keys(record).every((key) => keys.includes(key));
}

export function parseInflectionMergeOutput(value: unknown): InflectionOutputGroup[] {
  if (!Array.isArray(value) || value.length === 0) throw new Error("Response must be a non-empty JSON array.");
  return value.map((rawGroup, groupIndex) => {
    if (!rawGroup || typeof rawGroup !== "object") throw new Error(`Output group ${groupIndex + 1} must be an object.`);
    const group = rawGroup as Record<string, unknown>;
    if (!exactKeys(group, ["groupKey", "pos", "entries"]) || typeof group.groupKey !== "string" ||
        typeof group.pos !== "string" || !Array.isArray(group.entries) || !group.entries.length) {
      throw new Error(`Output group ${groupIndex + 1} has an invalid shape.`);
    }
    const entries = group.entries.map((rawEntry, entryIndex) => {
      if (!rawEntry || typeof rawEntry !== "object") throw new Error(`Entry ${entryIndex + 1} in ${group.groupKey} must be an object.`);
      const entry = rawEntry as Record<string, unknown>;
      if (!exactKeys(entry, ["canonicalEnglishWordId", "canonicalForm", "keepWordId", "deleteWordIds"]) ||
          !isPositiveId(entry.canonicalEnglishWordId) || typeof entry.canonicalForm !== "string" ||
          !entry.canonicalForm.trim() || !isPositiveId(entry.keepWordId) || !Array.isArray(entry.deleteWordIds) ||
          entry.deleteWordIds.some((id) => !isPositiveId(id)) || new Set(entry.deleteWordIds).size !== entry.deleteWordIds.length ||
          entry.deleteWordIds.includes(entry.keepWordId)) {
        throw new Error(`Entry ${entryIndex + 1} in ${group.groupKey} has an invalid shape.`);
      }
      return {
        canonicalEnglishWordId: entry.canonicalEnglishWordId,
        canonicalForm: normalizeEnglishWordText(entry.canonicalForm),
        keepWordId: entry.keepWordId,
        deleteWordIds: entry.deleteWordIds as number[],
      };
    });
    return { groupKey: group.groupKey, pos: normalizePos(group.pos), entries };
  });
}

function safeFilename(value: string | null) {
  return value && path.basename(value) === value ? value : null;
}

function mappedIds(value: Prisma.JsonValue | null, replacements: ReadonlyMap<number, number>, selfId: number) {
  return [...new Set(positiveIds(value).map((id) => replacements.get(id) ?? id).filter((id) => id !== selfId))];
}

export async function applyWordSenseInflectionMerge(
  sourceGroups: InflectionSourceFingerprint[],
  output: InflectionOutputGroup[],
) {
  if (!sourceGroups.length || sourceGroups.length !== output.length) {
    throw new Error("The response must contain exactly one output group for every source group.");
  }

  const dbResult = await prisma.$transaction(async (tx) => {
    const currentGroups = new Map((await buildInflectionSourceGroups(tx)).map((group) => [group.groupKey, group]));
    const currentEnglishWords = await tx.englishWord.findMany({
      where: { id: { in: [...new Set(sourceGroups.flatMap((group) => group.englishWordIds))] } },
      select: { id: true, base_form: true, audio_file_name: true, forms: { select: { form: true } } },
    });
    const englishById = new Map(currentEnglishWords.map((word) => [word.id, word]));
    const sourceWordIds = [...new Set(sourceGroups.flatMap((group) => group.wordIds))];
    const words = await tx.wordSense.findMany({ where: { id: { in: sourceWordIds } }, select: sourceWordSenseSelect });
    const wordById = new Map(words.map((word) => [word.id, word]));

    const replacements = new Map<number, number>();
    const entryPlans: Array<InflectionOutputEntry & { source: InflectionSourceFingerprint }> = [];
    const seenWordIds = new Set<number>();

    for (let index = 0; index < sourceGroups.length; index += 1) {
      const source = sourceGroups[index];
      const result = output[index];
      const current = currentGroups.get(source.groupKey);
      if (!current || result.groupKey !== source.groupKey || result.pos !== source.pos) {
        throw new Error(`Output group ${index + 1} does not match the loaded source group.`);
      }
      const currentFingerprint = sourceFingerprint(current);
      if (!sameIds(source.wordIds, currentFingerprint.wordIds) || !sameIds(source.englishWordIds, currentFingerprint.englishWordIds)) {
        throw new Error(`Candidate group ${source.groupKey} changed. Create the data again.`);
      }
      const outputWordIds = result.entries.flatMap((entry) => [entry.keepWordId, ...entry.deleteWordIds]);
      if (!sameIds(source.wordIds, outputWordIds) || new Set(outputWordIds).size !== outputWordIds.length) {
        throw new Error(`Every WordSense in ${source.groupKey} must appear exactly once as a keeper or deletion.`);
      }
      for (const entry of result.entries) {
        const canonical = englishById.get(entry.canonicalEnglishWordId);
        if (!canonical || canonical.base_form !== entry.canonicalForm || !source.englishWordIds.includes(canonical.id)) {
          throw new Error(`Canonical EnglishWord ${entry.canonicalEnglishWordId} is invalid for ${source.groupKey}.`);
        }
        const clusterIds = [entry.keepWordId, ...entry.deleteWordIds];
        const clusterWords = clusterIds.map((id) => wordById.get(id));
        if (clusterWords.some((word) => !word || normalizePos(word.pos) !== source.pos)) {
          throw new Error(`An entry in ${source.groupKey} contains a missing WordSense or a different POS.`);
        }
        if (Math.min(...clusterIds) !== entry.keepWordId) {
          throw new Error(`WordSense ${entry.keepWordId} must be the oldest WordSense in its merge entry.`);
        }
        if (!clusterWords.some((word) => word?.englishId === canonical.id)) {
          throw new Error(`Canonical EnglishWord ${canonical.id} must already own a WordSense in its merge entry.`);
        }
        for (const id of clusterIds) {
          if (seenWordIds.has(id)) throw new Error(`WordSense ${id} appears in more than one output entry.`);
          seenWordIds.add(id);
        }
        for (const id of entry.deleteWordIds) replacements.set(id, entry.keepWordId);
        entryPlans.push({ ...entry, source });
      }
    }

    const aliases: Array<{ englishWordId: number; form: string }> = [];
    const sourceToTargets = new Map<number, Set<number>>();
    const conceptAudioFiles = new Set<string>();
    const deletedAnkiLinkIds: string[] = [];

    for (const entry of entryPlans) {
      const keeper = wordById.get(entry.keepWordId)!;
      const cluster = [keeper, ...entry.deleteWordIds.map((id) => wordById.get(id)!)];
      const primaryMeaningId = keeper.meaningId ?? cluster.find((word) => word.meaningId)?.meaningId ?? null;
      const allMeaningIds = [...new Set(cluster.flatMap((word) => [
        ...(word.meaningId ? [word.meaningId] : []),
        ...positiveIds(word.otherMeaningIds),
      ]))];
      const otherMeaningIds = allMeaningIds.filter((id) => id !== primaryMeaningId);
      const sentenceIds = [...new Set(cluster.flatMap((word) => positiveIds(word.sentenceIds)))];
      const synonymIds = [...new Set(cluster.flatMap((word) => mappedIds(word.synonymIds, replacements, keeper.id)))]
        .filter((id) => !entry.deleteWordIds.includes(id));
      const comparedMeaningWordIds = [...new Set([
        ...cluster.flatMap((word) => mappedIds(word.comparedMeaningWordIds, replacements, keeper.id)),
        ...synonymIds,
      ])].filter((id) => !entry.deleteWordIds.includes(id));
      const meaningsChanged = keeper.meaningId !== primaryMeaningId ||
        !sameIds(positiveIds(keeper.otherMeaningIds), otherMeaningIds);

      await updateWordSense({
        where: { id: keeper.id },
        data: {
          englishId: entry.canonicalEnglishWordId,
          meaningId: primaryMeaningId,
          otherMeaningIds,
          sentenceIds,
          synonymIds,
          comparedMeaningWordIds,
          meanings_confirmed: meaningsChanged ? false : keeper.meanings_confirmed,
          conceptMergeReviewed: true,
          inflectionMergeReviewed: true,
        },
        select: { id: true },
      }, tx);

      for (const word of cluster) {
        const targets = sourceToTargets.get(word.englishId) ?? new Set<number>();
        targets.add(entry.canonicalEnglishWordId);
        sourceToTargets.set(word.englishId, targets);
        const form = word.english.base_form;
        if (form !== entry.canonicalForm) aliases.push({ englishWordId: entry.canonicalEnglishWordId, form });
      }
      for (const word of cluster.slice(1)) {
        const filename = safeFilename(word.concept_explained_fa_audio_file_name);
        if (filename) conceptAudioFiles.add(filename);
        deletedAnkiLinkIds.push(word.anki_link_id);
      }
    }

    const allWords = await tx.wordSense.findMany({
      select: { id: true, comparedMeaningWordIds: true, synonymIds: true },
    });
    const deletedIds = new Set(replacements.keys());
    for (const word of allWords) {
      if (deletedIds.has(word.id)) continue;
      const nextSynonyms = mappedIds(word.synonymIds, replacements, word.id);
      const nextCompared = [...new Set([
        ...mappedIds(word.comparedMeaningWordIds, replacements, word.id),
        ...nextSynonyms,
      ])];
      if (!sameIds(positiveIds(word.synonymIds), nextSynonyms) ||
          !sameIds(positiveIds(word.comparedMeaningWordIds), nextCompared)) {
        await updateWordSense({
          where: { id: word.id },
          data: { synonymIds: nextSynonyms, comparedMeaningWordIds: nextCompared },
          select: { id: true },
        }, tx);
      }
    }

    for (const entry of entryPlans) {
      for (const id of entry.deleteWordIds) await deleteWordSense({ where: { id } }, tx);
    }

    const orphanAudioFiles = new Set<string>();
    let deletedEnglishWords = 0;
    const possibleOrphans = await tx.englishWord.findMany({
      where: { id: { in: [...sourceToTargets.keys()] } },
      select: {
        id: true,
        base_form: true,
        audio_file_name: true,
        forms: { select: { form: true } },
        _count: { select: { wordSenses: true } },
      },
    });
    for (const source of possibleOrphans) {
      if (source._count.wordSenses !== 0) continue;
      const targets = sourceToTargets.get(source.id) ?? new Set<number>();
      for (const targetId of targets) {
        const target = englishById.get(targetId);
        for (const form of [source.base_form, ...source.forms.map((item) => item.form)]) {
          if (target && form !== target.base_form) aliases.push({ englishWordId: targetId, form });
        }
      }
      const filename = safeFilename(source.audio_file_name);
      if (filename) orphanAudioFiles.add(filename);
      await tx.englishWord.delete({ where: { id: source.id } });
      deletedEnglishWords += 1;
    }

    const uniqueAliases = [...new Map(aliases
      .filter((item) => normalizeEnglishWordText(item.form))
      .map((item) => [`${item.englishWordId}:${normalizeEnglishWordText(item.form)}`, {
        englishWordId: item.englishWordId,
        form: normalizeEnglishWordText(item.form),
      }])).values()];
    if (uniqueAliases.length) {
      await tx.englishWordForm.createMany({ data: uniqueAliases, skipDuplicates: true });
    }

    return {
      updated: entryPlans.length,
      deleted: replacements.size,
      deletedEnglishWords,
      savedForms: uniqueAliases.length,
      deletedAnkiLinkIds,
      conceptAudioFiles: [...conceptAudioFiles],
      orphanAudioFiles: [...orphanAudioFiles],
    };
  }, { maxWait: 10_000, timeout: 120_000 });

  let deletedAudioFiles = 0;
  let failedAudioFiles = 0;
  await Promise.all([
    ...dbResult.conceptAudioFiles.map(async (filename) => {
      try {
        await rm(getWordSenseConceptAudioAbsolutePath(filename), { force: true });
        deletedAudioFiles += 1;
      } catch {
        failedAudioFiles += 1;
      }
    }),
    ...dbResult.orphanAudioFiles.map(async (filename) => {
      try {
        await rm(getEnglishWordAudioAbsolutePath(filename), { force: true });
        deletedAudioFiles += 1;
      } catch {
        failedAudioFiles += 1;
      }
    }),
  ]);

  return {
    updated: dbResult.updated,
    deleted: dbResult.deleted,
    deletedEnglishWords: dbResult.deletedEnglishWords,
    savedForms: dbResult.savedForms,
    deletedAnkiLinkIds: dbResult.deletedAnkiLinkIds,
    deletedAudioFiles,
    failedAudioFiles,
  };
}
