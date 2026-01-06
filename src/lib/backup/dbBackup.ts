import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

import type { PrismaClient } from "@prisma/client";

type BackupState = {
  lastBackupAt: string | null;
  lastFingerprint: string | null;
  lastDumpFile: string | null;
};

const backupDir = path.join(process.cwd(), "backups", "mysql");
const statePath = path.join(backupDir, ".state.json");

function ensureDir() {
  fs.mkdirSync(backupDir, { recursive: true });
}

function readState(): BackupState {
  try {
    const raw = fs.readFileSync(statePath, "utf8");
    const parsed = JSON.parse(raw) as BackupState;
    return {
      lastBackupAt: parsed?.lastBackupAt ?? null,
      lastFingerprint: parsed?.lastFingerprint ?? null,
      lastDumpFile: parsed?.lastDumpFile ?? null,
    };
  } catch {
    return { lastBackupAt: null, lastFingerprint: null, lastDumpFile: null };
  }
}

function writeState(next: BackupState) {
  ensureDir();
  fs.writeFileSync(statePath, JSON.stringify(next, null, 2));
}

function formatTimestampForFile(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-` +
    `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
  );
}

async function maxDateOrNull(getter: () => Promise<Date | null>) {
  try {
    return await getter();
  } catch {
    return null;
  }
}

async function countOrNull(getter: () => Promise<number>) {
  try {
    return await getter();
  } catch {
    return null;
  }
}

export async function getDbFingerprint(prisma: PrismaClient) {
  const [themeMax, themeCount] = await Promise.all([
    maxDateOrNull(async () => (await prisma.theme.aggregate({ _max: { updatedAt: true } }))._max.updatedAt ?? null),
    countOrNull(() => prisma.theme.count()),
  ]);

  const [wordMax, wordCount] = await Promise.all([
    maxDateOrNull(async () => (await prisma.word.aggregate({ _max: { updatedAt: true } }))._max.updatedAt ?? null),
    countOrNull(() => prisma.word.count()),
  ]);

  const [ipaMax, ipaCount] = await Promise.all([
    maxDateOrNull(async () => (await prisma.ipaKeyword.aggregate({ _max: { updatedAt: true } }))._max.updatedAt ?? null),
    countOrNull(() => prisma.ipaKeyword.count()),
  ]);

  const [pictureMax, pictureCount] = await Promise.all([
    maxDateOrNull(async () => (await prisma.pictureWord.aggregate({ _max: { updatedAt: true } }))._max.updatedAt ?? null),
    countOrNull(() => prisma.pictureWord.count()),
  ]);

  const [userMax, userCount] = await Promise.all([
    maxDateOrNull(async () => (await prisma.user.aggregate({ _max: { createdAt: true } }))._max.createdAt ?? null),
    countOrNull(() => prisma.user.count()),
  ]);

  const fingerprint = {
    theme: { count: themeCount, max: themeMax?.toISOString() ?? null },
    word: { count: wordCount, max: wordMax?.toISOString() ?? null },
    ipaKeyword: { count: ipaCount, max: ipaMax?.toISOString() ?? null },
    pictureWord: { count: pictureCount, max: pictureMax?.toISOString() ?? null },
    user: { count: userCount, max: userMax?.toISOString() ?? null },
  };

  return JSON.stringify(fingerprint);
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

async function runMysqldump(outputFile: string) {
  const { user, password, host, port, database } = parseDatabaseUrl();
  if (!database) throw new Error("DATABASE_URL is missing database name.");

  ensureDir();

  return await new Promise<void>((resolve, reject) => {
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

async function writeJsonBackup(prisma: PrismaClient, outputFile: string) {
  ensureDir();
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

export async function maybeBackupDatabase(prisma: PrismaClient) {
  if (process.env.DB_BACKUP_DISABLED === "1") return { didBackup: false, reason: "disabled" };

  ensureDir();
  const state = readState();
  const now = new Date();
  const lastAt = state.lastBackupAt ? new Date(state.lastBackupAt) : null;

  const elapsedMs = lastAt ? now.getTime() - lastAt.getTime() : Number.POSITIVE_INFINITY;
  const needsTime = elapsedMs >= 10 * 60 * 1000;

  const currentFingerprint = await getDbFingerprint(prisma);
  const changed = state.lastFingerprint ? state.lastFingerprint !== currentFingerprint : true;

  if (!needsTime) return { didBackup: false, reason: "too-soon" };
  if (!changed) return { didBackup: false, reason: "no-change" };

  const baseName = formatTimestampForFile(now);
  let outFile = path.join(backupDir, `${baseName}.sql`);
  try {
    await runMysqldump(outFile);
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code !== "ENOENT") throw error;
    outFile = path.join(backupDir, `${baseName}.json`);
    await writeJsonBackup(prisma, outFile);
  }

  writeState({
    lastBackupAt: now.toISOString(),
    lastFingerprint: currentFingerprint,
    lastDumpFile: path.relative(process.cwd(), outFile),
  });

  return { didBackup: true, file: outFile };
}
