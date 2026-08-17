import "server-only";

import fsp from "node:fs/promises";
import path from "node:path";

import { getSentenceAudioAbsolutePath } from "@/lib/audio/sentenceAudioPaths.server";
import { prisma } from "@/lib/prisma";
import { getJobProgressSnapshot } from "@/lib/progress/jobProgressCatalog";
import { wordSentenceIds } from "@/lib/words/sentenceIds";

type UnreferencedSentence = {
  id: number;
  sentence_en_audio_file_name: string | null;
  sentence_en_meaning_fa_audio_file_name: string | null;
};

async function listUnreferencedSentences(client: typeof prisma): Promise<UnreferencedSentence[]> {
  const [sentences, words] = await Promise.all([
    client.sentence.findMany({
      select: {
        id: true,
        sentence_en_audio_file_name: true,
        sentence_en_meaning_fa_audio_file_name: true,
      },
    }),
    client.wordSense.findMany({ select: { sentenceIds: true } }),
  ]);
  const referencedIds = new Set(words.flatMap((word) => wordSentenceIds(word.sentenceIds)));
  return sentences.filter((sentence) => !referencedIds.has(sentence.id));
}

export function unreferencedSentenceConfirmation(count: number) {
  return `DELETE UNLINKED SENTENCES ${count}`;
}

export async function countUnreferencedSentences() {
  return (await listUnreferencedSentences(prisma)).length;
}

function activeJobNames() {
  return Object.entries(getJobProgressSnapshot())
    .filter(([, status]) => Boolean(status && typeof status === "object" && "running" in status && status.running))
    .map(([name]) => name);
}

const state = globalThis as typeof globalThis & { __unreferencedSentenceDeletionRunning?: boolean };

function safeAudioFilenames(sentences: UnreferencedSentence[]) {
  return [...new Set(sentences.flatMap((sentence) => [
    sentence.sentence_en_audio_file_name,
    sentence.sentence_en_meaning_fa_audio_file_name,
  ]).filter((filename): filename is string => Boolean(filename && path.basename(filename) === filename)))];
}

async function removeOwnedAudioFiles(filenames: string[]) {
  let failedAudioFiles = 0;
  for (let index = 0; index < filenames.length; index += 50) {
    const results = await Promise.allSettled(
      filenames.slice(index, index + 50).map((filename) =>
        fsp.rm(getSentenceAudioAbsolutePath(filename), { force: true }),
      ),
    );
    failedAudioFiles += results.filter((result) => result.status === "rejected").length;
  }
  return { cleanedAudioFiles: filenames.length - failedAudioFiles, failedAudioFiles };
}

export async function deleteUnreferencedSentences(args: {
  expectedCount: number;
  confirmation: string;
}) {
  if (state.__unreferencedSentenceDeletionRunning) {
    throw new Error("Another unlinked-sentence deletion is already running.");
  }
  const runningJobs = activeJobNames();
  if (runningJobs.length) {
    throw new Error(`Unlinked-sentence deletion is blocked while background jobs are running: ${runningJobs.join(", ")}`);
  }

  state.__unreferencedSentenceDeletionRunning = true;
  try {
    const result = await prisma.$transaction(async (tx) => {
      const sentences = await listUnreferencedSentences(tx as typeof prisma);
      if (sentences.length !== args.expectedCount) {
        throw new Error("The unlinked-sentence count changed. Refresh the page before continuing.");
      }
      if (args.confirmation !== unreferencedSentenceConfirmation(sentences.length)) {
        throw new Error("The deletion confirmation is invalid.");
      }
      if (!sentences.length) throw new Error("There are no unlinked sentences to delete.");

      const deleted = await tx.sentence.deleteMany({
        where: { id: { in: sentences.map((sentence) => sentence.id) } },
      });
      if (deleted.count !== sentences.length) {
        throw new Error("Not all unlinked sentences could be deleted.");
      }
      return { deletedRows: deleted.count, audioFilenames: safeAudioFilenames(sentences) };
    }, { isolationLevel: "Serializable", maxWait: 10_000, timeout: 120_000 });

    return {
      deletedRows: result.deletedRows,
      ...(await removeOwnedAudioFiles(result.audioFilenames)),
    };
  } finally {
    state.__unreferencedSentenceDeletionRunning = false;
  }
}
