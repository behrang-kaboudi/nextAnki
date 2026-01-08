import "dotenv/config";

import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function formatTimestampForFile(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return (
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-` +
    `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
  );
}

function parseDatabaseUrl() {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error("DATABASE_URL is not set.");
  const url = new URL(raw);
  if (url.protocol !== "mysql:") throw new Error(`Unsupported protocol: ${url.protocol}`);
  return {
    user: decodeURIComponent(url.username || ""),
    password: decodeURIComponent(url.password || ""),
    host: url.hostname || "localhost",
    port: url.port || "3306",
    database: url.pathname.replace(/^\//, ""),
  };
}

async function runMysqldump(outputFile) {
  const { user, password, host, port, database } = parseDatabaseUrl();
  if (!database) throw new Error("DATABASE_URL is missing database name.");

  return await new Promise((resolve, reject) => {
    const args = [
      `--host=${host}`,
      `--port=${port}`,
      `--user=${user}`,
      "--single-transaction",
      "--routines",
      "--triggers",
      "--set-gtid-purged=OFF",
      database,
    ];

    const child = spawn("mysqldump", args, {
      env: { ...process.env, MYSQL_PWD: password || process.env.MYSQL_PWD },
      stdio: ["ignore", "pipe", "pipe"],
    });

    const out = fs.createWriteStream(outputFile, { encoding: "utf8" });
    child.stdout.pipe(out);

    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });

    child.on("error", (error) => {
      reject(error);
    });

    child.on("close", (code) => {
      if (code === 0) return resolve();
      reject(new Error(`mysqldump failed (code ${code}): ${stderr.trim()}`));
    });
  });
}

async function writeJsonBackup(outputFile) {
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
  fs.writeFileSync(outputFile, JSON.stringify(snapshot, null, 2));
}

async function takeBackup() {
  const backupDir = path.join(process.cwd(), "backups", "mysql");
  fs.mkdirSync(backupDir, { recursive: true });

  const baseName = formatTimestampForFile(new Date());
  let outFile = path.join(backupDir, `${baseName}.sql`);

  process.stdout.write(`Backup: creating ${path.relative(process.cwd(), outFile)}\n`);

  try {
    await runMysqldump(outFile);
    process.stdout.write("Backup: mysqldump OK\n");
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
    outFile = path.join(backupDir, `${baseName}.json`);
    process.stdout.write("Backup: mysqldump not found, writing JSON snapshot...\n");
    await writeJsonBackup(outFile);
    process.stdout.write("Backup: JSON OK\n");
  }

  return outFile;
}

async function backfillViaApi(pathname, { baseUrl, batch }) {
  let startId = Number.parseInt(process.env.START_ID ?? "0", 10) || 0;
  let totalProcessed = 0;
  let totalUpdated = 0;

  for (;;) {
    const url = new URL(pathname, baseUrl);
    url.searchParams.set("batch", String(batch));
    url.searchParams.set("startId", String(startId));

    const res = await fetch(url, { method: "POST" });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Backfill failed: ${res.status} ${res.statusText}\n${text}`);
    }
    const json = await res.json();

    totalProcessed += json.processed ?? 0;
    totalUpdated += json.updated ?? 0;
    startId = json.nextStartId ?? startId;

    process.stdout.write(
      `${pathname}: processed=${totalProcessed} updated=${totalUpdated} nextStartId=${startId} done=${Boolean(json.done)}\n`
    );

    if (json.done) break;
  }

  process.stdout.write(`${pathname}: DONE processed=${totalProcessed} updated=${totalUpdated}\n`);
}

async function main() {
  const baseUrl = process.env.BASE_URL ?? "http://localhost:3000";
  const batch = Number.parseInt(process.env.BATCH ?? "2000", 10) || 2000;

  const backupFile = await takeBackup();
  process.stdout.write(`Backup saved: ${backupFile}\n`);

  process.stdout.write("Rebuilding normalized fields via API...\n");
  await backfillViaApi("/api/ipa-test/backfill-normalized", { baseUrl, batch });
  await backfillViaApi("/api/ipa-test/backfill-pictureword-normalized", { baseUrl, batch });

  process.stdout.write("All done.\n");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => {});
  });
