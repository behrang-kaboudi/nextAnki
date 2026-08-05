import fs from "node:fs";
import path from "node:path";

import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { DEFAULT_ARCHIVE_PATH, restoreFullArchive } from "./database-archive.mjs";

function loadEnv() {
  const cwd = process.cwd();
  const envLocal = path.join(cwd, ".env.local");
  const env = path.join(cwd, ".env");
  if (fs.existsSync(envLocal)) dotenv.config({ path: envLocal });
  if (fs.existsSync(env)) dotenv.config({ path: env });
}

async function main() {
  loadEnv();
  const prisma = new PrismaClient();
  try {
    const archivePath = process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_ARCHIVE_PATH;
    const archive = await restoreFullArchive(prisma, archivePath);
    process.stdout.write(`Restore complete: ${archive.manifest?.length ?? 0} Prisma models.\n`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  process.stderr.write(`${error?.stack || error}\n`);
  process.exitCode = 1;
});
