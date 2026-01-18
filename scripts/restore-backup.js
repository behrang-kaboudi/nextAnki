// Restore database content from dbBackupToWork/database_backup.archive
// Uses Prisma to truncate tables and bulk insert backup rows.
const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const CHUNK_SIZE = 300;
const defaultBackupPath = path.join(
  __dirname,
  "..",
  "dbBackupToWork",
  "database_backup.archive"
);
const backupPath = process.argv[2]
  ? path.resolve(process.argv[2])
  : defaultBackupPath;

function chunk(array, size) {
  const result = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
}

function withDates(rows) {
  return rows.map((row) => ({
    ...row,
    createdAt: row.createdAt ? new Date(row.createdAt) : undefined,
    updatedAt: row.updatedAt ? new Date(row.updatedAt) : undefined,
  }));
}

function pickKeys(row, allowedKeys) {
  const out = {};
  for (const k of allowedKeys) {
    if (Object.prototype.hasOwnProperty.call(row, k)) out[k] = row[k];
  }
  return out;
}

function sanitizePictureWord(rows) {
  const allowed = [
    "id",
    "fa",
    "ipa_fa",
    "ipa_fa_normalized",
    "phinglish",
    "en",
    "type",
    "usage",
    "canBePersonal",
    "ipaVerified",
    "createdAt",
    "updatedAt",
  ];
  return rows.map((r) => pickKeys(r, allowed));
}

async function createMany(label, rows, create) {
  let inserted = 0;
  for (const group of chunk(rows, CHUNK_SIZE)) {
    const result = await create(group);
    inserted += result?.count ?? group.length;
  }
  console.log(`${label}: ${inserted} inserted`);
}

async function main() {
  if (!fs.existsSync(backupPath)) {
    throw new Error(`Backup file not found at ${backupPath}`);
  }

  const parsed = JSON.parse(fs.readFileSync(backupPath, "utf8"));
  const data = parsed.data ?? {};

  console.log("Clearing existing data…");
  await prisma.$transaction([
    prisma.theme.deleteMany(),
    prisma.word.deleteMany(),
    prisma.ipaKeyword.deleteMany(),
    prisma.pictureWord.deleteMany(),
    prisma.user.deleteMany(),
  ]);

  console.log("Restoring from backup…");
  await createMany("Theme", withDates(data.theme ?? []), (rows) =>
    prisma.theme.createMany({ data: rows, skipDuplicates: true })
  );

  await createMany("IpaKeyword", withDates(data.ipaKeyword ?? []), (rows) =>
    prisma.ipaKeyword.createMany({ data: rows, skipDuplicates: true })
  );

  await createMany(
    "PictureWord",
    sanitizePictureWord(withDates(data.pictureWord ?? [])),
    (rows) => prisma.pictureWord.createMany({ data: rows, skipDuplicates: true })
  );

  await createMany("Word", withDates(data.word ?? []), (rows) =>
    prisma.word.createMany({ data: rows, skipDuplicates: true })
  );

  await createMany("User", withDates(data.user ?? []), (rows) =>
    prisma.user.createMany({ data: rows, skipDuplicates: true })
  );

  console.log("Restore complete.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
