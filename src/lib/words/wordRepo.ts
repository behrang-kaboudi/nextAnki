import "server-only";

import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

function stripManualUpdatedAt<T extends { data?: unknown }>(args: T): T {
  const data = (args as { data?: Record<string, unknown> }).data;
  if (data && typeof data === "object" && "updatedAt" in data) {
    delete (data as Record<string, unknown>).updatedAt;
  }
  return args;
}

export async function updateWord(args: Prisma.WordUpdateArgs) {
  stripManualUpdatedAt(args);
  return prisma.word.update(args);
}

export async function updateManyWords(args: Prisma.WordUpdateManyArgs) {
  stripManualUpdatedAt(args);
  return prisma.word.updateMany(args);
}

