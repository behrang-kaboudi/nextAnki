import fs from "node:fs";
import path from "node:path";

import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { archivesHaveSameData } from "../src/lib/backup/archiveFingerprint.mjs";
import { DEFAULT_ARCHIVE_PATH, readAndValidateArchive, writeFullArchive } from "./database-archive.mjs";

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
  const preserveIfUnchanged = process.argv.includes("--if-changed");
  const temporaryPath = `${DEFAULT_ARCHIVE_PATH}.candidate-${process.pid}`;
  try {
    const outputPath = preserveIfUnchanged ? temporaryPath : DEFAULT_ARCHIVE_PATH;
    const snapshot = await writeFullArchive(prisma, outputPath);
    let status = "updated";

    if (preserveIfUnchanged && fs.existsSync(DEFAULT_ARCHIVE_PATH)) {
      const previous = readAndValidateArchive(DEFAULT_ARCHIVE_PATH);
      if (archivesHaveSameData(previous, snapshot)) {
        fs.unlinkSync(temporaryPath);
        status = "unchanged";
      } else {
        fs.renameSync(temporaryPath, DEFAULT_ARCHIVE_PATH);
      }
    } else if (preserveIfUnchanged) {
      fs.renameSync(temporaryPath, DEFAULT_ARCHIVE_PATH);
    }

    const outPath = DEFAULT_ARCHIVE_PATH;
    process.stdout.write(`Verified ${snapshot.manifest.length} Prisma models.\n`);
    process.stdout.write(status === "unchanged"
      ? `OK: database is unchanged; preserved ${path.relative(process.cwd(), outPath)}\n`
      : `OK: wrote ${path.relative(process.cwd(), outPath)}\n`);
    process.stdout.write(`BACKUP_STATUS=${status}\n`);
  } finally {
    if (fs.existsSync(temporaryPath)) fs.unlinkSync(temporaryPath);
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  process.stderr.write(`${err?.stack || err}\n`);
  process.exitCode = 1;
});
