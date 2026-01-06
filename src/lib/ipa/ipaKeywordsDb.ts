import "server-only";

import { prisma } from "@/lib/prisma";

export type IpaKeyword = {
  number: number;
  fa: string;
  ipa_fa: string;
};

declare global {
  var __ipaKeywordsPromise: Promise<IpaKeyword[]> | undefined;
}

export async function getIpaKeywordsFromDb(): Promise<IpaKeyword[]> {
  if (!globalThis.__ipaKeywordsPromise) {
    globalThis.__ipaKeywordsPromise = prisma.ipaKeyword.findMany({
      select: { number: true, fa: true, ipa_fa: true },
      orderBy: { number: "asc" },
    });
  }
  return globalThis.__ipaKeywordsPromise;
}
