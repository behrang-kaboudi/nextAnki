import "server-only";

import { prisma } from "@/lib/prisma";

export type ActiveWordSenseStory = {
  id: number;
  wordSenseId: number;
  storyText: string;
  audio_file_name: string | null;
  audio_source_text: string | null;
};

export async function hydrateWordSensesWithActiveStory<T extends { id: number }>(
  words: readonly T[],
): Promise<Array<T & { activeStory: ActiveWordSenseStory | null }>> {
  const wordSenseIds = Array.from(new Set(words.map((word) => word.id)));
  if (!wordSenseIds.length) return [];

  const stories = await prisma.wordSenseStory.findMany({
    where: {
      wordSenseId: { in: wordSenseIds },
      isActive: true,
    },
    orderBy: [
      { wordSenseId: "asc" },
      { version: "desc" },
      { id: "desc" },
    ],
    select: {
      id: true,
      wordSenseId: true,
      storyText: true,
      audio_file_name: true,
      audio_source_text: true,
    },
  });

  const activeStoryByWordSenseId = new Map<number, ActiveWordSenseStory>();
  for (const story of stories) {
    if (!activeStoryByWordSenseId.has(story.wordSenseId)) {
      activeStoryByWordSenseId.set(story.wordSenseId, story);
    }
  }

  return words.map((word) => ({
    ...word,
    activeStory: activeStoryByWordSenseId.get(word.id) ?? null,
  }));
}

export async function hydrateWordSenseWithActiveStory<T extends { id: number }>(
  word: T,
): Promise<T & { activeStory: ActiveWordSenseStory | null }> {
  return (await hydrateWordSensesWithActiveStory([word]))[0]!;
}
