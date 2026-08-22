import "server-only";

import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { getJobProgressSnapshot } from "@/lib/progress/jobProgressCatalog";

type UnreferencedPersianWord = {
  id: number;
};

function referencedMeaningIds(value: Prisma.JsonValue | null) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const id = typeof item === "number" ? item : typeof item === "string" && /^\d+$/.test(item) ? Number(item) : 0;
    return Number.isSafeInteger(id) && id > 0 ? [id] : [];
  });
}

async function loadPersianWordReferenceCounts(client: typeof prisma) {
  const wordSenses = await client.wordSense.findMany({
    select: { meaningId: true, otherMeaningIds: true },
  });
  const counts = new Map<number, number>();
  for (const wordSense of wordSenses) {
    const ids = new Set([
      ...(wordSense.meaningId === null ? [] : [wordSense.meaningId]),
      ...referencedMeaningIds(wordSense.otherMeaningIds),
    ]);
    for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}

function listDeletablePersianWordCandidates(client: typeof prisma) {
  return client.persianWord.findMany({
    where: {
      AND: [
        { OR: [{ audio_file_name: null }, { audio_file_name: "" }] },
        { OR: [{ meaning_fa_IPA: null }, { meaning_fa_IPA: "" }] },
        { OR: [{ meaning_fa_IPA_normalize: null }, { meaning_fa_IPA_normalize: "" }] },
      ],
    },
    select: { id: true },
  });
}

async function listDeletablePersianWords(client: typeof prisma): Promise<UnreferencedPersianWord[]> {
  const [persianWords, referenceCounts] = await Promise.all([
    listDeletablePersianWordCandidates(client),
    loadPersianWordReferenceCounts(client),
  ]);
  return persianWords.filter((persianWord) => !referenceCounts.has(persianWord.id));
}

export function unreferencedPersianWordConfirmation(count: number) {
  return `DELETE UNUSED PERSIAN WORDS ${count}`;
}

export async function countDeletablePersianWords() {
  return (await listDeletablePersianWords(prisma)).length;
}

export async function getPersianWordTableReferenceSummary() {
  const [persianWords, referenceCounts] = await Promise.all([
    listDeletablePersianWordCandidates(prisma),
    loadPersianWordReferenceCounts(prisma),
  ]);
  return {
    deletableCount: persianWords.filter((persianWord) => !referenceCounts.has(persianWord.id)).length,
    referenceCounts,
  };
}

function activeJobNames() {
  return Object.entries(getJobProgressSnapshot())
    .filter(([, status]) => Boolean(status && typeof status === "object" && "running" in status && status.running))
    .map(([name]) => name);
}

const state = globalThis as typeof globalThis & { __unreferencedPersianWordDeletionRunning?: boolean };

export async function deleteDeletablePersianWords(args: {
  expectedCount: number;
  confirmation: string;
}) {
  if (state.__unreferencedPersianWordDeletionRunning) {
    throw new Error("Another unused-PersianWord deletion is already running.");
  }
  const runningJobs = activeJobNames();
  if (runningJobs.length) {
    throw new Error(`Unused-PersianWord deletion is blocked while background jobs are running: ${runningJobs.join(", ")}`);
  }

  state.__unreferencedPersianWordDeletionRunning = true;
  try {
    return await prisma.$transaction(async (tx) => {
      const persianWords = await listDeletablePersianWords(tx as typeof prisma);
      if (persianWords.length !== args.expectedCount) {
        throw new Error("The unused-PersianWord count changed. Refresh the page before continuing.");
      }
      if (args.confirmation !== unreferencedPersianWordConfirmation(persianWords.length)) {
        throw new Error("The deletion confirmation is invalid.");
      }
      if (!persianWords.length) throw new Error("There are no unused PersianWord records to delete.");

      const deleted = await tx.persianWord.deleteMany({
        where: { id: { in: persianWords.map((persianWord) => persianWord.id) } },
      });
      if (deleted.count !== persianWords.length) {
        throw new Error("Not all unused PersianWord records could be deleted.");
      }
      return { deletedRows: deleted.count };
    }, { isolationLevel: "Serializable", maxWait: 10_000, timeout: 120_000 });
  } finally {
    state.__unreferencedPersianWordDeletionRunning = false;
  }
}
