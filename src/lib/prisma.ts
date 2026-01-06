import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

let prisma: PrismaClient = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  // If schema changed during dev, the cached client may be out of date (e.g. missing delegates).
  if (!("theme" in prisma) || !("ipaKeyword" in prisma)) {
    prisma = new PrismaClient();
  }
  globalForPrisma.prisma = prisma;
}

export { prisma };
