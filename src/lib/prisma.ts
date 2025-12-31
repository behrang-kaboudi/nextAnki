import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  // If schema changed during dev, the cached client may be out of date (e.g. missing delegates).
  if (globalForPrisma.prisma && !("theme" in globalForPrisma.prisma)) {
    globalForPrisma.prisma = new PrismaClient();
  } else {
    globalForPrisma.prisma = prisma;
  }
}
