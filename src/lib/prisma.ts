import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

let prisma: PrismaClient = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  // If schema changed during dev, the cached client may be out of date (e.g. missing delegates).
  const hasImageability =
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Boolean((prisma as any)?._dmmf?.datamodel?.models
      ?.find((m: { name?: string; fields?: Array<{ name?: string }> }) => m?.name === "Word")
      ?.fields?.some((f: { name?: string }) => f?.name === "imageability"));

  if (!("theme" in prisma) || !("ipaKeyword" in prisma) || !hasImageability) {
    prisma = new PrismaClient();
  }
  globalForPrisma.prisma = prisma;
}

export { prisma };
