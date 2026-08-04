// Restore database content from dbBackupToWork/database_backup.archive
// Uses Prisma to truncate tables and bulk insert backup rows.
const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
const { PrismaClient } = require("@prisma/client");

function loadEnv() {
  const cwd = process.cwd();
  const envLocal = path.join(cwd, ".env.local");
  const env = path.join(cwd, ".env");
  if (fs.existsSync(envLocal)) dotenv.config({ path: envLocal });
  if (fs.existsSync(env)) dotenv.config({ path: env });
}

loadEnv();

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

function withDateKeys(rows, keys) {
  return rows.map((row) => {
    const next = { ...row };
    for (const key of keys) {
      if (next[key]) next[key] = new Date(next[key]);
    }
    return next;
  });
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
    prisma.sentenceWordLink.deleteMany(),
    prisma.account.deleteMany(),
    prisma.session.deleteMany(),
    prisma.passwordResetToken.deleteMany(),
    prisma.userRole.deleteMany(),
    prisma.rolePermission.deleteMany(),
    prisma.verificationToken.deleteMany(),
    prisma.sentence.deleteMany(),
    prisma.word.deleteMany(),
    prisma.ipaKeyword.deleteMany(),
    prisma.persianWord.deleteMany(),
    prisma.pictureWord.deleteMany(),
    prisma.ankiStructureSettings.deleteMany(),
    prisma.role.deleteMany(),
    prisma.permission.deleteMany(),
    prisma.user.deleteMany(),
  ]);

  console.log("Restoring from backup…");
  await createMany("IpaKeyword", withDates(data.ipaKeyword ?? []), (rows) =>
    prisma.ipaKeyword.createMany({ data: rows, skipDuplicates: true })
  );

  await createMany("PersianWord", withDates(data.persianWord ?? []), (rows) =>
    prisma.persianWord.createMany({ data: rows, skipDuplicates: true })
  );

  await createMany("Permission", withDates(data.permission ?? []), (rows) =>
    prisma.permission.createMany({ data: rows, skipDuplicates: true })
  );

  await createMany("Role", withDates(data.role ?? []), (rows) =>
    prisma.role.createMany({ data: rows, skipDuplicates: true })
  );

  await createMany(
    "PictureWord",
    sanitizePictureWord(withDates(data.pictureWord ?? [])),
    (rows) => prisma.pictureWord.createMany({ data: rows, skipDuplicates: true })
  );

  await createMany(
    "AnkiStructureSettings",
    withDates(data.ankiStructureSettings ?? []),
    (rows) => prisma.ankiStructureSettings.createMany({ data: rows, skipDuplicates: true })
  );

  await createMany(
    "User",
    withDateKeys(data.user ?? [], ["createdAt", "updatedAt", "emailVerified"]),
    (rows) => prisma.user.createMany({ data: rows, skipDuplicates: true })
  );

  await createMany("Word", withDates(data.word ?? []), (rows) =>
    prisma.word.createMany({ data: rows, skipDuplicates: true })
  );

  await createMany(
    "Sentence",
    withDates(data.sentence ?? []),
    (rows) => prisma.sentence.createMany({ data: rows, skipDuplicates: true })
  );

  await createMany(
    "SentenceWordLink",
    withDates(data.sentenceWordLink ?? []),
    (rows) => prisma.sentenceWordLink.createMany({ data: rows, skipDuplicates: true })
  );

  await createMany("Account", data.account ?? [], (rows) =>
    prisma.account.createMany({ data: rows, skipDuplicates: true })
  );

  await createMany(
    "Session",
    withDateKeys(data.session ?? [], ["expires"]),
    (rows) => prisma.session.createMany({ data: rows, skipDuplicates: true })
  );

  await createMany(
    "VerificationToken",
    withDateKeys(data.verificationToken ?? [], ["expires"]),
    (rows) => prisma.verificationToken.createMany({ data: rows, skipDuplicates: true })
  );

  await createMany(
    "PasswordResetToken",
    withDateKeys(data.passwordResetToken ?? [], ["createdAt", "expiresAt", "usedAt"]),
    (rows) => prisma.passwordResetToken.createMany({ data: rows, skipDuplicates: true })
  );

  await createMany("UserRole", data.userRole ?? [], (rows) =>
    prisma.userRole.createMany({ data: rows, skipDuplicates: true })
  );

  await createMany("RolePermission", data.rolePermission ?? [], (rows) =>
    prisma.rolePermission.createMany({ data: rows, skipDuplicates: true })
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
