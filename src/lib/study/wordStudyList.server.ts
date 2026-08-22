import "server-only";

import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import {
  generateWordAnkiFieldsForMetaLexVr9,
  getHydratedWordAnkiReadinessIssues,
} from "@/lib/anki/wordAnkiMapping";
import { REQUIRED_WORD_ANKI_FIELD_NAMES } from "@/lib/anki/wordAnkiSyncReadiness";
import { hydrateWordSensesWithEnglishFields } from "@/lib/english/wordSenseEnglishFields.server";
import { prisma } from "@/lib/prisma";
import { hydrateWordSensesWithEnglishSynonyms } from "@/lib/words/englishSynonyms.server";
import { hydrateWordSensesWithPersianMeanings } from "@/lib/words/persianMeanings.server";
import { hydrateWordsWithPrimarySentence } from "@/lib/words/primarySentences.server";

const STUDY_LIST_DIRECTORY = path.join(process.cwd(), "data", "study");
const USER_SLUG_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/;

let mutationQueue: Promise<unknown> = Promise.resolve();

function studyListPath(user: string) {
  const normalized = user.trim().toLocaleLowerCase("en-US");
  if (!USER_SLUG_PATTERN.test(normalized)) {
    throw new Error("Invalid study-list user.");
  }
  return path.join(STUDY_LIST_DIRECTORY, `${normalized}.json`);
}

function normalizeIds(value: unknown): number[] {
  if (!Array.isArray(value)) throw new Error("Study-list file must contain a JSON array.");
  const ids = value.map(Number);
  if (ids.some((id) => !Number.isSafeInteger(id) || id <= 0)) {
    throw new Error("Study-list file contains an invalid WordSense ID.");
  }
  return [...new Set(ids)];
}

async function readIdsFromPath(filePath: string) {
  try {
    return normalizeIds(JSON.parse(await fs.readFile(filePath, "utf8")));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

async function writeIdsToPath(filePath: string, ids: readonly number[]) {
  await fs.mkdir(STUDY_LIST_DIRECTORY, { recursive: true });
  const tempPath = `${filePath}.${randomUUID()}.tmp`;
  await fs.writeFile(tempPath, `${JSON.stringify([...new Set(ids)], null, 2)}\n`, "utf8");
  await fs.rename(tempPath, filePath);
}

function serializeMutation<T>(operation: () => Promise<T>): Promise<T> {
  const result = mutationQueue.then(operation, operation);
  mutationQueue = result.then(() => undefined, () => undefined);
  return result;
}

export async function readWordStudyIds(user: string) {
  return readIdsFromPath(studyListPath(user));
}

export async function addWordStudyId(user: string, wordSenseId: number) {
  if (!Number.isSafeInteger(wordSenseId) || wordSenseId <= 0) {
    throw new Error("wordSenseId must be a positive integer.");
  }
  const exists = await prisma.wordSense.findUnique({
    where: { id: wordSenseId },
    select: { id: true },
  });
  if (!exists) throw new Error(`WordSense ${wordSenseId} not found.`);

  return serializeMutation(async () => {
    const filePath = studyListPath(user);
    const current = await readIdsFromPath(filePath);
    const ids = current.includes(wordSenseId) ? current : [...current, wordSenseId];
    await writeIdsToPath(filePath, ids);
    return ids;
  });
}

export async function removeWordStudyIds(user: string, wordSenseIds: readonly number[]) {
  const requestedIds = normalizeIds([...wordSenseIds]);
  return serializeMutation(async () => {
    const filePath = studyListPath(user);
    const current = await readIdsFromPath(filePath);
    const removeSet = new Set(requestedIds);
    const ids = current.filter((id) => !removeSet.has(id));
    if (ids.length !== current.length) await writeIdsToPath(filePath, ids);
    return ids;
  });
}

export async function getWordStudyList(user: string) {
  const ids = await readWordStudyIds(user);
  if (!ids.length) return { ids, items: [] };

  const rows = await prisma.wordSense.findMany({ where: { id: { in: ids } } });
  const hydrated = await hydrateWordsWithPrimarySentence(
    await hydrateWordSensesWithEnglishSynonyms(
      await hydrateWordSensesWithPersianMeanings(
        await hydrateWordSensesWithEnglishFields(rows),
      ),
    ),
  );
  const hydratedWithReadiness = await Promise.all(
    hydrated.map(async (row) => {
      const fields = await generateWordAnkiFieldsForMetaLexVr9(
        row,
        REQUIRED_WORD_ANKI_FIELD_NAMES,
      );
      return {
        row,
        readinessIssues: getHydratedWordAnkiReadinessIssues(row, fields),
      };
    }),
  );
  const byId = new Map(hydratedWithReadiness.map((entry) => [entry.row.id, entry]));

  return {
    ids,
    items: ids.map((id) => {
      const entry = byId.get(id);
      return entry
        ? {
            id,
            anki_link_id: entry.row.anki_link_id,
            base_form: entry.row.base_form,
            meaning_fa: entry.row.meaning_fa,
            missing_from_database: false,
            anki_ready: entry.readinessIssues.length === 0,
            anki_readiness_issues: entry.readinessIssues,
          }
        : {
            id,
            anki_link_id: "",
            base_form: "",
            meaning_fa: "",
            missing_from_database: true,
            anki_ready: false,
            anki_readiness_issues: [],
          };
    }),
  };
}
