import "server-only";

import { prisma } from "@/lib/prisma";

export async function upsertSentenceByAnkiLinkId(args: {
  ankiLinkId: string;
  sentence_en: string;
  sentence_en_meaning_fa?: string | null;
}) {
  const { ankiLinkId, sentence_en, sentence_en_meaning_fa = null } = args;
  return prisma.sentence.upsert({
    where: { anki_link_id: ankiLinkId },
    update: { sentence_en, sentence_en_meaning_fa },
    create: { anki_link_id: ankiLinkId, sentence_en, sentence_en_meaning_fa },
  });
}

export async function updateSentenceByAnkiLinkId(
  ankiLinkId: string,
  data: { sentence_en?: string; sentence_en_meaning_fa?: string | null },
) {
  return prisma.sentence.update({
    where: { anki_link_id: ankiLinkId },
    data,
  });
}

export async function findSentenceByAnkiLinkId(ankiLinkId: string) {
  return prisma.sentence.findUnique({
    where: { anki_link_id: ankiLinkId },
  });
}

export function getSentenceAudioKey(sentenceId: number | string | null | undefined): string | null {
  if (sentenceId == null) return null;
  const value = String(sentenceId).trim();
  return value.length ? value : null;
}
