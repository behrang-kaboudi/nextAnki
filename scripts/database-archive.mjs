import fs from "node:fs";
import path from "node:path";

import { Prisma } from "@prisma/client";

export const ARCHIVE_VERSION = 2;
export const DEFAULT_ARCHIVE_PATH = path.join(
  process.cwd(),
  "dbBackupToWork",
  "database_backup.archive"
);

const modelByName = new Map(Prisma.dmmf.datamodel.models.map((model) => [model.name, model]));

function delegateName(modelName) {
  return modelName.slice(0, 1).toLowerCase() + modelName.slice(1);
}

export function getArchiveModels(prisma) {
  return Prisma.dmmf.datamodel.models.map((model) => {
    const key = delegateName(model.name);
    const delegate = prisma[key];
    if (!delegate || typeof delegate.findMany !== "function") {
      throw new Error(`Prisma delegate is unavailable for model ${model.name}.`);
    }
    return { model, key, delegate };
  });
}

function dependencies(model) {
  return model.fields
    .filter((field) => field.kind === "object" && field.relationFromFields?.length)
    .map((field) => field.type)
    .filter((name) => name !== model.name && modelByName.has(name));
}

export function getRestoreOrder() {
  const visited = new Set();
  const visiting = new Set();
  const ordered = [];

  function visit(name) {
    if (visited.has(name)) return;
    if (visiting.has(name)) throw new Error(`Unsupported required relation cycle involving ${name}.`);
    visiting.add(name);
    for (const dependency of dependencies(modelByName.get(name))) visit(dependency);
    visiting.delete(name);
    visited.add(name);
    ordered.push(name);
  }

  for (const model of Prisma.dmmf.datamodel.models) visit(model.name);
  return ordered;
}

function archiveReplacer(_key, value) {
  return typeof value === "bigint" ? { __archiveBigInt: value.toString() } : value;
}

function reviveBigInts(value) {
  if (Array.isArray(value)) return value.map(reviveBigInts);
  if (value && typeof value === "object") {
    if (Object.keys(value).length === 1 && typeof value.__archiveBigInt === "string") {
      return BigInt(value.__archiveBigInt);
    }
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, reviveBigInts(child)]));
  }
  return value;
}

function restoreDates(model, rows) {
  const dateFields = new Set(
    model.fields.filter((field) => field.kind === "scalar" && field.type === "DateTime").map((field) => field.name)
  );
  return rows.map((row) => {
    const next = reviveBigInts(row);
    for (const field of dateFields) {
      if (next[field] != null) next[field] = new Date(next[field]);
    }
    return next;
  });
}

export function readAndValidateArchive(archivePath = DEFAULT_ARCHIVE_PATH) {
  if (!fs.existsSync(archivePath)) throw new Error(`Backup file not found at ${archivePath}`);
  const archive = JSON.parse(fs.readFileSync(archivePath, "utf8"));
  if (!archive?.data || typeof archive.data !== "object") throw new Error("Backup file has no data section.");

  const missing = Prisma.dmmf.datamodel.models
    .map((model) => delegateName(model.name))
    .filter((key) => !Array.isArray(archive.data[key]));
  if (missing.length) {
    throw new Error(`Backup is incomplete for the current Prisma schema. Missing: ${missing.join(", ")}`);
  }
  return archive;
}

export async function writeFullArchive(prisma, archivePath = DEFAULT_ARCHIVE_PATH) {
  const models = getArchiveModels(prisma);
  const data = {};
  const manifest = [];
  for (const { model, key, delegate } of models) {
    const rows = await delegate.findMany();
    data[key] = rows;
    manifest.push({ model: model.name, table: model.dbName ?? key, key, rows: rows.length });
  }

  const archive = { formatVersion: ARCHIVE_VERSION, createdAt: new Date().toISOString(), manifest, data };
  fs.mkdirSync(path.dirname(archivePath), { recursive: true });
  fs.writeFileSync(archivePath, JSON.stringify(archive, archiveReplacer, 2), "utf8");
  readAndValidateArchive(archivePath);
  return archive;
}

export async function restoreFullArchive(prisma, archivePath = DEFAULT_ARCHIVE_PATH, chunkSize = 300) {
  const archive = readAndValidateArchive(archivePath);
  const models = getArchiveModels(prisma);
  const byName = new Map(models.map((entry) => [entry.model.name, entry]));
  const order = getRestoreOrder();

  for (const name of [...order].reverse()) await byName.get(name).delegate.deleteMany();

  for (const name of order) {
    const { model, key, delegate } = byName.get(name);
    const rows = restoreDates(model, archive.data[key]);
    for (let index = 0; index < rows.length; index += chunkSize) {
      await delegate.createMany({ data: rows.slice(index, index + chunkSize) });
    }
  }

  for (const { key, delegate } of models) {
    const restoredCount = await delegate.count();
    if (restoredCount !== archive.data[key].length) {
      throw new Error(`Restore verification failed for ${key}: expected ${archive.data[key].length} rows, found ${restoredCount}.`);
    }
  }
  return archive;
}
