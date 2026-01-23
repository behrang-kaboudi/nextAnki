import fs from "node:fs";
import path from "node:path";

import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";

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
    const snapshot = {
      createdAt: new Date().toISOString(),
      data: {
        theme: await prisma.theme.findMany(),
        word: await prisma.word.findMany(),
        ipaKeyword: await prisma.ipaKeyword.findMany(),
        pictureWord: await prisma.pictureWord.findMany(),
        user: await prisma.user.findMany(),
      },
    };

    const outPath = path.join(process.cwd(), "dbBackupToWork", "database_backup.archive");
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify(snapshot, null, 2), "utf8");
    process.stdout.write(`OK: wrote ${path.relative(process.cwd(), outPath)}\n`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  process.stderr.write(`${err?.stack || err}\n`);
  process.exitCode = 1;
});

