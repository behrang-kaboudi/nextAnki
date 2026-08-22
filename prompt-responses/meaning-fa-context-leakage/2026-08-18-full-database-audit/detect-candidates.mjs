import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const runDir = path.dirname(fileURLToPath(import.meta.url));
const outputPath = path.join(runDir, "raw-candidates.json");

const PERSIAN_STOP_COMPONENTS = new Set([
  "از",
  "با",
  "بر",
  "به",
  "برای",
  "تا",
  "در",
  "را",
  "و",
  "یا",
  "کردن",
  "شدن",
  "بودن",
  "داشتن",
  "دادن",
  "گرفتن",
  "زدن",
  "یک",
]);

const normalizeEnglish = (value) =>
  String(value ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[^a-z0-9']+/g, " ")
    .trim()
    .replace(/\s+/g, " ");

const normalizePersian = (value) =>
  String(value ?? "")
    .normalize("NFKC")
    .replace(/[يى]/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, "")
    .replace(/[\u200c\u200d]/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");

const tokens = (value) => value.split(" ").filter(Boolean);
const containsPhrase = (whole, part) =>
  whole !== part && ` ${whole} `.includes(` ${part} `);

const isUsefulPersianComponent = (value) => {
  const componentTokens = tokens(value);
  if (componentTokens.length === 0) return false;
  if (componentTokens.every((token) => PERSIAN_STOP_COMPONENTS.has(token))) return false;
  return componentTokens.join("").length >= 3;
};

try {
  const [wordSenses, englishWords, englishForms, persianWords, sentences] =
    await Promise.all([
      prisma.wordSense.findMany({
        select: {
          id: true,
          englishId: true,
          meaningId: true,
          otherMeaningIds: true,
          sentenceIds: true,
          pos: true,
          concept_explained_fa: true,
          meaningReviewStatus: true,
        },
        orderBy: { id: "asc" },
      }),
      prisma.englishWord.findMany({
        select: { id: true, base_form: true },
        orderBy: { id: "asc" },
      }),
      prisma.englishWordForm.findMany({
        select: { englishWordId: true, form: true },
      }),
      prisma.persianWord.findMany({
        select: { id: true, canonical_text: true },
      }),
      prisma.sentence.findMany({
        select: { id: true, sentence_en: true, sentence_en_meaning_fa: true },
        orderBy: { id: "asc" },
      }),
    ]);

  const englishById = new Map(englishWords.map((row) => [row.id, row]));
  const persianById = new Map(persianWords.map((row) => [row.id, row]));
  const sentenceById = new Map(sentences.map((row) => [row.id, row]));
  const sensesByEnglishId = new Map();
  const persianMeaningsByEnglishId = new Map();
  const surfaceToEnglishIds = new Map();
  let maxSurfaceTokens = 1;

  const addSurface = (surface, englishId) => {
    const normalized = normalizeEnglish(surface);
    if (!normalized) return;
    const ids = surfaceToEnglishIds.get(normalized) ?? new Set();
    ids.add(englishId);
    surfaceToEnglishIds.set(normalized, ids);
    maxSurfaceTokens = Math.max(maxSurfaceTokens, tokens(normalized).length);
  };

  for (const word of englishWords) addSurface(word.base_form, word.id);
  for (const form of englishForms) addSurface(form.form, form.englishWordId);
  maxSurfaceTokens = Math.min(maxSurfaceTokens, 6);

  for (const sense of wordSenses) {
    const group = sensesByEnglishId.get(sense.englishId) ?? [];
    group.push(sense);
    sensesByEnglishId.set(sense.englishId, group);

    const meaningIds = [
      ...(Number.isInteger(sense.meaningId) ? [sense.meaningId] : []),
      ...(Array.isArray(sense.otherMeaningIds)
        ? sense.otherMeaningIds.filter(Number.isInteger)
        : []),
    ];
    const meanings = persianMeaningsByEnglishId.get(sense.englishId) ?? new Map();
    for (const meaningId of meaningIds) {
      const row = persianById.get(meaningId);
      const normalized = normalizePersian(row?.canonical_text);
      if (normalized) meanings.set(normalized, row.canonical_text);
    }
    persianMeaningsByEnglishId.set(sense.englishId, meanings);
  }

  const sentenceContextCache = new Map();
  const englishIdsInText = (text) => {
    const normalized = normalizeEnglish(text);
    if (sentenceContextCache.has(normalized)) return sentenceContextCache.get(normalized);
    const textTokens = tokens(normalized);
    const found = new Set();
    for (let start = 0; start < textTokens.length; start += 1) {
      for (let length = 1; length <= maxSurfaceTokens && start + length <= textTokens.length; length += 1) {
        const surface = textTokens.slice(start, start + length).join(" ");
        const ids = surfaceToEnglishIds.get(surface);
        if (ids) for (const id of ids) found.add(id);
      }
    }
    sentenceContextCache.set(normalized, found);
    return found;
  };

  const componentEnglishIdsForTarget = new Map();
  for (const word of englishWords) {
    componentEnglishIdsForTarget.set(word.id, englishIdsInText(word.base_form));
  }

  const candidates = [];
  let primaryMeaningsChecked = 0;
  let connectedSentencesChecked = 0;

  for (const sense of wordSenses) {
    const primary = persianById.get(sense.meaningId);
    const meaningFa = primary?.canonical_text ?? "";
    const normalizedMeaning = normalizePersian(meaningFa);
    if (!normalizedMeaning) continue;
    primaryMeaningsChecked += 1;

    const sameEnglishMeanings = persianMeaningsByEnglishId.get(sense.englishId) ?? new Map();
    const nestedShorterMeanings = [...sameEnglishMeanings.entries()]
      .filter(([normalized]) => containsPhrase(normalizedMeaning, normalized))
      .map(([normalized, text]) => ({ text, normalized }))
      .sort((a, b) => b.normalized.length - a.normalized.length);

    const excludedEnglishIds = new Set([
      sense.englishId,
      ...(componentEnglishIdsForTarget.get(sense.englishId) ?? []),
    ]);
    const evidenceByKey = new Map();
    const sentenceIds = Array.isArray(sense.sentenceIds)
      ? sense.sentenceIds.filter(Number.isInteger)
      : [];

    for (const sentenceId of sentenceIds) {
      const sentence = sentenceById.get(sentenceId);
      if (!sentence) continue;
      connectedSentencesChecked += 1;
      const contextEnglishIds = englishIdsInText(sentence.sentence_en);
      for (const contextEnglishId of contextEnglishIds) {
        if (excludedEnglishIds.has(contextEnglishId)) continue;
        const contextWord = englishById.get(contextEnglishId);
        const contextMeanings = persianMeaningsByEnglishId.get(contextEnglishId) ?? new Map();
        for (const [normalizedContextMeaning, contextMeaningText] of contextMeanings) {
          if (
            !isUsefulPersianComponent(normalizedContextMeaning) ||
            !containsPhrase(normalizedMeaning, normalizedContextMeaning)
          ) {
            continue;
          }

          const matchesNestedRemainder = nestedShorterMeanings.some(({ normalized }) => {
            const remaining = normalizePersian(
              normalizedMeaning.replace(` ${normalized} `, " ")
                .replace(new RegExp(`^${normalized} `), "")
                .replace(new RegExp(` ${normalized}$`), ""),
            );
            return remaining === normalizedContextMeaning;
          });
          const key = `${sentenceId}:${contextEnglishId}:${normalizedContextMeaning}`;
          evidenceByKey.set(key, {
            sentenceId,
            sentenceEn: sentence.sentence_en,
            sentenceMeaningFa: sentence.sentence_en_meaning_fa,
            contributingEnglishWordId: contextEnglishId,
            contributingBaseForm: contextWord?.base_form ?? null,
            matchedPersianMeaning: contextMeaningText,
            matchedComponent: normalizedContextMeaning,
            matchesNestedRemainder,
          });
        }
      }
    }

    const evidence = [...evidenceByKey.values()].sort(
      (a, b) =>
        a.sentenceId - b.sentenceId ||
        a.contributingEnglishWordId - b.contributingEnglishWordId ||
        a.matchedComponent.localeCompare(b.matchedComponent, "fa"),
    );
    if (evidence.length === 0) continue;

    const distinctContributors = new Set(evidence.map((item) => item.contributingEnglishWordId));
    const hasRemainderMatch = evidence.some((item) => item.matchesNestedRemainder);
    const detectionScore = Math.min(
      10,
      4 +
        (nestedShorterMeanings.length > 0 ? 2 : 0) +
        (hasRemainderMatch ? 3 : 0) +
        (distinctContributors.size > 1 ? 1 : 0),
    );
    const otherMeaningIds = Array.isArray(sense.otherMeaningIds)
      ? sense.otherMeaningIds.filter(Number.isInteger)
      : [];

    candidates.push({
      wordSenseId: sense.id,
      englishWordId: sense.englishId,
      baseForm: englishById.get(sense.englishId)?.base_form ?? null,
      pos: sense.pos,
      meaningFa,
      otherMeaningsFa: otherMeaningIds
        .map((id) => persianById.get(id)?.canonical_text)
        .filter(Boolean),
      conceptExplainedFa: sense.concept_explained_fa,
      meaningReviewStatus: sense.meaningReviewStatus,
      nestedShorterMeanings: nestedShorterMeanings.map((item) => item.text),
      detectionScore,
      evidence,
    });
  }

  candidates.sort(
    (a, b) => b.detectionScore - a.detectionScore || a.wordSenseId - b.wordSenseId,
  );

  const output = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    databaseScope: {
      wordSenses: wordSenses.length,
      englishWords: englishWords.length,
      persianWords: persianWords.length,
      sentences: sentences.length,
      primaryMeaningsChecked,
      connectedSentencesChecked,
    },
    detectorBoundary:
      "Read-only lexical-overlap candidates. Inclusion is not proof of a semantic defect.",
    candidateCount: candidates.length,
    candidates,
  };

  await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  console.log(
    JSON.stringify(
      {
        outputPath,
        candidateCount: candidates.length,
        scoreCounts: Object.fromEntries(
          [...new Set(candidates.map((item) => item.detectionScore))]
            .sort((a, b) => b - a)
            .map((score) => [
              score,
              candidates.filter((item) => item.detectionScore === score).length,
            ]),
        ),
      },
      null,
      2,
    ),
  );
} finally {
  await prisma.$disconnect();
}
