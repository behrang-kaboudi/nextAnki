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
        word: await prisma.word.findMany(),
        sentence: await prisma.sentence.findMany(),
        sentenceWordLink: await prisma.sentenceWordLink.findMany(),
        ipaKeyword: await prisma.ipaKeyword.findMany(),
        pictureWord: await prisma.pictureWord.findMany(),
        user: await prisma.user.findMany(),
        account: await prisma.account.findMany(),
        session: await prisma.session.findMany(),
        verificationToken: await prisma.verificationToken.findMany(),
        passwordResetToken: await prisma.passwordResetToken.findMany(),
        role: await prisma.role.findMany(),
        permission: await prisma.permission.findMany(),
        userRole: await prisma.userRole.findMany(),
        rolePermission: await prisma.rolePermission.findMany(),
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
