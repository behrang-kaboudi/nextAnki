import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const prisma: PrismaClient = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  // Reuse one pool across Next.js hot reloads. Schema changes are picked up by
  // the managed dev-server restart workflow, without leaking the old pool.
  globalForPrisma.prisma = prisma;
}

export { prisma };
